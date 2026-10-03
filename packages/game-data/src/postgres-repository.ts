import { Pool } from 'pg';
import type {
  AutomationSystem,
  CollectibleDetail,
  CollectibleSummary,
  ContentFilter,
  CoverageEntry,
  DataHealth,
  DittoMoveDetail,
  DittoMoveSummary,
  DocumentRelationshipAudit,
  GameDataRepository,
  ItemDetail,
  ItemSummary,
  PokemonDetail,
  PokemonSummary,
  QuestDetail,
  QuestSummary,
  QuantitativeParameter,
  RecipeSummary,
  SearchRecord,
  TownDetail,
  TownSummary,
  TreasureMapDetail,
  TreasureMapSummary,
} from './types';

type Projection =
  | PokemonSummary
  | ItemDetail
  | RecipeSummary
  | TownDetail
  | AutomationSystem
  | QuestDetail
  | TreasureMapDetail
  | CollectibleDetail
  | DittoMoveDetail;

interface ProjectionRow {
  kind: string;
  value_json: Projection;
}

interface SearchRow {
  kind: string;
  slug: string;
  title: string;
  body: string;
}

interface QuantitativeRow {
  payload: QuantitativeParameter;
}

export async function loadPostgresGameDataRepository(
  connectionString: string,
): Promise<GameDataRepository> {
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const [projectionResult, searchResult, runResult, quantitativeResult] = await Promise.all([
      pool.query<ProjectionRow>(
        `select e.kind::text as kind, sa.value_json
         from public.source_assertions sa
         join public.entities e on e.id = sa.subject_entity_id
         where sa.predicate = 'runtime.canonical_projection'
           and sa.lifecycle in ('candidate', 'accepted')
         order by e.kind, e.slug`,
      ),
      pool.query<SearchRow>(
        `select e.kind::text as kind, e.slug, s.title, s.body
         from public.search_entries s join public.entities e on e.id = s.entity_id
         order by e.kind, e.slug`,
      ),
      pool.query<{ statistics: Record<string, unknown>; snapshot_key: string }>(
        `select ir.statistics, ss.snapshot_key
         from public.ingestion_runs ir
         join public.source_snapshots ss on ss.id = ir.source_snapshot_id
         where ir.status = 'completed'
         order by ir.completed_at desc nulls last limit 1`,
      ),
      pool.query<QuantitativeRow>(
        `select payload from public.quantitative_parameters
         where review_status in ('candidate', 'accepted')
         order by predicate, id`,
      ),
    ]);
    if (!projectionResult.rows.length)
      throw new Error('PostgreSQL has no runtime canonical projections. Run db:seed first.');
    return new PostgresRuntimeRepository(
      projectionResult.rows.map((row) => row.value_json),
      searchResult.rows,
      runResult.rows[0] ?? null,
      redactConnectionString(connectionString),
      quantitativeResult.rows.map((row) => row.payload),
    );
  } finally {
    await pool.end();
  }
}

class PostgresRuntimeRepository implements GameDataRepository {
  private readonly pokemon: readonly PokemonSummary[];
  private readonly items: readonly ItemDetail[];
  private readonly recipes: readonly RecipeSummary[];
  private readonly towns: readonly TownDetail[];
  private readonly automation: readonly AutomationSystem[];
  private readonly quests: readonly QuestDetail[];
  private readonly treasureMaps: readonly TreasureMapDetail[];
  private readonly collectibles: readonly CollectibleDetail[];
  private readonly dittoMoves: readonly DittoMoveDetail[];

  constructor(
    projections: readonly Projection[],
    private readonly searchRows: readonly SearchRow[],
    private readonly run: { statistics: Record<string, unknown>; snapshot_key: string } | null,
    private readonly target: string,
    private readonly quantitative: readonly QuantitativeParameter[],
  ) {
    this.pokemon = projections.filter((entry): entry is PokemonSummary => entry.kind === 'pokemon');
    this.items = projections.filter((entry): entry is ItemDetail => entry.kind === 'item');
    this.recipes = projections.filter((entry): entry is RecipeSummary => entry.kind === 'recipe');
    this.towns = projections.filter((entry): entry is TownDetail => entry.kind === 'town');
    this.automation = projections.filter(
      (entry): entry is AutomationSystem => entry.kind === 'automation',
    );
    this.quests = projections.filter((entry): entry is QuestDetail => entry.kind === 'quest');
    this.treasureMaps = projections.filter(
      (entry): entry is TreasureMapDetail => entry.kind === 'treasure_map',
    );
    this.collectibles = projections.filter(
      (entry): entry is CollectibleDetail => entry.kind === 'collectible',
    );
    this.dittoMoves = projections.filter(
      (entry): entry is DittoMoveDetail => entry.kind === 'ditto_move',
    );
  }

  health(): DataHealth {
    const source = this.run?.statistics.source as Partial<DataHealth> | undefined;
    return {
      databasePath: this.target,
      schema: 'postgres-canonical',
      snapshot: this.run?.snapshot_key ?? 'PostgreSQL canonical runtime',
      pages: Number(source?.pages ?? 0),
      facts: Number(source?.facts ?? 0),
      relationships: Number(source?.relationships ?? 0),
      entities: {
        pokemon: this.pokemon.length,
        items: this.items.length,
        recipes: this.recipes.length,
        towns: this.towns.length,
        automation: this.automation.length,
        requests: this.quests.length,
        'treasure-maps': this.treasureMaps.length,
        collectibles: this.collectibles.length,
        abilities: this.dittoMoves.length,
      },
      warnings: [
        'PostgreSQL runtime uses review-gated canonical projections; candidate assertions are not promoted to accepted facts.',
      ],
    };
  }

  relationshipAudit(): DocumentRelationshipAudit {
    const relationships = this.health().relationships;
    return {
      total: relationships,
      types: {},
      orphanSources: 0,
      orphanTargets: 0,
      selfLinks: 0,
      duplicateEdges: 0,
      semanticRelationships: 0,
      ambiguousDocumentLinks: relationships,
    };
  }

  coverage(): readonly CoverageEntry[] {
    return [
      coverage('pokemon', this.pokemon.length),
      coverage('items', this.items.length),
      coverage('recipes', this.recipes.length),
      coverage('towns', this.towns.length),
      coverage('automation', this.automation.length),
      coverage('requests', this.quests.length),
      coverage('treasure maps', this.treasureMaps.length),
      coverage('music CDs', this.collectibles.length),
      coverage('Ditto moves', this.dittoMoves.length),
    ];
  }

  listPokemon(limit = 100, offset = 0): readonly PokemonSummary[] {
    return this.pokemon.slice(offset, offset + limit);
  }

  getPokemon(slug: string): PokemonDetail | null {
    return (this.pokemon.find((entry) => entry.slug === slug) as PokemonDetail | undefined) ?? null;
  }

  listItems(limit = 100, offset = 0): readonly ItemSummary[] {
    return this.items.slice(offset, offset + limit);
  }

  getItem(slug: string): ItemDetail | null {
    return this.items.find((entry) => entry.slug === slug) ?? null;
  }

  listRecipes(limit = 100, offset = 0): readonly RecipeSummary[] {
    return this.recipes.slice(offset, offset + limit);
  }

  getRecipe(slug: string): RecipeSummary | null {
    return this.recipes.find((entry) => entry.slug === slug) ?? null;
  }

  listTowns(): readonly TownSummary[] {
    return this.towns;
  }

  getTown(slug: string): TownDetail | null {
    return this.towns.find((entry) => entry.slug === slug) ?? null;
  }

  listAutomationSystems(): readonly AutomationSystem[] {
    return this.automation;
  }

  listQuantitativeParameters(): readonly QuantitativeParameter[] {
    return this.quantitative;
  }

  listQuests(filter: ContentFilter = {}): readonly QuestSummary[] {
    return filterByScope(this.quests, filter);
  }

  getQuest(slug: string): QuestDetail | null {
    return this.quests.find((entry) => entry.slug === slug) ?? null;
  }

  listTreasureMaps(filter: ContentFilter = {}): readonly TreasureMapSummary[] {
    return filterByScope(this.treasureMaps, filter);
  }

  getTreasureMap(slug: string): TreasureMapDetail | null {
    return this.treasureMaps.find((entry) => entry.slug === slug) ?? null;
  }

  listCollectibles(filter: ContentFilter = {}): readonly CollectibleSummary[] {
    return filterByScope(this.collectibles, filter);
  }

  getCollectible(slug: string): CollectibleDetail | null {
    return this.collectibles.find((entry) => entry.slug === slug) ?? null;
  }

  listDittoMoves(filter: ContentFilter = {}): readonly DittoMoveSummary[] {
    return filterByScope(this.dittoMoves, filter);
  }

  getDittoMove(slug: string): DittoMoveDetail | null {
    return this.dittoMoves.find((entry) => entry.slug === slug) ?? null;
  }

  search(query: string, limit = 24): readonly SearchRecord[] {
    const terms = searchKey(query).split(' ').filter(Boolean);
    if (!terms.length) return [];
    return this.searchRows
      .map((row) => {
        const title = searchKey(row.title);
        const body = searchKey(row.body);
        const matched = terms.filter((term) => title.includes(term) || body.includes(term)).length;
        const rank = title === terms.join(' ') ? 100 : matched === terms.length ? 60 : matched * 10;
        return { row, rank };
      })
      .filter(({ rank }) => rank > 0)
      .sort(({ row: left, rank: leftRank }, { row: right, rank: rightRank }) =>
        rightRank !== leftRank ? rightRank - leftRank : left.title.localeCompare(right.title),
      )
      .slice(0, limit)
      .map(({ row, rank }) => ({
        kind: runtimeKind(row.kind),
        slug: originalSlug(row, this),
        title: row.title,
        excerpt: row.body || row.title,
        url: projectionUrl(row, this),
        rank,
      }));
  }
}

function coverage(domain: string, total: number): CoverageEntry {
  return {
    domain,
    totalSource: total,
    totalCanonicalized: total,
    totalUnresolved: 0,
    coveragePercent: total ? 100 : null,
    basis: 'PostgreSQL runtime projection parity',
  };
}

function runtimeKind(kind: string): SearchRecord['kind'] {
  return kind === 'automation_system' ? 'automation' : (kind as SearchRecord['kind']);
}

function originalSlug(row: SearchRow, repository: PostgresRuntimeRepository): string {
  return projectionFor(row, repository)?.slug ?? row.slug;
}

function projectionUrl(row: SearchRow, repository: PostgresRuntimeRepository): string {
  return projectionFor(row, repository)?.source.url ?? '';
}

function projectionFor(
  row: SearchRow,
  repository: PostgresRuntimeRepository,
): Projection | undefined {
  const kind = runtimeKind(row.kind);
  if (kind === 'pokemon')
    return repository.listPokemon(10_000).find((entry) => postgresSlug(entry.slug) === row.slug);
  if (kind === 'item')
    return (
      repository
        .listItems(10_000)
        .map((entry) => repository.getItem(entry.slug))
        .find((entry) => entry && postgresSlug(entry.slug) === row.slug) ?? undefined
    );
  if (kind === 'recipe')
    return repository.listRecipes(10_000).find((entry) => postgresSlug(entry.slug) === row.slug);
  if (kind === 'town')
    return (
      repository
        .listTowns()
        .map((entry) => repository.getTown(entry.slug))
        .find((entry) => entry && postgresSlug(entry.slug) === row.slug) ?? undefined
    );
  if (kind === 'automation')
    return repository
      .listAutomationSystems()
      .find((entry) => postgresSlug(entry.slug) === row.slug);
  if (kind === 'quest')
    return repository.listQuests().find((entry) => postgresSlug(entry.slug) === row.slug);
  if (kind === 'treasure_map')
    return repository.listTreasureMaps().find((entry) => postgresSlug(entry.slug) === row.slug);
  if (kind === 'collectible')
    return repository.listCollectibles().find((entry) => postgresSlug(entry.slug) === row.slug);
  if (kind === 'ditto_move')
    return repository.listDittoMoves().find((entry) => postgresSlug(entry.slug) === row.slug);
  return undefined;
}

function filterByScope<T extends { classification: { scope: string } }>(
  values: readonly T[],
  filter: ContentFilter,
): readonly T[] {
  return !filter.scope || filter.scope === 'all'
    ? values
    : values.filter((value) => value.classification.scope === filter.scope);
}

function searchKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function postgresSlug(value: string): string {
  return searchKey(value).replaceAll(' ', '-');
}

function redactConnectionString(value: string): string {
  const url = new URL(value);
  url.username = url.username ? '***' : '';
  url.password = url.password ? '***' : '';
  return url.toString();
}
