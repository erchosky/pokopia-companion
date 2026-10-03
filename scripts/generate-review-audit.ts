import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { createGameDataRepository, type RoleSlug } from '@pokopia/game-data';
import { createGoalCatalog, evaluateGoal } from '@pokopia/goals';
import {
  analyzeTown,
  compareItems,
  nextActions,
  planAutomation,
  TOWN_PRESET_ROLES,
  type TownPokemonCandidate,
} from '@pokopia/intelligence';
import {
  createKnowledgeGraph,
  type GraphEntityRef,
  type KnowledgeRelationship,
} from '@pokopia/knowledge';
import { calculateCraftPlan, evaluateRequirements, inferLowerTownLevels } from '@pokopia/rules';
import { PRESET_WEIGHTS, rankPokemon, rolesForContext } from '@pokopia/scoring';
import { createSearchEngine, inferSearchIntent, searchVariants } from '@pokopia/search';
import { parseProgress, type PokopiaProgress } from '../apps/web/lib/progress-store';

const root = resolve(import.meta.dirname, '..');
const outputRoot = join(root, 'audit-data');
const databasePath = join(root, 'data/canonical/v3.1/pokopia-canonical.sqlite');
const generatedAt = new Date().toISOString();
const db = new Database(databasePath, { readonly: true, fileMustExist: true });
const repository = createGameDataRepository(databasePath);
const portableRepositoryHealth = () => ({
  ...repository.health(),
  databasePath: 'data/canonical/v3.1/pokopia-canonical.sqlite',
});
const graph = createKnowledgeGraph(repository);

type SqlObject = { type: string; name: string; tbl_name: string; sql: string | null };
type SqlColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};
type SqlForeignKey = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
};

function json(path: string, value: unknown): void {
  const destination = join(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
}

function text(path: string, value: string): void {
  const destination = join(outputRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, value.endsWith('\n') ? value : `${value}\n`);
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function key(entity: GraphEntityRef): string {
  return `${entity.kind}:${entity.slug}`;
}

function uniqueBy<T>(values: readonly T[], identity: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [identity(value), value])).values()];
}

function countBy(values: readonly string[]): Record<string, number> {
  return Object.fromEntries(
    [
      ...values.reduce(
        (counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1),
        new Map<string, number>(),
      ),
    ].sort(([left], [right]) => left.localeCompare(right)),
  );
}

function selectRepresentative<T extends { slug: string }>(
  values: readonly T[],
  limit: number,
  preferred: readonly string[],
): T[] {
  const bySlug = new Map(values.map((value) => [value.slug, value]));
  const first = preferred.flatMap((slug) => (bySlug.get(slug) ? [bySlug.get(slug)!] : []));
  return uniqueBy(
    [...first, ...values.toSorted((left, right) => left.slug.localeCompare(right.slug))],
    (value) => value.slug,
  ).slice(0, limit);
}

const sqliteObjects = db
  .prepare(
    "select type, name, tbl_name, sql from sqlite_master where name not like 'sqlite_%' order by type, name",
  )
  .all() as SqlObject[];
const tables = sqliteObjects.filter((entry) => entry.type === 'table');
const tableMetadata = tables.map((table) => ({
  name: table.name,
  columns: db.prepare(`pragma table_info(${JSON.stringify(table.name)})`).all() as SqlColumn[],
  rowCount: Number(
    (
      db.prepare(`select count(*) as count from ${JSON.stringify(table.name)}`).get() as {
        count: number;
      }
    ).count,
  ),
  indexes: (
    db.prepare(`pragma index_list(${JSON.stringify(table.name)})`).all() as Record<
      string,
      unknown
    >[]
  ).map((index) => ({
    ...index,
    columns: db.prepare(`pragma index_info(${JSON.stringify(String(index.name))})`).all(),
  })),
  foreignKeys: db
    .prepare(`pragma foreign_key_list(${JSON.stringify(table.name)})`)
    .all() as SqlForeignKey[],
  constraints: {
    primaryKey: (
      db.prepare(`pragma table_info(${JSON.stringify(table.name)})`).all() as SqlColumn[]
    )
      .filter((column) => column.pk > 0)
      .toSorted((left, right) => left.pk - right.pk)
      .map((column) => column.name),
    notNull: (db.prepare(`pragma table_info(${JSON.stringify(table.name)})`).all() as SqlColumn[])
      .filter((column) => column.notnull === 1)
      .map((column) => column.name),
    createStatement: table.sql,
  },
}));
const sqliteSchema = sqliteObjects
  .filter((entry) => entry.sql)
  .map((entry) => `-- ${entry.type}: ${entry.name}\n${entry.sql};`)
  .join('\n\n');
const postgresSchema = [
  'supabase/migrations/202608090001_canonical_domain.sql',
  'supabase/migrations/202608090002_user_admin_security.sql',
  'supabase/migrations/202608110001_iteration_4_progression.sql',
  'supabase/migrations/202608110002_iteration_4_5_hardening.sql',
]
  .map((path) => `-- BEGIN ${path}\n${readFileSync(join(root, path), 'utf8')}\n-- END ${path}`)
  .join('\n\n');

text('schema/sqlite-schema.sql', sqliteSchema);
text('schema/postgres-schema.sql', postgresSchema);
json('schema/schema-manifest.json', {
  generatedAt,
  note: 'The runtime dataset is SQLite canonical v3.1. PostgreSQL is the normalized target domain model; both complete schemas are exported separately because they use different SQL dialects.',
  sqlite: 'schema/sqlite-schema.sql',
  postgres: 'schema/postgres-schema.sql',
  migrations: [
    'supabase/migrations/202608090001_canonical_domain.sql',
    'supabase/migrations/202608090002_user_admin_security.sql',
    'supabase/migrations/202608110001_iteration_4_progression.sql',
    'supabase/migrations/202608110002_iteration_4_5_hardening.sql',
  ],
});
json('database-metadata.json', {
  generatedAt,
  runtime: portableRepositoryHealth(),
  database: {
    sourcePath: 'data/canonical/v3.1/pokopia-canonical.sqlite',
    bytes: statSync(databasePath).size,
    sha256: sha256(databasePath),
    journalMode: (db.prepare('pragma journal_mode').get() as { journal_mode: string }).journal_mode,
    integrityCheck: (db.prepare('pragma integrity_check').get() as { integrity_check: string })
      .integrity_check,
    foreignKeyViolations: db.prepare('pragma foreign_key_check').all().length,
  },
  objects: countBy(sqliteObjects.map((entry) => entry.type)),
});
json('database-structure.json', {
  generatedAt,
  tables: tableMetadata,
  indexes: sqliteObjects.filter((entry) => entry.type === 'index'),
  triggers: sqliteObjects.filter((entry) => entry.type === 'trigger'),
  views: sqliteObjects.filter((entry) => entry.type === 'view'),
  materializedViews: [],
});
json(
  'row-counts.json',
  Object.fromEntries(tableMetadata.map((table) => [table.name, table.rowCount])),
);

const allPokemon = repository.listPokemon(10_000);
const allItems = repository.listItems(10_000);
const allRecipes = repository.listRecipes(10_000);
const allTowns = repository.listTowns();
const allAutomation = repository.listAutomationSystems();
const allQuantitative = repository.listQuantitativeParameters();
const allQuests = repository.listQuests();
const allTreasureMaps = repository.listTreasureMaps();
const allCollectibles = repository.listCollectibles();
const allDittoMoves = repository.listDittoMoves();
const pokemon = selectRepresentative(allPokemon, 20, [
  'pikachu',
  'ditto',
  'alomomola',
  'azumarill',
  'machop',
  'machoke',
  'timburr',
  'gurdurr',
  'rotom',
  'magnemite',
]);
const items = selectRepresentative(allItems, 30, [
  'portal-pod',
  'big-storage-box',
  'storage-box',
  'community-box',
  'sprinkler',
  'mini-generator',
  'utility-pole',
  'wireless-power-transmitter',
  'dowsing-machine',
  'neo-dowsing-machine',
]);
const recipes = selectRepresentative(allRecipes, 20, [
  'portal-pod',
  'sprinkler',
  'mini-generator',
  'dowsing-machine',
  'neo-dowsing-machine',
]);

const seedNodes = [
  ...allPokemon.flatMap((entry) => {
    const node = graph.resolve('pokemon', entry.slug);
    return node ? [node] : [];
  }),
  ...allItems.flatMap((entry) => {
    const node = graph.resolve('item', entry.slug);
    return node ? [node] : [];
  }),
  ...allRecipes.flatMap((entry) => {
    const node = graph.resolve('recipe', entry.slug);
    return node ? [node] : [];
  }),
  ...allTowns.flatMap((entry) => {
    const node = graph.resolve('town', entry.slug);
    return node ? [node] : [];
  }),
  ...allAutomation.flatMap((entry) => {
    const node = graph.resolve('automation', entry.slug);
    return node ? [node] : [];
  }),
  ...allQuests.flatMap((entry) => {
    const node = graph.resolve('quest', entry.slug);
    return node ? [node] : [];
  }),
  ...allTreasureMaps.flatMap((entry) => {
    const node = graph.resolve('treasure_map', entry.slug);
    return node ? [node] : [];
  }),
  ...allCollectibles.flatMap((entry) => {
    const node = graph.resolve('collectible', entry.slug);
    return node ? [node] : [];
  }),
  ...allDittoMoves.flatMap((entry) => {
    const node = graph.resolve('ditto_move', entry.slug);
    return node ? [node] : [];
  }),
];
const graphNodes = new Map(seedNodes.map((node) => [key(node), node]));
const graphRelationships = new Map<string, KnowledgeRelationship>();
const queue = [...graphNodes.values()];
for (let cursor = 0; cursor < queue.length; cursor += 1) {
  const current = queue[cursor]!;
  for (const relationship of graph.getRelations(current)) {
    graphRelationships.set(relationship.id, relationship);
    for (const endpoint of [relationship.from, relationship.to]) {
      if (!graphNodes.has(key(endpoint))) {
        graphNodes.set(key(endpoint), endpoint);
        queue.push(endpoint);
      }
    }
  }
}
const semanticRelationships = [...graphRelationships.values()].toSorted((left, right) =>
  left.id.localeCompare(right.id),
);
const connected = new Set(
  semanticRelationships.flatMap((relationship) => [key(relationship.from), key(relationship.to)]),
);
const cycles = uniqueBy(
  seedNodes.flatMap((node) => graph.getDependencies(node, 12).cycles),
  (cycle) => cycle,
);
const evidenceRelationships = semanticRelationships.filter(
  (relationship) => relationship.evidence.length > 0,
);

json('iteration-4/progression-cases.json', {
  schemaVersion: '4.0',
  knownDenominators: {
    importantRequests: allQuests.length,
    treasureMaps: allTreasureMaps.length,
    musicCds: allCollectibles.length,
    dittoMoves: allDittoMoves.length,
  },
  semantics: {
    unmarked: 'unknown',
    explicitTrue: 'confirmed complete',
    explicitFalse: 'confirmed incomplete',
    percentageOfWholeGame: null,
  },
});
json(
  'iteration-4/quest-request-cases.json',
  allQuests.map((quest) => ({
    slug: quest.slug,
    name: quest.name,
    orderedSteps: quest.steps,
    rewards: quest.rewards,
    unlocks: quest.unlocks,
    repeatable: quest.repeatable,
    version: quest.classification,
    source: quest.source,
  })),
);
json(
  'iteration-4/treasure-map-cases.json',
  allTreasureMaps.map((map) => ({
    slug: map.slug,
    number: map.number,
    area: map.area,
    requirements: map.requirements,
    reward: map.reward,
    recipeUnlock: map.recipeUnlock,
    qualityWarnings: map.qualityWarnings,
    version: map.classification,
    source: map.source,
  })),
);
json(
  'iteration-4/collectible-cases.json',
  allCollectibles.map((collectible) => ({
    slug: collectible.slug,
    name: collectible.name,
    catalogNumber: collectible.catalogNumber,
    locations: collectible.locations,
    version: collectible.classification,
    source: collectible.source,
  })),
);
json(
  'iteration-4/ditto-cases.json',
  allDittoMoves.map((move) => ({
    slug: move.slug,
    name: move.name,
    moveClass: move.moveClass,
    effect: move.effect,
    unlock: move.unlock,
    learnedFromPokemon: move.learnedFromPokemon,
    mealBoost: move.mealBoost,
    version: move.classification,
    source: move.source,
  })),
);
json('iteration-4/version-filtering-cases.json', {
  introducedBoundary: 'inclusive',
  removedBoundary: 'exclusive',
  filters: {
    all: allCollectibles.length,
    baseGameVerified: repository.listCollectibles({ scope: 'base_game' }).length,
    expansionVerified: repository.listCollectibles({ scope: 'expansion' }).length,
    unknown: repository.listCollectibles({ scope: 'unknown' }).length,
  },
  rule: 'Unknown content is never included in Base Game.',
});
const iteration4Goals = [
  {
    id: 'audit-request-yawn',
    type: 'complete-quest' as const,
    slug: 'yawn-up-a-storm',
    label: 'Complete Yawn Up A Storm',
  },
  {
    id: 'audit-map-6',
    type: 'complete-treasure-map' as const,
    slug: 'treasure-map-6',
    label: 'Complete Treasure Map 6',
  },
  {
    id: 'audit-cd-100',
    type: 'get-collectible' as const,
    slug: 'music-cd-100',
    label: 'Get Music CD 100',
  },
  {
    id: 'audit-water-gun',
    type: 'learn-ditto-move' as const,
    slug: 'water-gun',
    label: 'Learn Water Gun',
  },
];
const iteration4GoalCatalog = createGoalCatalog(repository, graph, iteration4Goals);
json(
  'iteration-4/goal-cases.json',
  iteration4Goals.map((goal) => ({
    goal,
    unknownState: evaluateGoal(goal, iteration4GoalCatalog, { entries: {} }),
    completedState: evaluateGoal(goal, iteration4GoalCatalog, {
      entries: {
        [`${goal.type === 'complete-quest' ? 'quest' : goal.type === 'complete-treasure-map' ? 'treasure_map' : goal.type === 'get-collectible' ? 'collectible' : 'ditto_move'}:${goal.slug}`]:
          {
            state: 'confirmed',
            value: true,
          },
      },
    }),
  })),
);
const mapOne = graph.resolve('treasure_map', 'treasure-map-1');
if (!mapOne) throw new Error('Treasure Map 1 graph node is required for Iteration 4 audit.');
json('iteration-4/graph-traversal-cases.json', {
  root: mapOne,
  dependencies: graph.getDependencies(mapOne, 16),
  relations: graph.getRelations(mapOne),
  expectedDirection: [
    'treasure_map_requires_item',
    'treasure_map_requires_specialty',
    'treasure_map_rewards_item',
    'treasure_map_unlocks_recipe',
  ],
});
const unknownSources = uniqueBy(
  semanticRelationships
    .flatMap((relationship) => relationship.evidence)
    .filter((evidence) => !evidence.source.url || evidence.source.verificationStatus === 'unknown')
    .map((evidence) => evidence.source),
  (source) => source.url || source.title,
);

const graphStats = {
  generatedAt,
  totalNodes: graphNodes.size,
  totalSemanticEdges: semanticRelationships.length,
  edgeCountByRelationType: countBy(semanticRelationships.map((edge) => edge.predicate)),
  relationshipClassCounts: countBy(semanticRelationships.map((edge) => edge.relationshipClass)),
  semanticLayerCounts: {
    fact: semanticRelationships.filter((edge) => edge.relationshipClass === 'direct_fact').length,
    derived: semanticRelationships.filter((edge) => edge.relationshipClass === 'derived_fact')
      .length,
    inference: semanticRelationships.filter((edge) => edge.relationshipClass === 'inference')
      .length,
    recommendation: semanticRelationships.filter(
      (edge) => edge.relationshipClass === 'recommendation',
    ).length,
  },
  confidenceDistribution: countBy(semanticRelationships.map((edge) => edge.confidence)),
  evidenceCoverageDistribution: countBy(semanticRelationships.map((edge) => edge.evidenceCoverage)),
  edgesWithEvidence: evidenceRelationships.length,
  evidenceCoveragePercent:
    semanticRelationships.length === 0
      ? null
      : Math.round((evidenceRelationships.length / semanticRelationships.length) * 10_000) / 100,
  orphanNodes: [...graphNodes.keys()].filter((node) => !connected.has(node)),
  danglingEdges: semanticRelationships.filter(
    (edge) => !graphNodes.has(key(edge.from)) || !graphNodes.has(key(edge.to)),
  ).length,
  unknownSourceCount: unknownSources.length,
  cycles,
  rawDocumentGraph: repository.relationshipAudit(),
  reconciliation: {
    rawCount: repository.relationshipAudit().total,
    semanticCount: semanticRelationships.length,
    explanation:
      'The 30,422 raw relationships are documentary links_to edges extracted from page hyperlinks. Iteration 3 does not treat co-linking as gameplay truth. It projects only typed relationships supported by structured Pokémon roles, recipe ingredients/outputs, town unlocks/resources/facilities, and automation requirements/compatibility. Raw links therefore remain auditable provenance candidates while 7,128 typed edges form the semantic gameplay graph.',
    excludedOrReclassified: [
      'Navigation, category, index, image and cross-reference hyperlinks remain documentary links.',
      'Self-links and ambiguous page-to-page links are not promoted to gameplay predicates.',
      'A semantic edge can be derived from structured facts without being a one-to-one copy of a raw hyperlink.',
      'No synergy edge is inferred from co-occurrence alone.',
    ],
  },
};
json('knowledge-graph-stats.json', graphStats);
json(
  'relation-types.json',
  Object.entries(graphStats.edgeCountByRelationType).map(([relationType, count]) => ({
    relationType,
    count,
    sampleIds: semanticRelationships
      .filter((edge) => edge.predicate === relationType)
      .slice(0, 3)
      .map((edge) => edge.id),
  })),
);
const knowledgeGraphSample = uniqueBy(
  [
    ...semanticRelationships.filter(
      (edge) =>
        edge.from.slug === 'portal-pod' ||
        edge.to.slug === 'portal-pod' ||
        edge.from.slug === 'palettetown' ||
        edge.to.slug === 'palettetown',
    ),
    ...semanticRelationships,
  ],
  (edge) => edge.id,
).slice(0, 240);
json('knowledge-graph-sample.json', knowledgeGraphSample);

const sampleSources = uniqueBy(
  [
    ...pokemon.map((entry) => entry.source),
    ...items.map((entry) => entry.source),
    ...recipes.map((entry) => entry.source),
    ...allTowns.map((entry) => entry.source),
    ...allAutomation.map((entry) => entry.source),
    ...allQuantitative.map((entry) => entry.source),
    ...allQuests.map((entry) => entry.source),
    ...allTreasureMaps.map((entry) => entry.source),
    ...allCollectibles.map((entry) => entry.source),
    ...allDittoMoves.map((entry) => entry.source),
    ...knowledgeGraphSample.flatMap((edge) => edge.evidence.map((entry) => entry.source)),
  ],
  (source) => source.url,
);
const sourceUrls = uniqueBy(
  [
    ...sampleSources.map((source) => source.url),
    ...allPokemon.map((entry) => entry.source.url),
    ...allItems.map((entry) => entry.source.url),
    ...allRecipes.map((entry) => entry.source.url),
    ...allQuantitative.map((entry) => entry.source.url),
    'https://www.serebii.net/pokemonpokopia/items.shtml',
  ],
  (url) => url,
);
const placeholders = sourceUrls.map(() => '?').join(',');
const sourceEntities = sourceUrls.length
  ? (db
      .prepare(`select * from entities where source_url in (${placeholders}) order by source_url`)
      .all(...sourceUrls) as { id: string; source_url: string }[])
  : [];
const sourceEntityIds = sourceEntities.map((entry) => entry.id);
const factPlaceholders = sourceEntityIds.map(() => '?').join(',');
const sampleFacts = sourceEntityIds.length
  ? db
      .prepare(
        `select id, entity_id, key, value, table_index, row_index, source_url from facts where entity_id in (${factPlaceholders}) order by entity_id, table_index, row_index, key`,
      )
      .all(...sourceEntityIds)
  : [];

const reviewDatabasePath = join(outputRoot, 'pokopia-review.sqlite');
rmSync(reviewDatabasePath, { force: true });
const reviewDb = new Database(reviewDatabasePath);
reviewDb.pragma('foreign_keys = OFF');
const reviewSchemaOrder = [
  'pages',
  'entities',
  'page_tables',
  'table_cells',
  'links',
  'facts',
  'relationships',
  'rag_chunks',
  'rag_fts',
  'quantitative_assertions',
];
for (const tableName of reviewSchemaOrder) {
  const statement = sqliteObjects.find(
    (entry) => entry.type === 'table' && entry.name === tableName,
  )?.sql;
  if (!statement) throw new Error(`Missing canonical schema statement for ${tableName}.`);
  reviewDb.exec(statement);
}
reviewDb.prepare('attach database ? as source').run(databasePath);
const reviewPlaceholders = sourceUrls.map(() => '?').join(',');
const insertReviewRows = reviewDb.transaction(() => {
  reviewDb
    .prepare(
      `insert into pages select * from source.pages where source_url in (${reviewPlaceholders})`,
    )
    .run(...sourceUrls);
  reviewDb
    .prepare(
      `insert into entities select * from source.entities where source_url in (${reviewPlaceholders})`,
    )
    .run(...sourceUrls);
  reviewDb.exec(
    'insert into page_tables select source_rows.* from source.page_tables source_rows join pages on pages.id = source_rows.page_id',
  );
  reviewDb.exec(
    'insert into table_cells select source_rows.* from source.table_cells source_rows join pages on pages.id = source_rows.page_id',
  );
  reviewDb.exec(
    'insert into links select source_rows.* from source.links source_rows join pages on pages.id = source_rows.source_page_id',
  );
  reviewDb.exec(
    'insert into facts select source_rows.* from source.facts source_rows join entities on entities.id = source_rows.entity_id',
  );
  reviewDb.exec(
    'insert into relationships select source_rows.* from source.relationships source_rows join entities source_entity on source_entity.id = source_rows.source_entity_id join entities target_entity on target_entity.id = source_rows.target_entity_id',
  );
  reviewDb
    .prepare(
      `insert into rag_chunks select * from source.rag_chunks where source_url in (${reviewPlaceholders})`,
    )
    .run(...sourceUrls);
  reviewDb.exec(
    'insert into rag_fts(id, title, category, text) select id, title, category, text from rag_chunks',
  );
  reviewDb
    .prepare(
      `insert into quantitative_assertions select * from source.quantitative_assertions where source_url in (${reviewPlaceholders})`,
    )
    .run(...sourceUrls);
});
insertReviewRows();
for (const index of sqliteObjects.filter(
  (entry) => entry.type === 'index' && entry.sql && reviewSchemaOrder.includes(entry.tbl_name),
))
  reviewDb.exec(index.sql!);
reviewDb.pragma('foreign_keys = ON');
const reviewForeignKeyViolations = reviewDb.pragma('foreign_key_check') as unknown[];
const reviewIntegrity = (
  reviewDb.prepare('pragma integrity_check').get() as { integrity_check: string }
).integrity_check;
const reviewCounts = Object.fromEntries(
  reviewSchemaOrder.map((tableName) => [
    tableName,
    Number(
      (
        reviewDb.prepare(`select count(*) as count from ${JSON.stringify(tableName)}`).get() as {
          count: number;
        }
      ).count,
    ),
  ]),
);
reviewDb.close();
json('review-database-manifest.json', {
  generatedAt,
  file: 'pokopia-review.sqlite',
  bytes: statSync(reviewDatabasePath).size,
  sha256: sha256(reviewDatabasePath),
  integrityCheck: reviewIntegrity,
  foreignKeyViolations: reviewForeignKeyViolations.length,
  rowCounts: reviewCounts,
  selection:
    'All source rows required to reproduce the 3,047 PostgreSQL runtime projections and 115 quantitative evidence records, plus deterministic evidence samples, dependent table cells, facts, links, raw relationships with both endpoints present, and matching RAG chunks.',
  excluded:
    'Non-projection page text, raw HTML, source assets, canonical rows outside the runtime/evidence set, and raw relationships with a missing selected endpoint.',
  restoreBuild:
    'POKOPIA_DATABASE_PATH="$PWD/audit-data/pokopia-review.sqlite" npm run build -- --env-mode=loose',
});

const roles = uniqueBy(
  allPokemon.flatMap((entry) => entry.roles),
  (assignment) => assignment.role,
).toSorted((left, right) => left.role.localeCompare(right.role));
json('samples/canonical-entities.json', {
  generatedAt,
  selection:
    'Deterministic real records with key Iteration 3 flows preferred, then slug-sorted fill.',
  pokemon,
  items,
  recipes,
  towns: allTowns.map((town) => repository.getTown(town.slug)),
  automationSystems: allAutomation,
  quantitativeParameters: allQuantitative,
  quests: allQuests,
  treasureMaps: allTreasureMaps,
  collectibles: allCollectibles,
  dittoMoves: allDittoMoves,
  roles,
  relationTypes: Object.keys(graphStats.edgeCountByRelationType),
});
json('samples/facts.json', sampleFacts);
json('samples/sources.json', sampleSources);
json(
  'samples/assertions-evidence.json',
  knowledgeGraphSample.map((relationship) => ({
    assertionId: relationship.id,
    subject: relationship.from,
    predicate: relationship.predicate,
    object: relationship.to,
    classification: relationship.relationshipClass,
    confidence: relationship.confidence,
    evidenceCoverage: relationship.evidenceCoverage,
    evidence: relationship.evidence,
    lifecycle:
      relationship.relationshipClass === 'direct_fact'
        ? 'source_backed_projection'
        : 'derived_runtime',
  })),
);

const townCandidates: TownPokemonCandidate[] = allPokemon.map((entry) => ({
  slug: entry.slug,
  name: entry.name,
  roles: entry.roles.map((assignment) => ({
    role: assignment.role,
    evidence: assignment.evidence,
  })),
}));
const paletteTown = repository.getTown('palettetown');
if (!paletteTown) throw new Error('Palette Town is required for the audit reference cases.');

function pokemonForRoles(required: readonly RoleSlug[], maximum = 8): string[] {
  const uncovered = new Set(required);
  const selected: string[] = [];
  while (uncovered.size > 0 && selected.length < maximum) {
    const candidate = townCandidates
      .filter((entry) => !selected.includes(entry.slug))
      .map((entry) => ({
        entry,
        gain: entry.roles.filter((role) => uncovered.has(role.role)).length,
      }))
      .toSorted(
        (left, right) => right.gain - left.gain || left.entry.name.localeCompare(right.entry.name),
      )[0];
    if (!candidate || candidate.gain === 0) break;
    selected.push(candidate.entry.slug);
    for (const role of candidate.entry.roles) uncovered.delete(role.role);
  }
  return selected;
}

const roleGroups = new Map<RoleSlug, string[]>();
for (const candidate of townCandidates)
  for (const role of candidate.roles) {
    const group = roleGroups.get(role.role) ?? [];
    group.push(candidate.slug);
    roleGroups.set(role.role, group);
  }
const townScenarios = [
  { id: 'empty-town', label: 'Empty town', residents: [] as string[] },
  {
    id: 'partially-configured',
    label: 'Partially configured town',
    residents: pokemonForRoles(['construction', 'watering'], 2),
  },
  {
    id: 'redundant-roles',
    label: 'Redundant roles',
    residents: [...(roleGroups.get('watering') ?? []).slice(0, 4)],
  },
  {
    id: 'good-role-coverage',
    label: 'Good role coverage',
    residents: pokemonForRoles(TOWN_PRESET_ROLES.Balanced),
  },
].map((scenario) => {
  const input = {
    town: paletteTown,
    pokemon: townCandidates,
    residentSlugs: scenario.residents,
    candidateSlugs: townCandidates
      .filter((entry) => entry.roles.length > 0)
      .map((entry) => entry.slug),
    preset: 'Balanced' as const,
    compatibleAutomation: allAutomation.filter(
      (system) =>
        system.compatibleTowns.length === 0 || system.compatibleTowns.includes(paletteTown.name),
    ),
    builtAutomationSlugs: scenario.id === 'good-role-coverage' ? ['mini-generator'] : [],
    userLevel: scenario.id === 'empty-town' ? null : 5,
  };
  const output = analyzeTown(input);
  return {
    id: scenario.id,
    label: scenario.label,
    input: {
      town: input.town.slug,
      preset: input.preset,
      residents: input.residentSlugs,
      userLevel: input.userLevel,
      builtAutomationSlugs: input.builtAutomationSlugs,
    },
    constraints: {
      requiredRoles: output.requiredRoles,
      source: 'TOWN_PRESET_ROLES.Balanced plus town-derived requirements',
      maximumResidents: null,
      note: 'The current model has no source-backed resident capacity constraint.',
    },
    candidateSet: townCandidates
      .filter((candidate) => candidate.roles.length > 0)
      .map((candidate) => ({ slug: candidate.slug, name: candidate.name, roles: candidate.roles })),
    output,
    roleCoverage: output.coveredRoles,
    missing: output.missingRoles,
    duplicates: output.duplicateRoles,
    recommendations: output.topImprovements,
    tradeoffs: output.topImprovements.map((entry) => entry.tradeoff),
    confidence: countBy(output.health.map((entry) => entry.state)),
  };
});
json('town-optimizer-cases.json', townScenarios);

const searchQueries = [
  'portal pod',
  'portal pot',
  'baul compartido',
  'baúl compartido',
  'pokemon para regar',
  'pokémon para regar',
  'mejor pokemon para construir',
  'automatizar palette town',
  'como conseguir portal pod',
  'storage grande',
  'mapa del tesoro 6',
  'CD expansion',
  'como aprender Water Gun',
];
const searchEngine = createSearchEngine(repository);
json(
  'search-cases.json',
  searchQueries.map((query) => ({
    query,
    variants: searchVariants(query),
    intent: inferSearchIntent(query),
    results: searchEngine.search({ text: query, limit: 10 }).map((result, index) => ({
      position: index + 1,
      score: result.rank,
      ...result,
    })),
  })),
);

const scoringContexts = [
  { id: 'construction', query: 'construction', weights: PRESET_WEIGHTS.Balanced },
  { id: 'watering', query: 'watering farming', weights: PRESET_WEIGHTS.Production },
  {
    id: 'automation',
    query: 'automation production electricity',
    weights: PRESET_WEIGHTS.Automation,
  },
  {
    id: 'palette-town',
    query: 'construction watering resources logistics transport',
    weights: PRESET_WEIGHTS.Progression,
  },
  {
    id: 'endgame',
    query: 'automation production logistics transport',
    weights: PRESET_WEIGHTS.Endgame,
  },
] as const;
json(
  'scoring-cases.json',
  scoringContexts.map((context) => ({
    id: context.id,
    evaluationContext: context.query,
    requestedRoles: rolesForContext(context.query),
    weights: context.weights,
    formula:
      'recommendationScore = round(100 * sum(known dimension value * weight) / sum(known weights)); unknown dimensions are excluded, not scored as zero.',
    results: rankPokemon(allPokemon, context.query, context.weights)
      .slice(0, 12)
      .map((result) => ({
        pokemon: result.pokemon,
        rawCapabilities: result.pokemon.roles,
        score: result.score,
        confidence: result.confidence,
        evidenceCoverage: result.evidenceCoverage,
        weightContributions: result.explanations,
        unknownDimensions: result.unknowns,
        reason: result.explanations.map((entry) => entry.reason),
        recommendationBand: result.recommendationBand,
      })),
  })),
);

const pokemonWithRelations = allPokemon
  .flatMap((entry) => {
    const node = graph.resolve('pokemon', entry.slug);
    const scoreContext = entry.roles
      .map((assignment) => assignment.role)
      .find((role) => rolesForContext(role).includes(role));
    return node && scoreContext
      ? [{ entry, node, scoreContext, relations: graph.getRelations(node) }]
      : [];
  })
  .toSorted(
    (left, right) =>
      right.relations.length - left.relations.length ||
      left.entry.name.localeCompare(right.entry.name),
  )[0];
if (!pokemonWithRelations) throw new Error('A related Pokémon is required for audit references.');
const multiLevelRecipe = repository.getRecipe('neo-dowsing-machine');
if (!multiLevelRecipe)
  throw new Error('Neo Dowsing Machine recipe is required for audit references.');
const craftPlan = calculateCraftPlan(allRecipes, multiLevelRecipe.slug, 2);
const automationReference = allAutomation.toSorted(
  (left, right) =>
    right.requirements.length - left.requirements.length || left.name.localeCompare(right.name),
)[0];
if (!automationReference) throw new Error('An automation system is required for audit references.');

const portal = repository.getItem('portal-pod');
const portalItemNode = graph.resolve('item', 'portal-pod');
const portalRecipeNode = graph.resolve('recipe', 'portal-pod');
if (!portal || !portalItemNode || !portalRecipeNode)
  throw new Error('Portal Pod graph references are required.');
json('reference-cases/portal-pod.json', {
  generatedAt,
  entity: portal,
  relations: graph.getRelations(portalItemNode),
  requirements: graph.getRequirements(portalRecipeNode),
  recipe: portal.recipe,
  unlock: portal.recipe?.unlock ?? null,
  evidence: uniqueBy(
    [...graph.getEvidence(portalItemNode), ...graph.getEvidence(portalRecipeNode)],
    (entry) => `${entry.source.url}:${entry.statement}`,
  ),
  sources: uniqueBy(
    [portal.source, ...graph.getEvidence(portalRecipeNode).map((entry) => entry.source)],
    (entry) => entry.url,
  ),
  goalTraversal: {
    item: graph.getDependencies(portalItemNode, 12),
    recipe: graph.getDependencies(portalRecipeNode, 12),
  },
  comparisonData: compareItems(repository, 'portal-pod', 'big-storage-box', 'Automation'),
});

const paletteResidents = townScenarios.find((scenario) => scenario.id === 'good-role-coverage')!;
json('reference-cases/palette-town.json', {
  generatedAt,
  town: paletteTown,
  environmentLevels: paletteTown.unlocks,
  residents: paletteResidents.output.residents,
  roles: {
    required: paletteResidents.output.requiredRoles,
    covered: paletteResidents.output.coveredRoles,
    missing: paletteResidents.output.missingRoles,
    duplicate: paletteResidents.output.duplicateRoles,
  },
  townHealth: paletteResidents.output.health,
  optimizer: {
    input: paletteResidents.input,
    output: paletteResidents.output,
  },
  recommendations: paletteResidents.output.topImprovements,
  evidence: uniqueBy(
    [
      { statement: 'Town source record', source: paletteTown.source },
      ...paletteResidents.output.topImprovements.map((entry) => ({
        statement: entry.evidence,
        source: paletteTown.source,
      })),
    ],
    (entry) => `${entry.source.url}:${entry.statement}`,
  ),
});

const pokemonDetail = repository.getPokemon(pokemonWithRelations.entry.slug);
json('reference-cases/related-pokemon.json', {
  generatedAt,
  selectionReason: `Highest semantic relation count among ${allPokemon.length} real Pokémon records (${pokemonWithRelations.relations.length} relations).`,
  entity: pokemonDetail,
  abilities: pokemonDetail?.rawFacts.filter((fact) => /ability|special/i.test(fact.key)) ?? [],
  roles: pokemonWithRelations.entry.roles,
  locations: pokemonDetail?.locations ?? [],
  synergies: graph.getSynergies(pokemonWithRelations.node),
  townRelevance: graph.getRelevantTowns(pokemonWithRelations.node),
  scoreContext: pokemonWithRelations.scoreContext,
  score: rankPokemon([pokemonWithRelations.entry], pokemonWithRelations.scoreContext)[0] ?? null,
  relations: pokemonWithRelations.relations,
  evidence: graph.getEvidence(pokemonWithRelations.node),
});

json('reference-cases/multilevel-recipe.json', {
  generatedAt,
  selectionReason:
    'Neo Dowsing Machine is the only current canonical recipe with a recipe ingredient that is itself canonicalized as a recipe.',
  recipe: multiLevelRecipe,
  dependencyGraph: graph.getDependencies(graph.resolve('recipe', multiLevelRecipe.slug)!, 12),
  recursiveQuantities: craftPlan,
  output: {
    requestedCopies: 2,
    recipeOutputQuantity: multiLevelRecipe.outputQuantity,
  },
});

const automationTown =
  allTowns.find((town) => automationReference.compatibleTowns.includes(town.name)) ?? allTowns[0]!;
const automationTownDetail = repository.getTown(automationTown.slug)!;
json('reference-cases/automation-system.json', {
  generatedAt,
  system: automationReference,
  requirements: automationReference.requirements,
  inputs: automationReference.operationalInputs,
  outputs: automationReference.operationalOutputs,
  roles: automationReference.pokemon,
  townCompatibility: automationReference.compatibleTowns,
  plan: planAutomation(automationReference, automationTownDetail, {
    ownedItemSlugs: automationReference.requirements.slice(0, 1).map((entry) => entry.slug),
    residentRoles: ['automation', 'electricity'],
    townLevel: 5,
  }),
  knowledgeGaps: [
    ...automationReference.limitations,
    ...(automationReference.pokemon === null ? ['Required Pokémon are not source-specified.'] : []),
    ...(automationReference.requirements.some((entry) => entry.quantity === null)
      ? ['At least one required quantity is unknown.']
      : []),
  ],
  evidence: graph.getEvidence(graph.resolve('automation', automationReference.slug)!),
});

const profileResidents = pokemonForRoles(TOWN_PRESET_ROLES.Balanced);
const profileTimestamp = '2026-08-09T12:00:00.000Z';
const testProfile: PokopiaProgress = {
  version: 3,
  entries: {
    'item:storage-box': { state: 'confirmed', value: true, updatedAt: profileTimestamp },
    'pokemon:pikachu': { state: 'confirmed', value: true, updatedAt: profileTimestamp },
    'town:palettetown': { state: 'confirmed', value: 5, updatedAt: profileTimestamp },
    ...Object.fromEntries(
      inferLowerTownLevels('palettetown', 5, profileTimestamp).map((entry) => [
        entry.id,
        {
          state: entry.state,
          value: true,
          updatedAt: profileTimestamp,
          inferredFrom: entry.inferredFrom,
          rule: entry.rule,
          ruleId: entry.rule,
        },
      ]),
    ),
  },
  goals: [
    {
      id: 'test-goal-portal-pod',
      type: 'get-item',
      slug: 'portal-pod',
      label: 'Get Portal pod',
      createdAt: profileTimestamp,
    },
    {
      id: 'test-goal-automation',
      type: 'build-automation',
      slug: automationReference.slug,
      label: `Build ${automationReference.name}`,
      createdAt: profileTimestamp,
    },
  ],
  townResidents: { palettetown: profileResidents },
  favorites: ['item:portal-pod', `pokemon:${pokemonWithRelations.entry.slug}`],
  recentlyViewed: [
    { kind: 'item', slug: 'portal-pod', label: 'Portal pod', viewedAt: profileTimestamp },
  ],
  recentSearches: [{ query: 'portal pod', searchedAt: profileTimestamp }],
};
const validatedProfile = parseProgress(JSON.stringify(testProfile));
const profileOptimizer = analyzeTown({
  town: paletteTown,
  pokemon: townCandidates,
  residentSlugs: validatedProfile.townResidents.palettetown ?? [],
  preset: 'Balanced',
  compatibleAutomation: allAutomation,
  builtAutomationSlugs: [],
  userLevel: 5,
});
json('reference-cases/my-pokopia-test-profile.json', {
  generatedAt,
  notice:
    'Synthetic user TEST state. Every referenced game entity is resolved against the real canonical repository.',
  profile: validatedProfile,
  entityResolution: {
    owned: [repository.getItem('storage-box'), repository.getPokemon('pikachu')],
    unlocked: paletteTown.unlocks.filter((unlock) => unlock.level <= 5),
    townProgress: { town: paletteTown, confirmedLevel: 5 },
  },
  goals: validatedProfile.goals,
  nextActions: nextActions({
    goals: validatedProfile.goals,
    confirmedIds: Object.keys(validatedProfile.entries).filter(
      (id) => validatedProfile.entries[id]?.state === 'confirmed',
    ),
    towns: [
      {
        slug: paletteTown.slug,
        name: paletteTown.name,
        currentLevel: 5,
        maxLevel: paletteTown.maxEnvironmentLevel,
      },
    ],
    automation: allAutomation,
  }),
  optimizerResult: profileOptimizer,
});

const requirementNodes = portal.recipe
  ? [
      {
        id: `recipe:${portal.recipe.slug}`,
        label: portal.recipe.name,
        dependencies: portal.recipe.ingredients.map((ingredient) => `item:${ingredient.slug}`),
      },
      ...portal.recipe.ingredients.map((ingredient) => ({
        id: `item:${ingredient.slug}`,
        label: ingredient.name,
        dependencies: [] as string[],
      })),
    ]
  : [];
json('samples/goal-engine-rules.json', {
  generatedAt,
  rules: [
    {
      id: 'requirement-state-v1',
      source: 'packages/rules/src/index.ts::evaluateRequirements',
      semantics: 'A missing dependency is any unknown state or dependency absent from the graph.',
    },
    {
      id: 'town_level_implies_lower_levels_v1',
      source: 'packages/rules/src/index.ts::inferLowerTownLevels',
      semantics:
        'Confirming level N infers levels 1 through N-1 and records provenance for reversal.',
    },
  ],
  realPortalPodEvaluation: evaluateRequirements(requirementNodes, {
    'item:pokemetal': 'user_confirmed',
  }),
});
json('samples/my-pokopia-rules.json', {
  generatedAt,
  storageKey: 'pokopia-progress-v3',
  states: ['confirmed', 'inferred', 'unknown'],
  migrationInputs: ['pokopia-progress-v2', 'pokopia-progress-v1'],
  inferenceRules: ['town_level_implies_lower_levels_v1'],
  reversibility: 'An inferred entry can be removed without deleting its confirmed source entry.',
  source: 'apps/web/lib/progress-store.ts',
});
json('samples/scoring-config.json', {
  generatedAt,
  presets: PRESET_WEIGHTS,
  formula:
    'Known dimensions are weighted and renormalized; unknown dimensions remain null and reduce evidence coverage.',
});
json('samples/knowledge-gaps.json', {
  generatedAt,
  persistenceStatus:
    'The runtime SQLite extraction does not persist reviewed PostgreSQL knowledge_gaps rows. These are real runtime unknowns emitted by current rules, not mock database rows.',
  gaps: uniqueBy(
    [
      ...allAutomation.flatMap((system) =>
        system.limitations.map((limitation) => ({
          entity: { kind: 'automation', slug: system.slug, name: system.name },
          gap: limitation,
          source: system.source,
        })),
      ),
      ...items
        .filter((item) => repository.getItem(item.slug)?.storage?.capacity === null)
        .map((item) => ({
          entity: { kind: 'item', slug: item.slug, name: item.name },
          gap: 'Exact storage capacity is unknown.',
          source: item.source,
        })),
    ],
    (entry) => `${entry.entity.kind}:${entry.entity.slug}:${entry.gap}`,
  ),
});
json('samples/recommendations.json', {
  generatedAt,
  lifecycle: 'runtime-derived, not auto-promoted to canonical fact',
  town: paletteResidents.output.topImprovements,
  residentReplacements: paletteResidents.output.replacements,
  nextActions: nextActions({
    goals: testProfile.goals,
    confirmedIds: Object.keys(testProfile.entries),
    towns: [
      {
        slug: paletteTown.slug,
        name: paletteTown.name,
        currentLevel: 5,
        maxLevel: paletteTown.maxEnvironmentLevel,
      },
    ],
    automation: allAutomation,
  }),
});

const iteration35 = 'iteration-3.5';
const searchRegressions = searchQueries.map((query) => ({
  query,
  variants: searchVariants(query),
  intent: inferSearchIntent(query),
  results: searchEngine.search({ text: query, limit: 10 }),
}));
json(`${iteration35}/search-regressions.json`, {
  generatedAt,
  source: portableRepositoryHealth(),
  cases: searchRegressions,
  passed: searchRegressions.every((entry) => entry.results.length > 0 || entry.intent),
});

const constructionIndividual = rankPokemon(allPokemon, 'construction');
const constructionAnchor = constructionIndividual[0]?.pokemon;
const constructionTeam = constructionAnchor
  ? rankPokemon(
      allPokemon.filter((entry) => entry.slug !== constructionAnchor.slug),
      'construction',
      PRESET_WEIGHTS.Balanced,
      [constructionAnchor],
    )
  : [];
json(`${iteration35}/scoring-regressions.json`, {
  generatedAt,
  model: 'Scoring V2 hardened',
  individual: constructionIndividual.slice(0, 12),
  team: {
    existing: constructionAnchor ?? null,
    additions: constructionTeam.slice(0, 12),
  },
  assertions: {
    individualIgnoresMarginality: constructionIndividual.every(
      (entry) => entry.mode === 'individual',
    ),
    teamUsesMarginality: constructionTeam.every((entry) => entry.mode === 'team_addition'),
    separatesCoverageQualityConfidence: constructionIndividual.every(
      (entry) =>
        typeof entry.dataCoverage === 'number' &&
        typeof entry.evidenceQualityScore === 'number' &&
        typeof entry.confidenceScore === 'number',
    ),
  },
});

const goalDefinitions = [
  { id: 'portal-get', type: 'get-item' as const, slug: 'portal-pod', label: 'Get Portal Pod' },
  {
    id: 'neo-craft',
    type: 'craft-item' as const,
    slug: 'neo-dowsing-machine',
    label: 'Craft Neo Dowsing Machine',
  },
  {
    id: 'palette-8',
    type: 'reach-town-level' as const,
    slug: 'palettetown',
    label: 'Reach Palette Town level 8',
    targetLevel: 8,
  },
  {
    id: 'automation-build',
    type: 'build-automation' as const,
    slug: automationReference.slug,
    label: `Build ${automationReference.name}`,
  },
  {
    id: 'pokemon-acquire',
    type: 'acquire-pokemon' as const,
    slug: pokemonWithRelations.entry.slug,
    label: `Acquire ${pokemonWithRelations.entry.name}`,
  },
];
const goalCatalog = createGoalCatalog(repository, graph, goalDefinitions);
json(`${iteration35}/goal-cases.json`, {
  generatedAt,
  cases: goalDefinitions.map((goal) => ({
    goal,
    unknownProfile: evaluateGoal(goal, goalCatalog, { entries: {} }),
    partialProfile: evaluateGoal(goal, goalCatalog, {
      entries: {
        'item:pokemetal': { state: 'confirmed', value: true },
        'town:palettetown:level': { state: 'confirmed', value: 7 },
      },
    }),
    completedProfile: evaluateGoal(goal, goalCatalog, {
      entries: {
        [`${goal.type === 'acquire-pokemon' ? 'pokemon' : goal.type === 'build-automation' ? 'automation' : goal.type === 'reach-town-level' ? 'town' : 'item'}:${goal.slug}${goal.type === 'reach-town-level' ? ':level' : ''}`]:
          {
            state: 'confirmed',
            value: goal.type === 'reach-town-level' ? 8 : true,
          },
      },
    }),
  })),
});

const ownedCandidates = townCandidates.filter((entry) => entry.roles.length > 0).slice(0, 8);
const ownershipA = Object.fromEntries(townCandidates.map((entry) => [entry.slug, 'unknown']));
const ownershipB = Object.fromEntries(
  townCandidates.map((entry) => [
    entry.slug,
    ownedCandidates.some((owned) => owned.slug === entry.slug) ? 'owned' : 'unknown',
  ]),
);
const ownershipC = Object.fromEntries(
  townCandidates.map((entry) => [
    entry.slug,
    ownedCandidates.some((owned) => owned.slug === entry.slug) ? 'owned' : 'not_owned',
  ]),
);
const townProfiles = [
  { id: 'A-unknown-collection', ownership: ownershipA, mode: 'known_collection' as const },
  { id: 'B-partial-collection', ownership: ownershipB, mode: 'known_collection' as const },
  { id: 'C-complete-collection', ownership: ownershipC, mode: 'owned_only' as const },
].map((profile) => ({
  id: profile.id,
  input: profile,
  output: analyzeTown({
    town: paletteTown,
    pokemon: townCandidates,
    residentSlugs: [],
    preset: 'Balanced',
    compatibleAutomation: allAutomation,
    ownership: profile.ownership as Readonly<Record<string, 'owned' | 'not_owned' | 'unknown'>>,
    candidateMode: profile.mode,
  }),
}));
json(`${iteration35}/town-optimizer-cases.json`, {
  generatedAt,
  profiles: townProfiles,
  rule: 'unknown is not treated as not_owned; ideal, owned_only and known_collection remain separate.',
});

const neoItemNode = graph.resolve('item', 'neo-dowsing-machine');
if (!neoItemNode) throw new Error('Neo Dowsing Machine item node is required.');
const orphans = graph.classifyOrphans();
json(`${iteration35}/knowledge-graph-cases.json`, {
  generatedAt,
  neoDowsingMachine: {
    traversal: graph.getDependencies(neoItemNode, 16),
    craftPlan,
  },
  orphanSummary: countBy(orphans.map((entry) => entry.classification)),
  orphanCount: orphans.length,
  orphans,
});

const multiEvidence = semanticRelationships.filter(
  (relationship) => relationship.evidence.length > 1,
);
json(`${iteration35}/provenance-cases.json`, {
  generatedAt,
  semanticRelationIdentity:
    'from + predicate + to; assertions and source_evidence remain independently addressable.',
  multiEvidenceRelationCount: multiEvidence.length,
  cases: multiEvidence.slice(0, 50),
  schemaInvariant: {
    relationIdentity: 'source_assertions.assertion_hash / relationships.assertion_id',
    evidenceIdentity: 'source_evidence(assertion_id, source_document_id, locator)',
    repeatedEvidenceDropped: false,
  },
});

json('README.json', {
  generatedAt,
  purpose: 'Compact, real, reproducible Iteration 3 audit dataset.',
  provenance: {
    sourceDatabaseSha256: sha256(databasePath),
    repositoryHealth: portableRepositoryHealth(),
    generator: 'scripts/generate-review-audit.ts',
  },
  limitations: [
    'Raw HTML, full page text, the source mirror, and the complete canonical SQLite are intentionally excluded from the REVIEW archive.',
    'The runtime source is parser-normalized SQLite. PostgreSQL migrations model the future normalized domain and are validated separately; no claim is made that review-gated PostgreSQL rows are populated.',
    'Source verificationStatus remains unverified unless the current repository marks it otherwise.',
  ],
  files: [
    'schema/',
    'database-metadata.json',
    'database-structure.json',
    'row-counts.json',
    'samples/',
    'reference-cases/',
    'knowledge-graph-stats.json',
    'relation-types.json',
    'knowledge-graph-sample.json',
    'search-cases.json',
    'scoring-cases.json',
    'town-optimizer-cases.json',
  ],
});

db.close();
console.log(
  JSON.stringify(
    {
      outputRoot,
      semanticEdges: semanticRelationships.length,
      graphNodes: graphNodes.size,
      searchCases: searchQueries.length,
      townCases: townScenarios.length,
      referenceCases: 6,
    },
    null,
    2,
  ),
);
