import Database from 'better-sqlite3';
import type {
  AutomationSystem,
  CollectibleDetail,
  CollectibleSummary,
  ContentScope,
  ContentClassification,
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
  RecipeSummary,
  RecipeIngredient,
  RoleAssignment,
  RoleSlug,
  QuestDetail,
  QuestSummary,
  QuantitativeParameter,
  SearchRecord,
  SourceEvidence,
  TreasureMapDetail,
  TreasureMapSummary,
  TownDetail,
  TownSummary,
} from './types';

interface PageRow {
  url: string;
  title: string;
  category: string;
}
interface TableRow extends PageRow {
  table_index: number;
  row_index: number;
  cells_json: string;
}
interface IndexedRow {
  tableIndex: number;
  rowIndex: number;
  cells: string[];
}
interface FactRow {
  key: string;
  value: string;
}
interface SearchRow {
  source_url: string;
  title: string;
  category: string;
  excerpt: string;
  score: number;
}
interface QuantitativeRow {
  id: string;
  subject_kind: QuantitativeParameter['subjectKind'];
  subject_slug: string;
  predicate: string;
  value: number;
  unit: QuantitativeParameter['unit'];
  qualifier: string | null;
  derivation: QuantitativeParameter['derivation'];
  parent_assertion_ids_json: string;
  locator: string;
  evidence_text: string;
  parser_confidence: number;
  evidence_confidence: number;
  source_verification_status: QuantitativeParameter['sourceVerificationStatus'];
  assertion_status: QuantitativeParameter['assertionStatus'];
  content_scope: ContentScope;
  game_version: string | null;
  source_url: string;
  title: string;
}
interface CellLink {
  url: string;
  text: string;
  internal: boolean;
}

const SNAPSHOT = 'Pokopia-KB-FULL-20260809-005646';
const CANONICAL_SNAPSHOT = 'Pokopia canonical v3.1';
const KNOWN_SPECIALTIES = [
  'GatherHoney',
  'DreamIsland',
  'Illuminate',
  'Transform',
  'Bulldoze',
  'Engineer',
  'Generate',
  'Appraise',
  'Teleport',
  'Recycle',
  'Storage',
  'Collect',
  'Gather',
  'Search',
  'Rarify',
  'Explode',
  'Build',
  'Water',
  'Chop',
  'Crush',
  'Grow',
  'Trade',
  'Paint',
  'Party',
  'Litter',
  'Scrub',
  'Burn',
  'Hype',
  'Yawn',
  'Eat',
  'Fly',
  'DJ',
] as const;

const SPECIALTY_ROLES: Readonly<Record<string, readonly { role: RoleSlug; confidence: number }[]>> =
  {
    Build: [
      { role: 'construction', confidence: 0.95 },
      { role: 'building', confidence: 0.95 },
    ],
    Water: [
      { role: 'watering', confidence: 0.95 },
      { role: 'farming', confidence: 0.8 },
    ],
    Grow: [
      { role: 'farming', confidence: 0.95 },
      { role: 'production', confidence: 0.75 },
    ],
    Gather: [
      { role: 'harvesting', confidence: 0.9 },
      { role: 'resource-generation', confidence: 0.8 },
    ],
    GatherHoney: [
      { role: 'harvesting', confidence: 0.95 },
      { role: 'food', confidence: 0.75 },
    ],
    Collect: [
      { role: 'harvesting', confidence: 0.9 },
      { role: 'logistics', confidence: 0.7 },
    ],
    Generate: [
      { role: 'electricity', confidence: 0.9 },
      { role: 'power', confidence: 0.9 },
      { role: 'resource-generation', confidence: 0.8 },
    ],
    Engineer: [
      { role: 'automation', confidence: 0.85 },
      { role: 'production', confidence: 0.75 },
      { role: 'utility', confidence: 0.7 },
    ],
    Chop: [
      { role: 'wood', confidence: 0.95 },
      { role: 'resource-generation', confidence: 0.8 },
    ],
    Crush: [
      { role: 'mining', confidence: 0.85 },
      { role: 'stone', confidence: 0.9 },
      { role: 'resource-generation', confidence: 0.75 },
    ],
    Bulldoze: [
      { role: 'mining', confidence: 0.75 },
      { role: 'stone', confidence: 0.8 },
    ],
    Storage: [
      { role: 'storage', confidence: 0.95 },
      { role: 'logistics', confidence: 0.85 },
    ],
    Teleport: [
      { role: 'transport', confidence: 0.95 },
      { role: 'logistics', confidence: 0.8 },
      { role: 'exploration', confidence: 0.75 },
    ],
    Search: [{ role: 'exploration', confidence: 0.9 }],
    Appraise: [{ role: 'exploration', confidence: 0.75 }],
    Recycle: [
      { role: 'production', confidence: 0.85 },
      { role: 'resource-generation', confidence: 0.8 },
    ],
    Paint: [{ role: 'decoration', confidence: 0.95 }],
    Fly: [
      { role: 'transport', confidence: 0.75 },
      { role: 'exploration', confidence: 0.8 },
    ],
  };

function slugFromUrl(url: string): string {
  return (url.split('/').pop() ?? 'unknown').replace(/\.(s?html?)$/i, '');
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+-\s+Pok[eé]mon Pokopia Item Database.*$/i, '')
    .replace(/\s+-\s+(Pok[eé] Dex|Items?|Locations?).*$/i, '')
    .replace(/\s+Locations?\s+-\s+Pok[eé]mon Pokopia$/i, '')
    .replace(/\s+-\s+Pok[eé]mon Pokopia$/i, '')
    .trim();
}

function source(row: PageRow, snapshot: string): SourceEvidence {
  return { url: row.url, title: row.title, snapshot, verificationStatus: 'unverified' };
}

function parseCells(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((cell): cell is string => typeof cell === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseLinks(value: string): CellLink[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CellLink =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as CellLink).url === 'string' &&
        typeof (entry as CellLink).text === 'string',
    );
  } catch {
    return [];
  }
}

function splitWords(value: string): string[] {
  return value
    .split(/\n+|\s{2,}|\s*[,;|]\s*|\s*\/\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function count(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT count(*) AS value FROM ${table}`).get() as { value: number };
  return Number(row.value);
}

function percent(canonicalized: number, total: number): number | null {
  return total ? Math.round((canonicalized / total) * 10_000) / 100 : null;
}

export class LegacySnapshotRepository implements GameDataRepository {
  private readonly db: Database.Database;
  private readonly canonical: boolean;
  private readonly snapshot: string;
  private pokemonCache?: readonly PokemonSummary[];
  private itemCache?: readonly ItemSummary[];
  private recipeCache?: readonly RecipeSummary[];
  private townCache?: readonly TownDetail[];
  private questCache?: readonly QuestSummary[];
  private treasureMapCache?: readonly TreasureMapSummary[];
  private collectibleCache?: readonly CollectibleSummary[];
  private dittoMoveCache?: readonly DittoMoveSummary[];
  private automationCache?: readonly AutomationSystem[];
  private quantitativeCache?: readonly QuantitativeParameter[];
  private pokemonBySlug?: ReadonlyMap<string, PokemonSummary>;
  private itemBySlug?: ReadonlyMap<string, ItemSummary>;
  private townBySlug?: ReadonlyMap<string, TownDetail>;
  private readonly pokemonDetails = new Map<string, PokemonDetail | null>();
  private readonly itemDetails = new Map<string, ItemDetail | null>();
  // The database is opened read-only, so statements and derived projections are safe to reuse.
  private readonly statements = new Map<string, Database.Statement>();
  private factsBySource?: ReadonlyMap<string, readonly FactRow[]>;

  constructor(
    private readonly databasePath: string,
    schema: 'legacy' | 'canonical' = 'legacy',
  ) {
    this.db = new Database(databasePath, { readonly: true, fileMustExist: true });
    this.canonical = schema === 'canonical';
    this.snapshot = this.canonical ? CANONICAL_SNAPSHOT : SNAPSHOT;
  }

  health(): DataHealth {
    const categories = this.statement(
      'SELECT category, count(*) AS total FROM pages GROUP BY category',
    ).all() as { category: string; total: number }[];
    return {
      databasePath: this.databasePath,
      schema: this.canonical ? 'canonical' : 'legacy-snapshot',
      snapshot: this.snapshot,
      pages: count(this.db, 'pages'),
      facts: count(this.db, 'facts'),
      relationships: this.canonical ? count(this.db, 'relationships') : 0,
      entities: Object.fromEntries(categories.map((row) => [row.category, Number(row.total)])),
      warnings: this.canonical
        ? [
            'Canonical v3.1 is parser-normalized; gameplay assertions still require review status before confirmation.',
          ]
        : [
            'Legacy snapshot: facts are unreviewed extraction candidates, not canonical truth.',
            'Structured relationships await canonical ingestion.',
          ],
    };
  }

  relationshipAudit(): DocumentRelationshipAudit {
    if (!this.canonical)
      return {
        total: 0,
        types: {},
        orphanSources: 0,
        orphanTargets: 0,
        selfLinks: 0,
        duplicateEdges: 0,
        semanticRelationships: 0,
        ambiguousDocumentLinks: 0,
      };
    const typeRows = this.statement(
      'SELECT type, count(*) AS count FROM relationships GROUP BY type',
    ).all() as { type: string; count: number }[];
    const total = typeRows.reduce((sum, row) => sum + Number(row.count), 0);
    const types = Object.fromEntries(typeRows.map((row) => [row.type, Number(row.count)]));
    const semanticRelationships = typeRows
      .filter((row) => row.type !== 'links_to')
      .reduce((sum, row) => sum + Number(row.count), 0);
    return {
      total,
      types,
      orphanSources: this.scalar(
        'SELECT count(*) AS value FROM relationships r LEFT JOIN entities e ON e.id=r.source_entity_id WHERE e.id IS NULL',
      ),
      orphanTargets: this.scalar(
        'SELECT count(*) AS value FROM relationships r LEFT JOIN entities e ON e.id=r.target_entity_id WHERE e.id IS NULL',
      ),
      selfLinks: this.scalar(
        'SELECT count(*) AS value FROM relationships WHERE source_entity_id=target_entity_id',
      ),
      duplicateEdges: this.scalar(
        'SELECT count(*) AS value FROM (SELECT source_entity_id,target_entity_id,type,count(*) FROM relationships GROUP BY source_entity_id,target_entity_id,type HAVING count(*)>1)',
      ),
      semanticRelationships,
      ambiguousDocumentLinks: Number(types.links_to ?? 0),
    };
  }

  coverage(): readonly CoverageEntry[] {
    const pokemon = this.listPokemon(10_000);
    const items = this.listItems(10_000);
    const recipes = this.listRecipes(10_000);
    const towns = this.listTowns();
    const specialtySource = this.canonical
      ? this.scalar(
          "SELECT count(*) AS value FROM pages WHERE source_url LIKE '%/pokedex/specialty/%'",
        )
      : 0;
    const canonicalSpecialties = new Set(
      pokemon.flatMap((entry) => specialtyTokens(entry.specialty ?? '')),
    ).size;
    const itemSource = this.canonical
      ? this.scalar(
          "SELECT count(*) AS value FROM pages WHERE category='items' AND source_url LIKE '%/items/%'",
        )
      : items.length;
    const recipeSourceSlugs = new Set(
      this.canonical
        ? (
            this.statement(
              "SELECT DISTINCT p.title FROM pages p JOIN table_cells c ON c.page_id=p.id WHERE p.category='items' AND c.text='Recipe'",
            ).all() as { title: string }[]
          ).map((row) => toSlug(cleanTitle(row.title)))
        : recipes.map((recipe) => recipe.slug),
    );
    for (const recipe of recipes) recipeSourceSlugs.add(recipe.slug);
    const recipeSource = recipeSourceSlugs.size;
    const recipesWithKnownQuantities = recipes.filter((recipe) =>
      recipe.ingredients.every((ingredient) => ingredient.quantity !== null),
    ).length;
    const furnitureSource = this.canonical
      ? this.scalar(
          "SELECT count(DISTINCT p.id) AS value FROM pages p JOIN table_cells c ON c.page_id=p.id WHERE p.category='items' AND c.table_index=3 AND c.row_index=2 AND c.column_index=1 AND c.text='Furniture'",
        )
      : 0;
    const environmentLevels = this.canonical
      ? this.scalar(
          "SELECT count(DISTINCT p.id || ':' || CAST(REPLACE(REPLACE(c.text,'Lv. ',''),'Lv.','') AS INTEGER)) AS value FROM pages p JOIN table_cells c ON c.page_id=p.id WHERE p.category='locations' AND p.source_url LIKE '%/locations/%' AND c.text GLOB 'Lv. *'",
        )
      : 0;
    const materials = new Set(
      recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.slug)),
    ).size;
    return [
      coverage('Pokémon', pokemon.length, pokemon.length, 'direct Pokédex detail pages'),
      coverage(
        'Pokémon forms',
        0,
        0,
        'no explicit form-detail pages detected; denominator unknown',
      ),
      coverage(
        'Specialties',
        specialtySource,
        canonicalSpecialties,
        'specialty index pages vs structured specialties used by Pokémon',
      ),
      coverage('Items', itemSource, itemSource, 'typed item detail pages with provenance'),
      coverage('Furniture', furnitureSource, furnitureSource, 'item detail category table'),
      coverage('Recipes', recipeSource, recipes.length, 'item recipe tables vs parsed recipes'),
      coverage(
        'Recipe quantities',
        recipeSource,
        recipesWithKnownQuantities,
        'recipes whose every ingredient has a numeric quantity',
      ),
      coverage('Materials', materials, materials, 'unique parsed recipe ingredients'),
      coverage('Towns / areas', towns.length, towns.length, 'location detail pages'),
      coverage(
        'Environment levels',
        environmentLevels,
        environmentLevels,
        'distinct area and level pairs in shop unlock tables',
      ),
      coverage(
        'Abilities / Ditto moves',
        this.canonical ? this.countAbilityRows() : 0,
        this.listDittoMoves().length,
        'typed source move rows; not conflated with Pokémon specialties',
      ),
      coverage(
        'Quests / requests',
        this.listQuests().length,
        this.listQuests().length,
        'named Important Request sections with conservative narrative steps',
      ),
      coverage(
        'Treasure maps',
        this.listTreasureMaps().length,
        this.listTreasureMaps().length,
        'six source-backed Treasure Map sections',
      ),
      coverage(
        'Music CDs',
        this.listCollectibles().length,
        this.listCollectibles().length,
        '53 known table rows: 43 verified base game and 10 verified Expansion Pass',
      ),
    ];
  }

  listPokemon(limit = 48, offset = 0): readonly PokemonSummary[] {
    if (!this.pokemonCache) {
      const rows = this.statement(
        `${this.pageProjection()} WHERE category = 'pokedex' ORDER BY title`,
      ).all() as unknown as PageRow[];
      this.pokemonCache = rows
        .filter((row) => isDirectPokedexUrl(row.url))
        .map((row) => this.pokemonSummary(row));
    }
    return this.pokemonCache.slice(offset, offset + limit);
  }

  getPokemon(slug: string): PokemonDetail | null {
    const cached = this.pokemonDetails.get(slug);
    if (cached !== undefined) return cached;
    // Resolve through the listed Pokédex entries: a LIKE lookup treated `%`/`_` in user-supplied
    // slugs as wildcards and accepted nested non-Pokémon pages such as `specialty/build`.
    this.pokemonBySlug ??= indexBySlug(this.listPokemon(10_000));
    const summary = this.pokemonBySlug.get(slug);
    const detail = summary ? this.pokemonDetail(summary.source.url) : null;
    this.pokemonDetails.set(slug, detail);
    return detail;
  }

  private pokemonDetail(url: string): PokemonDetail | null {
    const urlColumn = this.canonical ? 'source_url' : 'url';
    const row = this.statement(
      `${this.pageProjection()} WHERE category = 'pokedex' AND ${urlColumn} = ? LIMIT 1`,
    ).get(url) as PageRow | undefined;
    if (!row) return null;
    const indexedRows = this.indexedTableRows(row.url);
    const tableRows = indexedRows.map((entry) => entry.cells);
    const statsHeaderIndex = tableRows.findIndex(
      (cells) => cells[0] === 'Specialty' && cells[1] === 'Ideal Habitat',
    );
    const stats = statsHeaderIndex >= 0 ? (tableRows[statsHeaderIndex + 1] ?? []) : [];
    const identityHeaderIndex = tableRows.findIndex(
      (cells) => cells[0] === 'Type' && cells[1] === 'Classification',
    );
    const identity = identityHeaderIndex >= 0 ? (tableRows[identityHeaderIndex + 1] ?? []) : [];
    const numberCell =
      tableRows.find((cells) => cells.some((cell) => /^#\d+\s/.test(cell)))?.[0] ?? '';
    const summary = this.pokemonSummary(row, stats, numberCell);
    const facts = this.facts(row.url);
    const locations = this.canonical
      ? this.cellLinks(row.url, 6, 4)
          .filter((link) => link.url.includes('/locations/'))
          .map((link) => link.text)
      : splitWords(
          (facts.find((fact) => fact.key.startsWith('Location :'))?.key ?? '').replace(
            /^Location\s*:\s*/,
            '',
          ),
        );
    const habitats = indexedRows
      .filter((entry) => entry.tableIndex === 6 && entry.rowIndex === 2)
      .flatMap((entry) => entry.cells)
      .filter(Boolean);
    return {
      ...summary,
      classification: identity[1] || null,
      height: identity[2] || null,
      weight: identity[3] || null,
      favorites: stats[2] ? splitWords(stats[2]) : [],
      canDive: stats[3]
        ? /underwater capable|^yes$/i.test(stats[3])
          ? true
          : /^no$/i.test(stats[3])
            ? false
            : null
        : null,
      locations: unique(locations),
      habitatTypes: unique(habitats),
      rawFacts: facts,
    };
  }

  listItems(limit = 48, offset = 0): readonly ItemSummary[] {
    if (!this.itemCache) this.itemCache = this.itemsOverview();
    return this.itemCache.slice(offset, offset + limit);
  }

  getItem(slug: string): ItemDetail | null {
    const cached = this.itemDetails.get(slug);
    if (cached !== undefined) return cached;
    const detail = this.itemDetail(slug);
    this.itemDetails.set(slug, detail);
    return detail;
  }

  private itemSummary(slug: string): ItemSummary | undefined {
    this.itemBySlug ??= indexBySlug(this.listItems(10_000));
    return this.itemBySlug.get(slug);
  }

  private itemDetail(slug: string): ItemDetail | null {
    const summary = this.itemSummary(slug);
    if (!summary) return null;
    const urlColumn = this.canonical ? 'source_url' : 'url';
    const row = this.statement(
      `${this.pageProjection()} WHERE category='items' AND ${urlColumn} = ? LIMIT 1`,
    ).get(summary.source.url) as PageRow | undefined;
    if (!row || !summary) return null;
    const rows = this.indexedTableRows(row.url);
    const value = (tableIndex: number, rowIndex: number, columnIndex = 0) =>
      rows.find((entry) => entry.tableIndex === tableIndex && entry.rowIndex === rowIndex)?.cells[
        columnIndex
      ] ?? '';
    const category = value(3, 2, 0) || summary.category;
    const favoriteCategories = splitWords(value(3, 4, 2));
    const description = value(6, 2, 0) || summary.description;
    const locationRow = rows.find((entry) => entry.tableIndex === 7 && entry.rowIndex === 2);
    const locationEntries = locationRow?.cells.filter(Boolean) ?? [];
    const recipe = this.recipeFromItemPage(row, rows);
    const storage = storageProfile(description, favoriteCategories);
    const automationRelevance = automationRelevanceFor(cleanTitle(row.title), description, storage);
    const useCases = unique([
      ...(storage?.type === 'shared' ? ['Acceso compartido entre unidades colocadas'] : []),
      ...(storage?.type === 'local' ? ['Almacenamiento local de objetos'] : []),
      ...(recipe ? ['Fabricable tras cumplir el desbloqueo registrado'] : []),
      ...(automationRelevance === 'direct' ? ['Componente de automatización o logística'] : []),
    ]);
    return {
      ...summary,
      name: cleanTitle(row.title),
      description,
      locations: locationEntries.join(' · ') || summary.locations,
      category,
      craftable: Boolean(recipe),
      isFurniture: category ? /^furniture$/i.test(category) : null,
      isContainer: storage ? true : favoriteCategories.length ? false : null,
      dlc: /expansion pass/i.test(`${locationEntries.join(' ')} ${recipe?.unlock ?? ''}`),
      automationRelevance,
      source: source(row, this.snapshot),
      requirements: value(3, 2, 3) || null,
      tradeValue: value(3, 4, 0) || null,
      printCost: value(3, 4, 1) || null,
      favoriteCategories,
      paintable: value(3, 2, 2) ? /paint/i.test(value(3, 2, 2)) : null,
      locationEntries,
      recipe,
      storage,
      useCases,
    };
  }

  listRecipes(limit = 48, offset = 0): readonly RecipeSummary[] {
    if (!this.recipeCache) {
      const row = this.statement(
        `${this.pageProjection()} WHERE category = 'crafting' LIMIT 1`,
      ).get() as PageRow | undefined;
      if (!row) return [];
      const recipes = new Map<string, RecipeSummary>();
      for (const current of this.tableRows(row.url)) {
        if (current.length !== 4 || !current[1] || current[1] === 'Name') continue;
        const ingredients = parseIngredients(current[3] ?? '');
        if (ingredients.length === 0) continue;
        const slug = toSlug(current[1]);
        recipes.set(slug, {
          kind: 'recipe',
          slug,
          name: current[1],
          unlock: current[2] || null,
          ingredients,
          outputQuantity: null,
          outputQuantityStatus: 'unknown',
          station: 'Workbench',
          source: source(row, this.snapshot),
        });
      }
      if (this.canonical) {
        const detailRows = this.db
          .prepare(
            `SELECT DISTINCT p.source_url AS url, p.title, p.category FROM pages p JOIN table_cells c ON c.page_id=p.id WHERE p.category='items' AND c.text='Recipe'`,
          )
          .all() as PageRow[];
        for (const detail of detailRows) {
          const slug = toSlug(cleanTitle(detail.title));
          if (recipes.has(slug)) continue;
          const parsed = this.recipeFromItemPage(detail, this.indexedTableRows(detail.url));
          if (parsed) recipes.set(parsed.slug, parsed);
        }
      }
      this.recipeCache = [...recipes.values()].sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.recipeCache.slice(offset, offset + limit);
  }

  getRecipe(slug: string): RecipeSummary | null {
    return (
      this.getItem(slug)?.recipe ??
      this.listRecipes(10_000).find((recipe) => recipe.slug === slug) ??
      null
    );
  }

  listTowns(): readonly TownSummary[] {
    if (!this.townCache) {
      const rows = this.statement(
        `${this.pageProjection()} WHERE category = 'locations' ORDER BY title`,
      ).all() as unknown as PageRow[];
      this.townCache = rows
        .filter((row) => row.url.includes('/locations/'))
        .map((row) => this.townDetailFromRow(row));
    }
    return this.townCache;
  }

  getTown(slug: string): TownDetail | null {
    // listTowns() already projects every town as a TownDetail; an exact lookup also avoids
    // treating `%`/`_` in user-supplied slugs as LIKE wildcards.
    if (!this.townBySlug) {
      this.listTowns();
      this.townBySlug = indexBySlug(this.townCache ?? []);
    }
    return this.townBySlug.get(slug) ?? null;
  }

  listAutomationSystems(): readonly AutomationSystem[] {
    this.automationCache ??= this.automationSystems();
    return this.automationCache;
  }

  private automationSystems(): readonly AutomationSystem[] {
    const quantitative = this.listQuantitativeParameters();
    const itemSystems = this.listItems(10_000)
      .filter((item) => item.automationRelevance === 'direct')
      .map((item) => this.getItem(item.slug))
      .filter((item): item is ItemDetail => Boolean(item))
      .filter((item) => item.automationRelevance === 'direct')
      .slice(0, 24)
      .map((item) => {
        const unlockTown = item.recipe?.unlock?.match(/Shop\s*-\s*(.+?)\s+Lv\./i)?.[1];
        const locationTowns = item.locationEntries.flatMap((entry) =>
          this.listTowns()
            .filter((town) => entry.includes(town.name))
            .map((town) => town.name),
        );
        const mechanics = automationMechanics(item.description, item.storage);
        return {
          kind: 'automation' as const,
          slug: item.slug,
          name: item.name,
          what: item.description ?? 'Behavior is not described in the current source snapshot.',
          why:
            item.storage?.type === 'shared'
              ? 'Conecta el acceso al inventario entre varias unidades colocadas.'
              : 'La descripción o el nombre registran un comportamiento mecánico o automático.',
          requirements: item.recipe?.ingredients ?? [],
          pokemon: null,
          infrastructure: mechanics.infrastructure,
          operationalInputs: mechanics.inputs,
          operationalOutputs: mechanics.outputs,
          unlock: item.recipe?.unlock ?? null,
          compatibleTowns: unique([...(unlockTown ? [unlockTown] : []), ...locationTowns]),
          limitations: unique([
            ...(item.storage?.capacity === null
              ? ['La capacidad de almacenamiento es desconocida en el snapshot.']
              : []),
            ...(!item.recipe ? ['No hay una receta estructurada enlazada.'] : []),
            'El efecto del diseño del pueblo y el rendimiento no están documentados.',
          ]),
          knownState: 'source_backed' as const,
          contentScope: item.dlc === true ? ('expansion' as const) : ('unknown' as const),
          gameVersion: null,
          quantitative: quantitative.filter((entry) => entry.subjectSlug === item.slug),
          source: item.source,
        };
      });
    return uniqueBy(
      [...itemSystems, ...this.buildKitAutomationSystems(quantitative)],
      (entry) => entry.slug,
    );
  }

  listQuantitativeParameters(): readonly QuantitativeParameter[] {
    this.quantitativeCache ??= this.quantitativeParameters();
    return this.quantitativeCache;
  }

  private quantitativeParameters(): readonly QuantitativeParameter[] {
    if (!this.canonical || !this.hasTable('quantitative_assertions')) return [];
    const rows = this.statement(
      `SELECT q.*, p.title FROM quantitative_assertions q
         JOIN pages p ON p.source_url=q.source_url
         ORDER BY q.subject_kind,q.subject_slug,q.predicate,q.qualifier`,
    ).all() as QuantitativeRow[];
    return rows.map((row) => ({
      id: row.id,
      subjectKind: row.subject_kind,
      subjectSlug: row.subject_slug,
      predicate: row.predicate,
      value: Number(row.value),
      unit: row.unit,
      qualifier: row.qualifier,
      derivation: row.derivation,
      parentAssertionIds: parseStringArray(row.parent_assertion_ids_json),
      locator: row.locator,
      evidenceText: row.evidence_text,
      parserConfidence: Number(row.parser_confidence),
      evidenceConfidence: Number(row.evidence_confidence),
      sourceVerificationStatus: row.source_verification_status,
      assertionStatus: row.assertion_status,
      contentScope: row.content_scope,
      gameVersion: row.game_version,
      source: {
        url: row.source_url,
        title: row.title,
        snapshot: this.snapshot,
        verificationStatus: row.source_verification_status,
      },
    }));
  }

  listQuests(filter: ContentFilter = {}): readonly QuestSummary[] {
    if (!this.canonical) return [];
    if (!this.questCache) {
      const row = this.pageBySuffix('importantrequests.shtml', 'requests');
      if (!row) return [];
      const rows = this.indexedTableRows(row.url).filter((entry) => entry.tableIndex === 1);
      const classification = unknownClassification(row, this.snapshot);
      this.questCache = rows
        .filter((entry) => entry.rowIndex >= 3 && entry.rowIndex % 2 === 1 && entry.cells[0])
        .map((heading) => {
          const narrative =
            rows.find((entry) => entry.rowIndex === heading.rowIndex + 1)?.cells[0] ?? '';
          const blocks = narrative
            .split(/\n+/)
            .map((value) => value.trim())
            .filter(Boolean);
          return {
            kind: 'quest' as const,
            slug: toSlug(heading.cells[0] ?? ''),
            name: heading.cells[0] ?? '',
            description: narrative,
            steps: blocks.map((description, index) => ({
              order: index + 1,
              description,
              requirement: null,
            })),
            repeatable: null,
            rewards: [],
            unlocks: [],
            classification,
            source: source(row, this.snapshot),
          };
        });
    }
    return filterByScope(this.questCache, filter);
  }

  getQuest(slug: string): QuestDetail | null {
    return this.listQuests().find((entry) => entry.slug === slug) ?? null;
  }

  listTreasureMaps(filter: ContentFilter = {}): readonly TreasureMapSummary[] {
    if (!this.canonical) return [];
    if (!this.treasureMapCache) {
      const row = this.pageBySuffix('treasuremaps.shtml', 'treasure-maps');
      if (!row) return [];
      const rows = this.indexedTableRows(row.url).filter((entry) => entry.tableIndex === 1);
      const classification = unknownClassification(row, this.snapshot);
      this.treasureMapCache = rows
        .filter((entry) => /^Map \d+\s+-\s+/.test(entry.cells[0] ?? ''))
        .map((heading) => {
          const match = (heading.cells[0] ?? '').match(/^Map (\d+)\s+-\s+(.+)$/);
          const number = Number(match?.[1] ?? 0);
          const ball = match?.[2] ?? 'Unknown Ball';
          const rewardName = `Decorative ${ball}`;
          const narrative =
            rows.find((entry) => entry.rowIndex === heading.rowIndex + 1)?.cells[0] ?? '';
          return {
            kind: 'treasure_map' as const,
            slug: `treasure-map-${number}`,
            name: heading.cells[0] ?? `Map ${number}`,
            number,
            area: 'Bubbly Basin',
            location: narrative,
            requirements: [
              { name: 'Dowsing Machine', slug: 'dowsing-machine', kind: 'item' as const },
              { name: 'Search specialty', slug: 'search', kind: 'specialty' as const },
            ],
            reward: { name: rewardName, slug: toSlug(rewardName) },
            recipeUnlock: { name: `${rewardName} recipe`, slug: toSlug(rewardName) },
            qualityWarnings:
              number === 6 && /^Treasure Map #5\b/.test(narrative)
                ? ['The Map 6 source paragraph identifies itself as Treasure Map #5.']
                : [],
            classification,
            source: source(row, this.snapshot),
          };
        });
    }
    return filterByScope(this.treasureMapCache, filter);
  }

  getTreasureMap(slug: string): TreasureMapDetail | null {
    return this.listTreasureMaps().find((entry) => entry.slug === slug) ?? null;
  }

  listCollectibles(filter: ContentFilter = {}): readonly CollectibleSummary[] {
    if (!this.canonical) return [];
    if (!this.collectibleCache) {
      const row = this.pageBySuffix('cds.shtml');
      if (!row) return [];
      this.collectibleCache = this.indexedTableRows(row.url)
        .filter((entry) => entry.tableIndex === 2 && entry.rowIndex > 1)
        .flatMap((entry): CollectibleSummary[] => {
          const [picture, name, description, locations, originGame] = entry.cells;
          void picture;
          const catalogNumber = Number(description?.match(/Music CD #(\d+)/)?.[1] ?? 0);
          if (!name || !catalogNumber) return [];
          const expansion = /Requires Expansion Pass/i.test(locations ?? '');
          const classification: ContentClassification = {
            scope: expansion ? 'expansion' : 'base_game',
            status: 'verified',
            reason: expansion
              ? 'The row explicitly says Requires Expansion Pass.'
              : 'The source introduction states 43 base-game CDs; this is one of rows 1–43.',
            source: source(row, this.snapshot),
          };
          return [
            {
              kind: 'collectible',
              collectibleType: 'music_cd',
              slug: `music-cd-${catalogNumber}`,
              name,
              catalogNumber,
              description: description ?? '',
              locations: locations ?? '',
              originGame: originGame ?? '',
              classification,
              source: source(row, this.snapshot),
            },
          ];
        });
    }
    return filterByScope(this.collectibleCache, filter);
  }

  getCollectible(slug: string): CollectibleDetail | null {
    return this.listCollectibles().find((entry) => entry.slug === slug) ?? null;
  }

  listDittoMoves(filter: ContentFilter = {}): readonly DittoMoveSummary[] {
    if (!this.canonical) return [];
    if (!this.dittoMoveCache) {
      const row = this.pageBySuffix('abilities.shtml', 'abilities');
      if (!row) return [];
      const mealBoosts = new Map(
        this.indexedTableRows(row.url)
          .filter((entry) => entry.tableIndex === 2 && entry.rowIndex > 1)
          .map((entry) => [
            entry.cells[1] ?? '',
            { meal: entry.cells[0] ?? '', effect: entry.cells[2] ?? '' },
          ]),
      );
      let moveClass: DittoMoveSummary['moveClass'] = 'primary';
      const moves: DittoMoveSummary[] = [];
      for (const entry of this.indexedTableRows(row.url).filter(
        (value) => value.tableIndex === 3,
      )) {
        const label = entry.cells[0] ?? '';
        if (label === 'Primary Moves') {
          moveClass = 'primary';
          continue;
        }
        if (label === 'Secondary Moves') {
          moveClass = 'secondary';
          continue;
        }
        const name = entry.cells[1] ?? '';
        if (!name || name === 'Move') continue;
        const unlock = entry.cells[3] ?? '';
        moves.push({
          kind: 'ditto_move',
          slug: toSlug(name),
          name,
          moveClass,
          effect: entry.cells[2] ?? '',
          unlock,
          learnedFromPokemon: pokemonFromUnlock(unlock),
          mealBoost: mealBoosts.get(name) ?? null,
          classification: unknownClassification(row, this.snapshot),
          source: source(row, this.snapshot),
        });
      }
      this.dittoMoveCache = moves;
    }
    return filterByScope(this.dittoMoveCache, filter);
  }

  getDittoMove(slug: string): DittoMoveDetail | null {
    return this.listDittoMoves().find((entry) => entry.slug === slug) ?? null;
  }

  search(query: string, limit = 24): readonly SearchRecord[] {
    const safe = query
      .trim()
      .split(/\s+/)
      .map((token) => `"${token.replaceAll('"', '""')}"`)
      .join(' AND ');
    if (!safe) return [];
    try {
      const rows = (this.canonical
        ? this.statement(
            `SELECT c.source_url, f.title, f.category, snippet(rag_fts, 3, '', '', ' … ', 18) AS excerpt, bm25(rag_fts) AS score FROM rag_fts f JOIN rag_chunks c ON c.id = f.id WHERE rag_fts MATCH ? ORDER BY score LIMIT ?`,
          ).all(safe, limit)
        : this.statement(
            `SELECT source_url, title, category, snippet(chunks_fts, 4, '', '', ' … ', 18) AS excerpt, bm25(chunks_fts) AS score FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY score LIMIT ?`,
          ).all(safe, limit)) as unknown as SearchRow[];
      return deduplicateSearch(rows).map((row) => ({
        kind: kindFromRecord(row.category, row.source_url),
        slug: slugForRecord(row.category, row.source_url, row.title),
        title: cleanTitle(row.title),
        excerpt: row.excerpt,
        url: row.source_url,
        rank: Math.abs(Number(row.score)),
      }));
    } catch {
      const sourceColumn = this.canonical ? 'source_url' : 'url';
      const rows = this.statement(
        `SELECT ${sourceColumn} AS source_url, title, category, title AS excerpt, 1 AS score FROM pages WHERE title LIKE ? ESCAPE '\\' ORDER BY title LIMIT ?`,
      ).all(`%${escapeLike(query.trim())}%`, limit) as unknown as SearchRow[];
      return deduplicateSearch(rows).map((row) => ({
        kind: kindFromRecord(row.category, row.source_url),
        slug: slugForRecord(row.category, row.source_url, row.title),
        title: cleanTitle(row.title),
        excerpt: row.excerpt,
        url: row.source_url,
        rank: 1,
      }));
    }
  }

  private pokemonSummary(row: PageRow, stats?: string[], numberCell?: string): PokemonSummary {
    const detailRows = stats ? [] : this.tableRows(row.url);
    const headerIndex = stats
      ? -1
      : detailRows.findIndex((cells) => cells[0] === 'Specialty' && cells[1] === 'Ideal Habitat');
    const resolvedStats = stats ?? (headerIndex >= 0 ? (detailRows[headerIndex + 1] ?? []) : []);
    const resolvedNumberCell =
      numberCell ??
      detailRows.find((cells) => cells.some((cell) => /^#\d+\s/.test(cell)))?.[0] ??
      '';
    const evidence = source(row, this.snapshot);
    return {
      kind: 'pokemon',
      slug: slugFromUrl(row.url),
      name: cleanTitle(row.title),
      number: Number(resolvedNumberCell.match(/^#(\d+)/)?.[1]) || null,
      specialty: resolvedStats[0] || null,
      habitat: resolvedStats[1] || null,
      roles: rolesForSpecialty(resolvedStats[0] || null, evidence),
      source: evidence,
    };
  }

  private itemsOverview(): readonly ItemSummary[] {
    const urlColumn = this.canonical ? 'source_url' : 'url';
    const row = this.statement(
      `${this.pageProjection()} WHERE ${urlColumn} LIKE '%/pokemonpokopia/items.shtml' LIMIT 1`,
    ).get() as PageRow | undefined;
    if (!row) return [];
    const detailRows = this.statement(
      `${this.pageProjection()} WHERE category='items' AND ${urlColumn} LIKE '%/items/%' ORDER BY title`,
    ).all() as unknown as PageRow[];
    const rows = this.tableRows(row.url);
    const headerIndex = rows.findIndex(
      (cells) => cells[1] === 'Name' && cells[2] === 'Description' && cells[4] === 'Locations',
    );
    const overview = new Map<string, string[]>();
    for (const cells of rows.slice(headerIndex + 1)) {
      if (cells.length !== 5 || cells[0] || !cells[1] || cells[1] === 'Name' || !cells[2]) continue;
      overview.set(toSlug(cells[1]), cells);
    }
    const summaries = new Map<string, ItemSummary>();
    for (const detail of detailRows) {
      const name = cleanTitle(detail.title);
      const baseSlug = toSlug(name);
      const slug = summaries.has(baseSlug)
        ? `${baseSlug}-${toSlug(slugFromUrl(detail.url))}`
        : baseSlug;
      const cells = overview.get(baseSlug);
      const description = cells?.[2] || null;
      const storage = storageProfile(description, []);
      summaries.set(slug, {
        kind: 'item',
        slug,
        name,
        description,
        locations: cells?.[4] || null,
        category: null,
        craftable: /craft from recipe/i.test(cells?.[4] ?? '') ? true : null,
        isFurniture: null,
        isContainer: storage ? true : null,
        dlc: /expansion pass/i.test(cells?.join(' ') ?? '') ? true : null,
        automationRelevance: automationRelevanceFor(name, description, storage),
        source: source(detail, this.snapshot),
      });
    }
    return [...summaries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private recipeFromItemPage(row: PageRow, rows: readonly IndexedRow[]): RecipeSummary | null {
    const recipeTitle = rows.find((entry) => entry.cells[0] === 'Recipe');
    if (!recipeTitle) return null;
    const recipeTable = recipeTitle.tableIndex;
    const unlock = rows.find((entry) => entry.tableIndex === recipeTable && entry.rowIndex === 2)
      ?.cells[1];
    const rawIngredients = rows
      .filter((entry) => entry.tableIndex === recipeTable + 1)
      .flatMap((entry) => entry.cells)
      .filter(Boolean)
      .join('');
    const fallback = rows
      .find((entry) => entry.tableIndex === recipeTable && entry.rowIndex === 3)
      ?.cells.join('');
    const ingredients = parseIngredients(rawIngredients || fallback || '');
    if (!ingredients.length) return null;
    return {
      kind: 'recipe',
      slug: toSlug(cleanTitle(row.title)),
      name: cleanTitle(row.title),
      unlock: unlock || null,
      ingredients,
      outputQuantity: null,
      outputQuantityStatus: 'unknown',
      station: 'Workbench',
      source: source(row, this.snapshot),
    };
  }

  private townDetailFromRow(row: PageRow): TownDetail {
    const rows = this.indexedTableRows(row.url);
    const tableValues = (tableIndex: number) =>
      unique(
        rows
          .filter((entry) => entry.tableIndex === tableIndex)
          .flatMap((entry) => entry.cells)
          .map((value) => value.trim())
          .filter(
            (value) =>
              value &&
              !/^quantity:/i.test(value) &&
              !/^(picture|name|level|list of exclusive pok[eé]mon)$/i.test(value),
          ),
      );
    const exclusiveTable = rows.find((entry) =>
      entry.cells.some((value) => /^list of exclusive pok[eé]mon$/i.test(value)),
    )?.tableIndex;
    const unlockTable = rows.find(
      (entry) =>
        entry.cells.some((value) => /^picture$/i.test(value)) &&
        entry.cells.some((value) => /^name$/i.test(value)) &&
        entry.cells.some((value) => /^level$/i.test(value)),
    )?.tableIndex;
    const unlocks = rows
      .filter((entry) => entry.cells.length >= 3 && /^Lv\.\s*\d+/i.test(entry.cells[2] ?? ''))
      .map((entry) => ({
        name: (entry.cells[1] ?? '').replace(/\s+Recipe$/i, ''),
        level: Number(entry.cells[2]?.match(/\d+/)?.[0]),
        kind: /Recipe$/i.test(entry.cells[1] ?? '') ? ('recipe' as const) : ('item' as const),
      }))
      .filter((entry) => entry.name && entry.level > 0);
    return {
      kind: 'town',
      slug: slugFromUrl(row.url),
      name: cleanTitle(row.title),
      description:
        rows.find((entry) => entry.tableIndex === 1 && entry.rowIndex === 2)?.cells[0] || null,
      maxEnvironmentLevel: unlocks.length
        ? Math.max(...unlocks.map((unlock) => unlock.level))
        : null,
      exclusivePokemon: exclusiveTable ? tableValues(exclusiveTable) : [],
      resources: unlockTable && unlockTable >= 8 ? tableValues(unlockTable - 5) : [],
      plantsAndBlocks: unlockTable && unlockTable >= 8 ? tableValues(unlockTable - 4) : [],
      facilities:
        unlockTable && unlockTable >= 8
          ? unique([...tableValues(unlockTable - 3), ...tableValues(unlockTable - 2)])
          : [],
      treasure: unlockTable && unlockTable >= 8 ? tableValues(unlockTable - 1) : [],
      unlocks,
      source: source(row, this.snapshot),
    };
  }

  private indexedTableRows(url: string): IndexedRow[] {
    if (this.canonical) {
      const cells = this.statement(
        `SELECT c.table_index, c.row_index, c.column_index, c.text FROM table_cells c JOIN pages p ON p.id = c.page_id WHERE p.source_url = ? ORDER BY c.table_index, c.row_index, c.column_index`,
      ).all(url) as unknown as {
        table_index: number;
        row_index: number;
        column_index: number;
        text: string;
      }[];
      const grouped = new Map<string, IndexedRow>();
      for (const cell of cells) {
        const key = `${cell.table_index}:${cell.row_index}`;
        const existing = grouped.get(key) ?? {
          tableIndex: cell.table_index,
          rowIndex: cell.row_index,
          cells: [],
        };
        existing.cells[cell.column_index - 1] = cell.text;
        grouped.set(key, existing);
      }
      return [...grouped.values()];
    }
    const rows = this.statement(
      'SELECT source_url, title, category, table_index, row_index, cells_json FROM table_rows WHERE source_url = ? ORDER BY table_index, row_index',
    ).all(url) as unknown as TableRow[];
    return rows.map((entry) => ({
      tableIndex: entry.table_index,
      rowIndex: entry.row_index,
      cells: parseCells(entry.cells_json),
    }));
  }

  private tableRows(url: string): string[][] {
    return this.indexedTableRows(url).map((row) => row.cells);
  }

  private cellLinks(url: string, tableIndex: number, rowIndex: number): CellLink[] {
    if (!this.canonical) return [];
    const rows = this.statement(
      `SELECT c.links_json FROM table_cells c JOIN pages p ON p.id=c.page_id WHERE p.source_url=? AND c.table_index=? AND c.row_index=?`,
    ).all(url, tableIndex, rowIndex) as { links_json: string }[];
    return uniqueBy(
      rows.flatMap((row) => parseLinks(row.links_json)),
      (entry) => `${entry.url}:${entry.text}`,
    );
  }

  private facts(url: string): { key: string; value: string }[] {
    // facts.source_url is not indexed in shipped databases, so a per-page query scans the whole
    // table. Group every fact once instead; the table is small and the database is read-only.
    if (!this.factsBySource) {
      const grouped = new Map<string, FactRow[]>();
      const rows = this.statement(
        'SELECT source_url, key, value FROM facts ORDER BY source_url, table_index, row_index',
      ).all() as unknown as (FactRow & { source_url: string })[];
      for (const { source_url: sourceUrl, key, value } of rows) {
        const existing = grouped.get(sourceUrl);
        if (existing) existing.push({ key, value });
        else grouped.set(sourceUrl, [{ key, value }]);
      }
      this.factsBySource = grouped;
    }
    return [...(this.factsBySource.get(url) ?? [])];
  }

  private pageBySuffix(suffix: string, category?: string): PageRow | null {
    const urlColumn = this.canonical ? 'source_url' : 'url';
    const row = this.statement(
      `${this.pageProjection()} WHERE ${urlColumn} LIKE ?${category ? ' AND category = ?' : ''} LIMIT 1`,
    ).get(...(category ? [`%/${suffix}`, category] : [`%/${suffix}`])) as PageRow | undefined;
    return row ?? null;
  }

  private scalar(sql: string): number {
    return Number((this.statement(sql).get() as { value: number }).value);
  }

  private hasTable(name: string): boolean {
    return Boolean(
      this.statement("SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").get(name),
    );
  }

  private buildKitAutomationSystems(
    quantitative: readonly QuantitativeParameter[],
  ): AutomationSystem[] {
    if (!this.canonical) return [];
    const specs = [
      { path: 'windmillkit', slug: 'windmill-kit', output: 'Electricidad' },
      { path: 'waterwheelkit', slug: 'waterwheel-kit', output: 'Electricidad' },
      { path: 'furnacekit', slug: 'furnace-kit', output: 'Electricidad' },
      {
        path: 'chargingstationkit',
        slug: 'charging-station-kit',
        output: 'Lectura de electricidad conectada',
      },
    ] as const;
    return specs.flatMap((spec) => {
      const row = this.pageBySuffix(`build/${spec.path}.shtml`);
      if (!row) return [];
      const rows = this.indexedTableRows(row.url);
      const name = rows.find((entry) => entry.tableIndex === 1 && entry.rowIndex === 1)?.cells[0];
      const description = rows.find((entry) => entry.tableIndex === 1 && entry.rowIndex === 4)
        ?.cells[0];
      const materials = rows.find((entry) => entry.tableIndex === 2 && entry.rowIndex === 2)
        ?.cells[0];
      const workerText = rows.find((entry) => entry.tableIndex === 2 && entry.rowIndex === 2)
        ?.cells[1];
      const workerCount = Number(workerText?.match(/(\d+)\s*Pokémon/i)?.[1] ?? 0);
      const requirements = parseNamedQuantities(materials ?? '');
      const quantitativeSubjectSlugs =
        spec.slug === 'charging-station-kit'
          ? new Set([spec.slug, 'charging-station'])
          : new Set([spec.slug]);
      const systemQuantitative = quantitative.filter((entry) =>
        quantitativeSubjectSlugs.has(entry.subjectSlug),
      );
      return [
        {
          kind: 'automation' as const,
          slug: spec.slug,
          name: name || spec.slug,
          what: description || 'Behavior is not described in the current source snapshot.',
          why:
            spec.slug === 'charging-station-kit'
              ? 'Muestra cuánta electricidad está conectada al circuito.'
              : 'Genera electricidad con una capacidad explícita en la fuente.',
          requirements,
          pokemon: workerCount > 0 ? [`Build ×${workerCount}`] : null,
          infrastructure: spec.slug === 'waterwheel-kit' ? ['Agua'] : null,
          operationalInputs:
            spec.slug === 'furnace-kit'
              ? ['Combustible (tipo y consumo desconocidos)']
              : spec.slug === 'waterwheel-kit'
                ? ['Agua']
                : null,
          operationalOutputs: [spec.output],
          unlock: null,
          compatibleTowns: [],
          limitations: unique([
            ...(spec.slug === 'furnace-kit'
              ? ['Requiere renovación; el combustible y la duración siguen unknown.']
              : []),
            'Compatibilidad por pueblo no documentada; la lista vacía no significa incompatibilidad.',
          ]),
          knownState: 'source_backed' as const,
          contentScope: 'unknown' as const,
          gameVersion: null,
          quantitative: systemQuantitative,
          source: source(row, this.snapshot),
        },
      ];
    });
  }

  private countAbilityRows(): number {
    return this.scalar(
      "SELECT count(DISTINCT c.row_index) AS value FROM table_cells c JOIN pages p ON p.id=c.page_id WHERE p.category='abilities' AND c.table_index=3 AND c.column_index=2 AND c.text NOT IN ('Move','')",
    );
  }

  private statement(sql: string): Database.Statement {
    let prepared = this.statements.get(sql);
    if (!prepared) {
      prepared = this.db.prepare(sql);
      this.statements.set(sql, prepared);
    }
    return prepared;
  }

  private pageProjection(): string {
    return this.canonical
      ? 'SELECT source_url AS url, title, category FROM pages'
      : 'SELECT url, title, category FROM pages';
  }
}

function toSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function unknownClassification(row: PageRow, snapshot: string): ContentClassification {
  return {
    scope: 'unknown',
    status: 'unknown',
    reason: 'The current source snapshot does not assign this content to base game or expansion.',
    source: source(row, snapshot),
  };
}

function filterByScope<T extends { classification: ContentClassification }>(
  values: readonly T[],
  filter: ContentFilter,
): readonly T[] {
  return !filter.scope || filter.scope === 'all'
    ? values
    : values.filter((value) => value.classification.scope === filter.scope);
}

function pokemonFromUnlock(unlock: string): string[] {
  return unique(
    [...unlock.matchAll(/befriend\s+(.+?)(?=\s+in\s+|\s+and\s+|,|$)/gi)]
      .map((match) => match[1]?.trim() ?? '')
      .filter(Boolean),
  );
}

function isDirectPokedexUrl(url: string): boolean {
  const suffix = url.split('/pokedex/')[1];
  return Boolean(suffix && !suffix.includes('/'));
}

function parseIngredients(
  value: string,
): { name: string; slug: string; quantity: number | null }[] {
  const matches = [...value.matchAll(/([^*]+?)\s*\*\s*(\d+)/g)];
  const parsed = matches.map((match) => {
    const name = match[1]?.trim() ?? 'Unknown';
    return { name, slug: toSlug(name), quantity: Number(match[2]) || null };
  });
  if (parsed.length || !value.includes('*')) return parsed;
  const name = value.split('*')[0]?.trim();
  return name ? [{ name, slug: toSlug(name), quantity: null }] : [];
}

function specialtyTokens(value: string): string[] {
  const tokens: string[] = [];
  let remaining = value.replace(/[^A-Za-z]/g, '');
  while (remaining) {
    const match = KNOWN_SPECIALTIES.find((specialty) => remaining.startsWith(specialty));
    if (!match) break;
    tokens.push(match);
    remaining = remaining.slice(match.length);
  }
  return tokens;
}

function rolesForSpecialty(
  specialty: string | null,
  evidenceSource: SourceEvidence,
): readonly RoleAssignment[] {
  if (!specialty) return [];
  const assignments = specialtyTokens(specialty).flatMap((token) => {
    const mapped = SPECIALTY_ROLES[token] ?? [{ role: 'specialist' as const, confidence: 0.65 }];
    return mapped.map(({ role, confidence }) => ({
      role,
      evidence: `Structured specialty: ${token}`,
      confidence,
      derivationMethod: 'specialty_mapping_v1' as const,
      gameVersion: null,
      source: evidenceSource,
    }));
  });
  return uniqueBy(assignments, (entry) => entry.role);
}

function storageProfile(
  description: string | null,
  favoriteCategories: readonly string[],
): ItemDetail['storage'] {
  const text = description ?? '';
  const tagged = favoriteCategories.some((category) => /container/i.test(category));
  if (/retrieved from any of these machines/i.test(text))
    return { type: 'shared', capacity: null, evidence: text };
  if (tagged || /store items|fit lots of stuff inside/i.test(text))
    return { type: 'local', capacity: null, evidence: text || null };
  return null;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseNamedQuantities(value: string): RecipeIngredient[] {
  const entries: RecipeIngredient[] = [];
  const pattern = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'’-]*?)(\d+)(?=[A-ZÀ-Þ]|$)/g;
  for (const match of value.matchAll(pattern)) {
    const name = match[1]?.trim();
    const quantity = Number(match[2]);
    if (!name || !Number.isSafeInteger(quantity) || quantity < 1) continue;
    entries.push({ name, slug: toSlug(name), quantity });
  }
  return entries;
}

export function automationRelevanceFor(
  name: string,
  description: string | null,
  storage: ItemDetail['storage'],
): ItemSummary['automationRelevance'] {
  if (
    storage?.type === 'shared' ||
    /automatic|automatically|all on its own|activates nearby machinery|sprays water in a wide area|creates bubbles when powered on|connect electrical generators to machines|connect these to electrical generators/i.test(
      `${name} ${description ?? ''}`,
    )
  )
    return 'direct';
  if (storage || /machine|generator|sprinkler/i.test(`${name} ${description ?? ''}`))
    return 'related';
  return 'unknown';
}

function automationMechanics(
  description: string | null,
  storage: ItemDetail['storage'],
): {
  infrastructure: readonly string[] | null;
  inputs: readonly string[] | null;
  outputs: readonly string[] | null;
} {
  const text = description ?? '';
  const infrastructure = unique([
    ...(/electricity|powered on|electrical generators/i.test(text) ? ['Suministro eléctrico'] : []),
    ...(/nearby machinery/i.test(text) ? ['Maquinaria cercana'] : []),
  ]);
  const inputs = unique([
    ...(storage?.type === 'shared' ? ['Objetos almacenados'] : []),
    ...(/detects weight/i.test(text) ? ['Peso detectado'] : []),
    ...(/hooked up to electricity|connect this to electricity|connect electrical generators|connect these to electrical generators/i.test(
      text,
    )
      ? ['Electricidad']
      : []),
  ]);
  const outputs = unique([
    ...(storage?.type === 'shared' ? ['Acceso compartido a objetos'] : []),
    ...(/generate electricity/i.test(text) ? ['Electricidad'] : []),
    ...(/creates bubbles/i.test(text) ? ['Burbujas'] : []),
    ...(/sprays water/i.test(text) ? ['Riego de área amplia'] : []),
    ...(/activates nearby machinery/i.test(text) ? ['Activación de maquinaria cercana'] : []),
    ...(/turn things on or off/i.test(text) ? ['Control de encendido y apagado'] : []),
    ...(/function automatically/i.test(text) ? ['Apertura y cierre automáticos'] : []),
    ...(/send electricity over long distances/i.test(text) ? ['Transmisión eléctrica'] : []),
  ]);
  return {
    infrastructure: infrastructure.length ? infrastructure : null,
    inputs: inputs.length ? inputs : null,
    outputs: outputs.length ? outputs : null,
  };
}

function coverage(
  domain: string,
  totalSource: number,
  totalCanonicalized: number,
  basis: string,
): CoverageEntry {
  return {
    domain,
    totalSource,
    totalCanonicalized,
    totalUnresolved: Math.max(0, totalSource - totalCanonicalized),
    coveragePercent: percent(totalCanonicalized, totalSource),
    basis,
  };
}

function kindFromRecord(category: string, url: string): SearchRecord['kind'] {
  if (category === 'pokedex' && isDirectPokedexUrl(url)) return 'pokemon';
  if (category === 'items' && url.includes('/items/')) return 'item';
  if (category === 'crafting') return 'page';
  if (category === 'locations' && url.includes('/locations/')) return 'town';
  if (category === 'abilities') return 'ability';
  if (category === 'requests') return 'quest';
  return 'page';
}

function slugForRecord(category: string, url: string, title: string): string {
  return category === 'items' && url.includes('/items/')
    ? toSlug(cleanTitle(title))
    : slugFromUrl(url);
}

function deduplicateSearch<T extends { source_url: string }>(rows: readonly T[]): T[] {
  // Rows arrive best-ranked first; keep the first chunk per page instead of the last (worst) one.
  const best = new Map<string, T>();
  for (const row of rows) if (!best.has(row.source_url)) best.set(row.source_url, row);
  return [...best.values()];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function indexBySlug<T extends { slug: string }>(values: readonly T[]): ReadonlyMap<string, T> {
  const index = new Map<string, T>();
  for (const value of values) if (!index.has(value.slug)) index.set(value.slug, value);
  return index;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}
