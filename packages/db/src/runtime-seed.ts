import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type {
  AutomationSystem,
  CollectibleDetail,
  DittoMoveDetail,
  GameDataRepository,
  ItemDetail,
  PokemonSummary,
  QuantitativeParameter,
  QuestDetail,
  RecipeSummary,
  RoleSlug,
  TownDetail,
  TreasureMapDetail,
} from '@pokopia/game-data';
import { Pool, type PoolClient } from 'pg';

export type RuntimeImportMode = 'seed' | 'dry-run' | 'validate';
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

export interface RuntimeValidation {
  readonly valid: boolean;
  readonly source: ReturnType<GameDataRepository['health']>;
  readonly counts: Readonly<
    Record<
      | 'pokemon'
      | 'items'
      | 'recipes'
      | 'towns'
      | 'automation'
      | 'quests'
      | 'treasureMaps'
      | 'collectibles'
      | 'dittoMoves',
      number
    >
  >;
  readonly duplicateNaturalKeys: readonly string[];
  readonly missingRecipeOutputs: readonly string[];
  readonly unknownIngredientQuantities: number;
  readonly warnings: readonly string[];
}

export interface RuntimeImportResult extends RuntimeValidation {
  readonly mode: 'seed';
  readonly gameId: string;
  readonly snapshotId: string;
  readonly ingestionRunId: string;
  readonly staged: number;
  readonly entitiesUpserted: number;
  readonly assertionsUpserted: number;
  readonly evidenceUpserted: number;
  readonly transaction: 'committed';
}

export function validateCanonicalRuntime(repository: GameDataRepository): RuntimeValidation {
  const pokemon = repository.listPokemon(10_000);
  const items = repository.listItems(10_000);
  const recipes = repository.listRecipes(10_000);
  const towns = repository.listTowns();
  const automation = repository.listAutomationSystems();
  const quests = repository.listQuests();
  const treasureMaps = repository.listTreasureMaps();
  const collectibles = repository.listCollectibles();
  const dittoMoves = repository.listDittoMoves();
  const keys = [
    ...pokemon.map((entry) => `pokemon:${entry.slug}`),
    ...items.map((entry) => `item:${entry.slug}`),
    ...recipes.map((entry) => `recipe:${entry.slug}`),
    ...towns.map((entry) => `town:${entry.slug}`),
    ...automation.map((entry) => `automation:${entry.slug}`),
    ...quests.map((entry) => `quest:${entry.slug}`),
    ...treasureMaps.map((entry) => `treasure_map:${entry.slug}`),
    ...collectibles.map((entry) => `collectible:${entry.slug}`),
    ...dittoMoves.map((entry) => `ditto_move:${entry.slug}`),
  ];
  const seen = new Set<string>();
  const duplicateNaturalKeys = keys.filter((key) =>
    seen.has(key) ? true : (seen.add(key), false),
  );
  const itemSlugs = new Set(items.map((entry) => entry.slug));
  const missingRecipeOutputs = recipes
    .filter((recipe) => !itemSlugs.has(recipe.slug))
    .map((recipe) => recipe.slug);
  const unknownIngredientQuantities = recipes
    .flatMap((recipe) => recipe.ingredients)
    .filter((ingredient) => ingredient.quantity === null).length;
  const source = repository.health();
  const counts = {
    pokemon: pokemon.length,
    items: items.length,
    recipes: recipes.length,
    towns: towns.length,
    automation: automation.length,
    quests: quests.length,
    treasureMaps: treasureMaps.length,
    collectibles: collectibles.length,
    dittoMoves: dittoMoves.length,
  };
  return {
    valid:
      source.schema === 'canonical' &&
      source.pages > 0 &&
      duplicateNaturalKeys.length === 0 &&
      missingRecipeOutputs.length === 0,
    source,
    counts,
    duplicateNaturalKeys,
    missingRecipeOutputs,
    unknownIngredientQuantities,
    warnings: [
      ...(unknownIngredientQuantities
        ? [
            `${unknownIngredientQuantities} ingredient quantities remain unknown and are kept in provenance, not coerced into typed rows.`,
          ]
        : []),
      ...source.warnings,
    ],
  };
}

export async function importCanonicalRuntime(
  repository: GameDataRepository,
  connectionString: string,
  options: { readonly allowRemote?: boolean } = {},
): Promise<RuntimeImportResult> {
  assertSafeTarget(connectionString, options.allowRemote === true);
  const validation = validateCanonicalRuntime(repository);
  if (!validation.valid)
    throw new Error(`Canonical validation failed: ${JSON.stringify(validation)}`);
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("set local lock_timeout = '10s'");
    await client.query("set local statement_timeout = '5min'");
    const projections = collectProjections(repository);
    const quantitativeParameters = repository.listQuantitativeParameters();
    const gameId = stableUuid('game:pokemon-pokopia');
    const sourceId = stableUuid('source:pokopia-wiki-snapshot');
    const sourceHash = databaseHash(validation.source.databasePath);
    const snapshotId = stableUuid(`snapshot:${sourceHash}`);
    const runId = stableUuid(`ingestion:${sourceHash}:runtime-v4`);
    await client.query(
      `insert into public.games(id, slug, name)
       values ($1, 'pokemon-pokopia', 'Pokémon Pokopia')
       on conflict (id) do update set name = excluded.name`,
      [gameId],
    );
    await client.query(
      `insert into public.sources(id, name, kind, is_primary)
       values ($1, 'Pokopia canonical snapshot', 'community', false)
       on conflict (id) do update set name = excluded.name`,
      [sourceId],
    );
    await client.query(
      `insert into public.source_snapshots(id, source_id, snapshot_key, captured_at, content_hash, parser_version, manifest_path)
       values ($1, $2, $3, now(), $4, 'runtime-v4', $5)
       on conflict (id) do update set parser_version = excluded.parser_version, manifest_path = excluded.manifest_path`,
      [
        snapshotId,
        sourceId,
        validation.source.snapshot,
        sourceHash,
        validation.source.databasePath,
      ],
    );
    await client.query(
      `insert into public.ingestion_runs(id, source_snapshot_id, parser_version, status, started_at, statistics)
       values ($1, $2, 'runtime-v4', 'running', now(), $3::jsonb)
       on conflict (id) do update set status = 'running', started_at = now(), completed_at = null,
         statistics = excluded.statistics, error_summary = null`,
      [runId, snapshotId, JSON.stringify(validation.counts)],
    );
    const documents = await upsertDocuments(client, snapshotId, projections);
    let assertions = 0;
    let evidence = 0;
    const entities = new Set<string>();
    for (const projection of projections) {
      const source = projection.source;
      const documentId = documents.get(source.url);
      if (!documentId) throw new Error(`Missing source document for ${source.url}`);
      const identity = projectionIdentity(projection);
      await stageProjection(client, runId, documentId, identity, projection);
      await upsertProjection(client, gameId, projection, entities);
      const assertionId = stableUuid(`assertion:${identity}:runtime-projection-v4`);
      const entityId = stableUuid(`entity:${identity}`);
      const assertionHash = sha256(`runtime-projection-v4:${identity}:${stableJson(projection)}`);
      await client.query(
        `insert into public.source_assertions(
          id, subject_entity_id, predicate, value_json, kind, lifecycle,
          verification_status, confidence, assertion_hash
        ) values ($1, $2, 'runtime.canonical_projection', $3::jsonb, 'fact', 'candidate',
          'unverified', 0.8000, $4)
        on conflict (id) do update set value_json = excluded.value_json,
          assertion_hash = excluded.assertion_hash, confidence = excluded.confidence`,
        [assertionId, entityId, JSON.stringify(projection), assertionHash],
      );
      assertions += 1;
      await client.query(
        `insert into public.assertions(assertion_id) values ($1)
         on conflict (assertion_id) do nothing`,
        [assertionId],
      );
      await client.query(
        `insert into public.source_evidence(
          id, assertion_id, source_document_id, locator, excerpt, evidence_hash
        ) values ($1, $2, $3, 'canonical-runtime-projection', $4, $5)
        on conflict (id) do update set excerpt = excluded.excerpt, evidence_hash = excluded.evidence_hash`,
        [
          stableUuid(`evidence:${assertionId}:${documentId}`),
          assertionId,
          documentId,
          projection.name,
          sha256(`${source.url}:${projection.name}`),
        ],
      );
      evidence += 1;
    }
    const quantitativeImport = await upsertQuantitativeParameters(
      client,
      gameId,
      snapshotId,
      quantitativeParameters,
      entities,
    );
    assertions += quantitativeImport.assertions;
    evidence += quantitativeImport.evidence;
    await client.query(
      `update public.ingestion_runs set status = 'completed', completed_at = now(),
        statistics = $2::jsonb where id = $1`,
      [
        runId,
        JSON.stringify({
          ...validation.counts,
          source: validation.source,
          staged: projections.length,
          assertions,
          evidence,
          quantitativeParameters: quantitativeImport.parameters,
        }),
      ],
    );
    await assertPostgresRuntime(client, gameId, projections.length);
    await client.query('commit');
    return {
      mode: 'seed',
      ...validation,
      gameId,
      snapshotId,
      ingestionRunId: runId,
      staged: projections.length,
      entitiesUpserted: entities.size,
      assertionsUpserted: assertions,
      evidenceUpserted: evidence,
      transaction: 'committed',
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function collectProjections(repository: GameDataRepository): Projection[] {
  const items = repository
    .listItems(10_000)
    .map((item) => repository.getItem(item.slug))
    .filter((item): item is ItemDetail => Boolean(item));
  const towns = repository
    .listTowns()
    .map((town) => repository.getTown(town.slug))
    .filter((town): town is TownDetail => Boolean(town));
  return [
    ...repository.listPokemon(10_000),
    ...items,
    ...repository.listRecipes(10_000),
    ...towns,
    ...repository.listAutomationSystems(),
    ...repository.listQuests(),
    ...repository.listTreasureMaps(),
    ...repository.listCollectibles(),
    ...repository.listDittoMoves(),
  ];
}

async function upsertDocuments(
  client: PoolClient,
  snapshotId: string,
  projections: readonly Projection[],
): Promise<Map<string, string>> {
  const sources = new Map(
    projections.map((projection) => [projection.source.url, projection.source]),
  );
  const documents = new Map<string, string>();
  for (const source of sources.values()) {
    const id = stableUuid(`document:${snapshotId}:${source.url}`);
    documents.set(source.url, id);
    await client.query(
      `insert into public.source_documents(
        id, snapshot_id, source_url, canonical_url, document_path, media_type,
        content_hash, title, captured_at, parser_version, extraction_status, extraction_metadata
      ) values ($1, $2, $3, $3, $4, 'text/html', $5, $6, now(), 'runtime-v4',
        'projected', '{"origin":"canonical-sqlite"}'::jsonb)
      on conflict (id) do update set title = excluded.title, extraction_status = excluded.extraction_status`,
      [id, snapshotId, source.url, source.url, sha256(`${snapshotId}:${source.url}`), source.title],
    );
  }
  return documents;
}

async function stageProjection(
  client: PoolClient,
  runId: string,
  documentId: string,
  identity: string,
  projection: Projection,
): Promise<void> {
  const payload = stableJson(projection);
  const payloadHash = sha256(payload);
  await client.query(
    `insert into public.staging_records(
      id, ingestion_run_id, source_document_id, record_kind, natural_key,
      payload, payload_hash, validation_status, validation_messages
    ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, 'valid', '[]'::jsonb)
    on conflict (id) do update set payload = excluded.payload, payload_hash = excluded.payload_hash,
      validation_status = excluded.validation_status, validation_messages = excluded.validation_messages`,
    [
      stableUuid(`staging:${runId}:${identity}`),
      runId,
      documentId,
      projection.kind,
      identity,
      payload,
      payloadHash,
    ],
  );
}

async function upsertProjection(
  client: PoolClient,
  gameId: string,
  projection: Projection,
  entities: Set<string>,
): Promise<void> {
  const identity = projectionIdentity(projection);
  const id = await upsertEntity(
    client,
    gameId,
    identity,
    postgresKind(projection),
    projection.slug,
    projection.name,
    projectionSummary(projection),
    entities,
  );
  if (projection.kind === 'pokemon') {
    await client.query(
      `insert into public.pokemon(id, national_dex_number) values ($1, $2)
       on conflict (id) do update set national_dex_number = excluded.national_dex_number`,
      [id, projection.number],
    );
    for (const assignment of projection.roles)
      await upsertPokemonRole(client, gameId, id, assignment.role, assignment.confidence);
  } else if (projection.kind === 'item') {
    await client.query(`insert into public.items(id) values ($1) on conflict (id) do nothing`, [
      id,
    ]);
    if (projection.storage) {
      const typeId = stableUuid(`storage-type:${gameId}:${projection.storage.type}`);
      await client.query(
        `insert into public.storage_types(id, game_id, slug, name, capacity)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set capacity = excluded.capacity`,
        [
          typeId,
          gameId,
          projection.storage.type,
          projection.storage.type,
          projection.storage.capacity,
        ],
      );
      await client.query(
        `insert into public.containers(item_id, storage_type_id, capacity) values ($1, $2, $3)
         on conflict (item_id) do update set storage_type_id = excluded.storage_type_id,
           capacity = excluded.capacity`,
        [id, typeId, projection.storage.capacity],
      );
    }
  } else if (projection.kind === 'recipe') {
    await client.query(
      `insert into public.recipes(id, batch_size, batch_size_status)
       values ($1, null, 'unknown')
       on conflict (id) do update set
         batch_size = case when public.recipes.batch_size_status in ('source_backed', 'accepted_measurement')
           then public.recipes.batch_size else null end,
         batch_size_status = case when public.recipes.batch_size_status in ('source_backed', 'accepted_measurement')
           then public.recipes.batch_size_status else 'unknown' end`,
      [id],
    );
    const outputId = stableUuid(`entity:item:${projection.slug}`);
    await client.query(
      `insert into public.recipe_outputs(recipe_id, item_id, quantity, quantity_status)
       values ($1, $2, null, 'unknown')
       on conflict (recipe_id, item_id) do update set
         quantity = case when public.recipe_outputs.quantity_status in ('source_backed', 'accepted_measurement')
           then public.recipe_outputs.quantity else null end,
         quantity_status = case when public.recipe_outputs.quantity_status in ('source_backed', 'accepted_measurement')
           then public.recipe_outputs.quantity_status else 'unknown' end`,
      [id, outputId],
    );
    for (const ingredient of projection.ingredients) {
      const itemId = await upsertEntity(
        client,
        gameId,
        `item:${ingredient.slug}`,
        'item',
        ingredient.slug,
        ingredient.name,
        null,
        entities,
      );
      await client.query(`insert into public.items(id) values ($1) on conflict (id) do nothing`, [
        itemId,
      ]);
      if (ingredient.quantity !== null)
        await client.query(
          `insert into public.recipe_ingredients(recipe_id, item_id, quantity)
           values ($1, $2, $3)
           on conflict (recipe_id, item_id, group_key) do update set quantity = excluded.quantity`,
          [id, itemId, ingredient.quantity],
        );
    }
  } else if (projection.kind === 'town') {
    await client.query(`insert into public.towns(id) values ($1) on conflict (id) do nothing`, [
      id,
    ]);
    for (let level = 1; level <= (projection.maxEnvironmentLevel ?? 0); level += 1)
      await client.query(
        `insert into public.environment_levels(id, town_id, level)
         values ($1, $2, $3) on conflict (id) do nothing`,
        [stableUuid(`town-level:${projection.slug}:${level}`), id, level],
      );
  } else if (projection.kind === 'automation') {
    await client.query(
      `insert into public.automation_systems(id) values ($1) on conflict (id) do nothing`,
      [id],
    );
  } else if (projection.kind === 'quest') {
    await client.query(
      `insert into public.quests(id, repeatable) values ($1, $2)
       on conflict (id) do update set repeatable = excluded.repeatable`,
      [id, projection.repeatable],
    );
    for (const step of projection.steps)
      await client.query(
        `insert into public.quest_steps(id, quest_id, step_order, description)
         values ($1, $2, $3, $4)
         on conflict (quest_id, step_order) do update set description = excluded.description`,
        [stableUuid(`quest-step:${identity}:${step.order}`), id, step.order, step.description],
      );
  } else if (projection.kind === 'treasure_map') {
    const rewardId = await upsertEntity(
      client,
      gameId,
      `item:${projection.reward.slug}`,
      'item',
      projection.reward.slug,
      projection.reward.name,
      null,
      entities,
    );
    await client.query(`insert into public.items(id) values ($1) on conflict (id) do nothing`, [
      rewardId,
    ]);
    const recipeId = projection.recipeUnlock
      ? stableUuid(`entity:recipe:${projection.recipeUnlock.slug}`)
      : null;
    await client.query(
      `insert into public.treasure_maps(
        id, map_number, area_name, location_description, reward_item_id, recipe_unlock_id
       ) values ($1, $2, $3, $4, $5,
         case when exists(select 1 from public.recipes where id = $6) then $6 else null end)
       on conflict (id) do update set map_number = excluded.map_number,
         area_name = excluded.area_name, location_description = excluded.location_description,
         reward_item_id = excluded.reward_item_id, recipe_unlock_id = excluded.recipe_unlock_id`,
      [id, projection.number, projection.area, projection.location, rewardId, recipeId],
    );
    for (const requirement of projection.requirements) {
      const requirementId = await upsertEntity(
        client,
        gameId,
        `${requirement.kind}:${requirement.slug}`,
        requirement.kind,
        requirement.slug,
        requirement.name,
        null,
        entities,
      );
      if (requirement.kind === 'item')
        await client.query(`insert into public.items(id) values ($1) on conflict (id) do nothing`, [
          requirementId,
        ]);
      await client.query(
        `insert into public.treasure_map_requirements(
          treasure_map_id, requirement_entity_id, requirement_kind
         ) values ($1, $2, $3) on conflict (treasure_map_id, requirement_entity_id)
         do update set requirement_kind = excluded.requirement_kind`,
        [id, requirementId, requirement.kind],
      );
    }
  } else if (projection.kind === 'collectible') {
    await client.query(
      `insert into public.collectibles(
        id, collectible_type, catalog_number, description, location_description, origin_game
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set collectible_type = excluded.collectible_type,
         catalog_number = excluded.catalog_number, description = excluded.description,
         location_description = excluded.location_description, origin_game = excluded.origin_game`,
      [
        id,
        projection.collectibleType,
        projection.catalogNumber,
        projection.description,
        projection.locations,
        projection.originGame,
      ],
    );
  } else {
    await client.query(
      `insert into public.ditto_moves(
        id, move_class, effect, unlock_description, meal_name, meal_effect
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (id) do update set move_class = excluded.move_class, effect = excluded.effect,
         unlock_description = excluded.unlock_description, meal_name = excluded.meal_name,
         meal_effect = excluded.meal_effect`,
      [
        id,
        projection.moveClass,
        projection.effect,
        projection.unlock,
        projection.mealBoost?.meal ?? null,
        projection.mealBoost?.effect ?? null,
      ],
    );
    for (const pokemonName of projection.learnedFromPokemon) {
      await client.query(
        `insert into public.ditto_move_pokemon(ditto_move_id, pokemon_id)
         select $1, pokemon.id
         from public.pokemon pokemon
         join public.entities entity on entity.id = pokemon.id
         where entity.game_id = $2 and lower(entity.display_name) = lower($3)
         on conflict (ditto_move_id, pokemon_id) do nothing`,
        [id, gameId, pokemonName],
      );
    }
  }
  if ('classification' in projection)
    await client.query(
      `insert into public.entity_content_classifications(entity_id, scope, status, reason)
       values ($1, $2::public.content_scope, $3::public.classification_status, $4)
       on conflict (entity_id) do update set scope = excluded.scope, status = excluded.status,
         reason = excluded.reason, updated_at = now()`,
      [
        id,
        projection.classification.scope,
        projection.classification.status,
        projection.classification.reason,
      ],
    );
  await client.query(
    `insert into public.search_entries(entity_id, title, body, aliases_text)
     values ($1, $2, $3, $4)
     on conflict (entity_id) do update set title = excluded.title, body = excluded.body,
       aliases_text = excluded.aliases_text, updated_at = now()`,
    [
      id,
      projection.name,
      projectionSummary(projection) ?? '',
      projection.slug.replaceAll('-', ' '),
    ],
  );
}

async function upsertEntity(
  client: PoolClient,
  gameId: string,
  identity: string,
  kind: string,
  slug: string,
  displayName: string,
  summary: string | null,
  entities: Set<string>,
): Promise<string> {
  const id = stableUuid(`entity:${identity}`);
  await client.query(
    `insert into public.entities(id, game_id, kind, slug, display_name, summary)
     values ($1, $2, $3::public.entity_kind, $4, $5, $6)
     on conflict (id) do update set display_name = excluded.display_name, summary = excluded.summary`,
    [id, gameId, kind, postgresSlug(slug), displayName, summary],
  );
  entities.add(id);
  return id;
}

async function upsertPokemonRole(
  client: PoolClient,
  gameId: string,
  pokemonId: string,
  role: RoleSlug,
  effectiveness: number,
): Promise<void> {
  const roleId = stableUuid(`role:${gameId}:${role}`);
  await client.query(
    `insert into public.roles(id, game_id, slug, name) values ($1, $2, $3, $4)
     on conflict (id) do update set name = excluded.name`,
    [roleId, gameId, role, role.replaceAll('-', ' ')],
  );
  await client.query(
    `insert into public.pokemon_roles(id, pokemon_id, role_id, effectiveness)
     values ($1, $2, $3, $4)
     on conflict (id) do update set effectiveness = excluded.effectiveness`,
    [stableUuid(`pokemon-role:${pokemonId}:${role}`), pokemonId, roleId, effectiveness],
  );
}

async function upsertQuantitativeParameters(
  client: PoolClient,
  gameId: string,
  snapshotId: string,
  parameters: readonly QuantitativeParameter[],
  entities: Set<string>,
): Promise<{ parameters: number; assertions: number; evidence: number }> {
  const importedAssertionIds = new Set<string>();
  for (const parameter of parameters) {
    const postgresEntityKind = parameter.subjectKind;
    const identity =
      parameter.subjectKind === 'automation_system'
        ? `automation:${parameter.subjectSlug}`
        : `quantitative:${parameter.subjectKind}:${parameter.subjectSlug}`;
    const subjectId = await upsertEntity(
      client,
      gameId,
      identity,
      postgresEntityKind,
      parameter.subjectSlug,
      parameter.subjectSlug.replaceAll('-', ' '),
      parameter.evidenceText,
      entities,
    );
    if (parameter.subjectKind === 'automation_system')
      await client.query(
        `insert into public.automation_systems(id) values ($1) on conflict (id) do nothing`,
        [subjectId],
      );
    const documentId = stableUuid(`document:${snapshotId}:${parameter.source.url}`);
    await client.query(
      `insert into public.source_documents(
        id, snapshot_id, source_url, canonical_url, document_path, media_type,
        content_hash, title, captured_at, parser_version, extraction_status, extraction_metadata
      ) values ($1, $2, $3, $3, $3, 'text/html', $4, $5, now(), 'pokopia-quantitative-v1',
        'projected', '{"origin":"canonical-quantitative-sqlite"}'::jsonb)
      on conflict (id) do update set title = excluded.title,
        parser_version = excluded.parser_version, extraction_status = excluded.extraction_status`,
      [
        documentId,
        snapshotId,
        parameter.source.url,
        sha256(`${snapshotId}:${parameter.source.url}`),
        parameter.source.title,
      ],
    );
    const proposedAssertionId = stableUuid(`quantitative-assertion:${parameter.id}`);
    const assertionHash = sha256(
      stableJson({
        subject: parameter.subjectSlug,
        predicate: parameter.predicate,
        value: parameter.value,
        unit: parameter.unit,
        qualifier: parameter.qualifier,
        version: parameter.gameVersion,
      }),
    );
    const assertionResult = await client.query<{ id: string }>(
      `insert into public.source_assertions(
        id, subject_entity_id, predicate, value_number, unit, kind, lifecycle,
        verification_status, confidence, assertion_hash
      ) values ($1, $2, $3, $4, $5, 'fact', 'candidate', 'unverified', $6, $7)
      on conflict (assertion_hash) do update set confidence = greatest(
        public.source_assertions.confidence, excluded.confidence
      ) returning id`,
      [
        proposedAssertionId,
        subjectId,
        parameter.predicate,
        parameter.value,
        parameter.unit,
        parameter.evidenceConfidence,
        assertionHash,
      ],
    );
    const assertionId = assertionResult.rows[0]?.id;
    if (!assertionId) throw new Error(`Quantitative assertion upsert failed: ${parameter.id}`);
    importedAssertionIds.add(assertionId);
    await client.query(
      `insert into public.assertions(assertion_id) values ($1)
       on conflict (assertion_id) do nothing`,
      [assertionId],
    );
    await client.query(
      `insert into public.source_evidence(
        id, assertion_id, source_document_id, locator, excerpt, evidence_hash
      ) values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update set locator = excluded.locator, excerpt = excluded.excerpt,
        evidence_hash = excluded.evidence_hash`,
      [
        stableUuid(`quantitative-evidence:${assertionId}:${documentId}`),
        assertionId,
        documentId,
        parameter.locator,
        parameter.evidenceText,
        sha256(`${parameter.source.url}:${parameter.locator}:${parameter.evidenceText}`),
      ],
    );
    await client.query(
      `insert into public.quantitative_parameters(
        id, subject_entity_id, predicate, value, unit, qualifier, derivation, assertion_id,
        parser_confidence, evidence_confidence, local_assertion_status, review_status,
        content_scope, game_version, payload
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'candidate', $12, $13, $14::jsonb)
      on conflict (subject_entity_id, predicate, qualifier, game_version) do update set
        value = excluded.value, unit = excluded.unit,
        qualifier = excluded.qualifier, parser_confidence = excluded.parser_confidence,
        evidence_confidence = excluded.evidence_confidence,
        local_assertion_status = excluded.local_assertion_status,
        content_scope = excluded.content_scope, game_version = excluded.game_version,
        payload = excluded.payload, updated_at = now()`,
      [
        stableUuid(`quantitative-parameter:${parameter.id}`),
        subjectId,
        parameter.predicate,
        parameter.value,
        parameter.unit,
        parameter.qualifier,
        parameter.derivation,
        assertionId,
        parameter.parserConfidence,
        parameter.evidenceConfidence,
        parameter.assertionStatus,
        parameter.contentScope,
        parameter.gameVersion,
        stableJson(parameter),
      ],
    );
  }
  return {
    parameters: importedAssertionIds.size,
    assertions: importedAssertionIds.size,
    evidence: parameters.length,
  };
}

async function assertPostgresRuntime(
  client: PoolClient,
  gameId: string,
  expectedProjections: number,
): Promise<void> {
  const result = await client.query<{ projections: string; orphan_evidence: string }>(
    `select
      (select count(*)::text from public.source_assertions sa
       join public.entities e on e.id = sa.subject_entity_id
       where e.game_id = $1 and sa.predicate = 'runtime.canonical_projection') as projections,
      (select count(*)::text from public.source_evidence se
       left join public.source_assertions sa on sa.id = se.assertion_id
       where sa.id is null) as orphan_evidence`,
    [gameId],
  );
  const row = result.rows[0];
  if (!row || Number(row.projections) !== expectedProjections || Number(row.orphan_evidence) !== 0)
    throw new Error(`PostgreSQL parity invariant failed: ${JSON.stringify(row)}`);
}

function projectionIdentity(projection: Projection): string {
  return `${projection.kind}:${projection.slug}`;
}

function postgresKind(projection: Projection): string {
  return projection.kind === 'automation' ? 'automation_system' : projection.kind;
}

function projectionSummary(projection: Projection): string | null {
  if (projection.kind === 'pokemon') return projection.specialty;
  if (projection.kind === 'item') return projection.description;
  if (projection.kind === 'town') return projection.description;
  if (projection.kind === 'automation') return `${projection.what} ${projection.why}`;
  if (projection.kind === 'recipe')
    return projection.ingredients.map((ingredient) => ingredient.name).join(', ');
  if (projection.kind === 'quest') return projection.description;
  if (projection.kind === 'treasure_map') return projection.location;
  if (projection.kind === 'collectible') return projection.description;
  return `${projection.effect} ${projection.unlock}`;
}

function postgresSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function assertSafeTarget(connectionString: string, allowRemote: boolean): void {
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  if (!local && !allowRemote)
    throw new Error(
      'Refusing to seed a remote PostgreSQL target. Use --allow-remote together with POKOPIA_ALLOW_REMOTE_SEED=I_UNDERSTAND only after review.',
    );
}

function stableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function databaseHash(path: string): string {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    return sha256(path);
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([left], [right]) => left.localeCompare(right)),
        )
      : item,
  );
}
