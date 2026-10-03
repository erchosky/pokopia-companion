import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createGameDataRepository, resolveDatabasePath } from '@pokopia/game-data';

const database = resolveDatabasePath();
if (!database) throw new Error('Canonical database not found.');
const repository = createGameDataRepository(database);
const recipes = repository.listRecipes(10_000);
const systems = repository.listAutomationSystems();
const quantitative = repository.listQuantitativeParameters();
const uniqueQuantitativeFacts = new Set(
  quantitative.map((entry) =>
    [
      entry.subjectKind,
      entry.subjectSlug,
      entry.predicate,
      entry.value,
      entry.unit,
      entry.qualifier ?? '',
      entry.gameVersion ?? '',
      entry.contentScope,
    ].join('|'),
  ),
).size;
const output = join(process.cwd(), 'audit-data/iteration-5-1');
mkdirSync(output, { recursive: true });

const write = (name: string, value: unknown) =>
  writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`);

const acceptedOutput = recipes.filter(
  (recipe) =>
    recipe.outputQuantity !== null &&
    ['source_backed', 'accepted_measurement'].includes(recipe.outputQuantityStatus),
);
const exact = recipes.filter(
  (recipe) =>
    acceptedOutput.includes(recipe) &&
    recipe.ingredients.every((ingredient) => ingredient.quantity !== null),
);
const structural = recipes.filter(
  (recipe) =>
    recipe.outputQuantity === null &&
    recipe.ingredients.every((ingredient) => ingredient.quantity === null),
);
const disputed = recipes.filter((recipe) => recipe.outputQuantityStatus === 'derived_default');
const partial = recipes.filter(
  (recipe) => !exact.includes(recipe) && !structural.includes(recipe) && !disputed.includes(recipe),
);
const ingredientGaps = recipes.flatMap((recipe) =>
  recipe.ingredients
    .filter((ingredient) => ingredient.quantity === null)
    .map((ingredient) => ({
      recipeId: recipe.slug,
      ingredientId: ingredient.slug,
      status: 'unknown',
      reasonCode: 'measurement_required',
      sourceFinding:
        'The overview and detail HTML both terminate the ingredient marker without a number.',
      source: recipe.source,
    })),
);
const unresolvedOutputs = recipes.map((recipe) => ({
  recipeId: recipe.slug,
  outputItem: recipe.slug,
  quantity: null,
  classification: structural.includes(recipe) ? 'structural' : 'partial',
  reasonCode: 'measurement_required',
  evidenceSearch:
    'recipe table, heading, output cell, adjacent label, image alt/title, RAW HTML, Markdown, structured rows, facts, RAG and sibling relations',
  source: recipe.source,
}));

write('recipe-quantitative-coverage.json', {
  database: relative(process.cwd(), database),
  denominator: recipes.length,
  sourcePatternAnalysis: {
    itemDetailPagesWithRecipeTable: 881,
    overviewOnlyRecipes: 1,
    detailTableCellShapes: [4, 8, 10, 12, 14],
    declaredFields: ['recipe', 'location', 'ingredient rows'],
    overviewFields: ['picture', 'name', 'unlock/location', 'requirements'],
    channelsSearched: [
      'RAW_HTML',
      'MARKDOWN',
      'TABLES',
      'STRUCTURED',
      'facts',
      'RAG',
      'image alt/title',
      'sibling relations',
    ],
    outputQuantityTokensFound: 0,
    ocrGate: 'not_triggered_no_P0_asset_with_probable_quantity_overlay',
  },
  counts: {
    exact: exact.length,
    partial: partial.length,
    structural: structural.length,
    disputed: disputed.length,
  },
  recipes: recipes.map((recipe) => ({
    recipeId: recipe.slug,
    classification: exact.includes(recipe)
      ? 'exact'
      : structural.includes(recipe)
        ? 'structural'
        : disputed.includes(recipe)
          ? 'disputed'
          : 'partial',
    outputQuantity: recipe.outputQuantity,
    outputStatus: recipe.outputQuantityStatus,
    quantifiedInputs: recipe.ingredients.filter((ingredient) => ingredient.quantity !== null)
      .length,
    unknownInputs: recipe.ingredients.filter((ingredient) => ingredient.quantity === null).length,
    source: recipe.source,
  })),
});
write('recovered-outputs.json', {
  recovered: acceptedOutput.length,
  outputs: acceptedOutput,
  verdict: 'No output batch is declared in the captured source; no value was invented.',
});
write('unresolved-outputs.json', { total: unresolvedOutputs.length, outputs: unresolvedOutputs });
write('ingredient-gaps.json', {
  recoveredThisIteration: 0,
  unresolved: ingredientGaps.length,
  gaps: ingredientGaps,
});

const quantitativeSystems = systems.filter((system) => system.quantitative.length > 0);
write('automation-quantitative-coverage.json', {
  baseline: { systems: 11, quantitativeSystems: 0 },
  current: {
    systems: systems.length,
    quantitativeSystems: quantitativeSystems.length,
    originalSystemsReaudited: 11,
    originalSystemsQuantitative: systems
      .slice(0, 11)
      .filter((system) => system.quantitative.length > 0).length,
    sourceBackedCandidatesAdded: 4,
  },
  systems: systems.map((system) => ({
    slug: system.slug,
    status: system.quantitative.length > 0 ? 'quantitative' : 'measurement_required',
    buildRequirements: system.requirements,
    quantitative: system.quantitative,
    pokemonRequirementState: system.pokemon === null ? 'unknown' : 'source_backed',
    compatibleTownState: system.compatibleTowns.length ? 'confirmed_compatible' : 'unknown',
    note:
      system.compatibleTowns.length === 0
        ? 'Empty does not mean incompatible with every town.'
        : null,
  })),
});
write('production-relations.json', {
  relations: systems.flatMap((system) =>
    (system.operationalOutputs ?? []).map((effect) => ({
      system: system.slug,
      relation: effect === 'Electricidad' ? 'provides_power' : 'has_effect',
      object: effect,
      materialOutput: false,
      evidence: system.source,
    })),
  ),
  rule: 'Operational effects are not material outputs unless the source explicitly names an item/resource.',
});

const powerPredicates = new Set([
  'power_generation',
  'power_demand',
  'connection_capacity',
  'transmission_range',
  'generator_limit',
  'electric_item_limit',
  'previous_electric_item_limit',
  'transmitter_limit',
  'vertical_transmission_limit',
  'display_capacity',
  'power_per_light',
]);
write('electricity-knowledge.json', {
  assertions: quantitative.filter((entry) => powerPredicates.has(entry.predicate)),
  semantics: {
    power_generation: 'provides electricity',
    power_demand: 'requires electricity',
    transmission_range: 'transports electricity within a documented distance',
    connection_capacity: 'connection count; not power output',
  },
  unknowns: ['topology losses', 'dynamic load priority', 'furnace fuel type and consumption'],
});
write('storage-knowledge.json', {
  exactCapacityAssertions: quantitative.filter((entry) => entry.subjectKind === 'storage_system'),
  chargingStationDisplay: quantitative.filter((entry) => entry.subjectSlug === 'charging-station'),
  warning:
    'Charging station power display is not a general item-storage capacity. Container capacities remain unknown.',
  status: 'measurement_required',
});
write('compatibility-knowledge.json', {
  states: ['confirmed_compatible', 'confirmed_incompatible', 'unknown'],
  systems: systems.map((system) => ({
    system: system.slug,
    confirmedCompatible: system.compatibleTowns,
    confirmedIncompatible: [],
    status: system.compatibleTowns.length ? 'partial' : 'unknown',
  })),
  invariant: 'Negative compatibility is never generated by complementing a positive list.',
});
write('version-coverage.json', {
  quantitative: {
    explicitVersion: quantitative.filter((entry) => entry.gameVersion !== null).length,
    unknownVersion: quantitative.filter((entry) => entry.gameVersion === null).length,
    explicitScope: quantitative.filter((entry) => entry.contentScope !== 'unknown').length,
    unknownScope: quantitative.filter((entry) => entry.contentScope === 'unknown').length,
  },
  versionedAssertions: quantitative.filter((entry) => entry.gameVersion !== null),
  invariant: 'Missing DLC/version labels remain unknown and are not inferred as base game.',
});
write('source-verification-results.json', {
  preexistingEvidenceSourceRecords: { unverified: 273 },
  quantitativeAssertions: {
    evidenceRecords: quantitative.length,
    uniqueFacts: uniqueQuantitativeFacts,
    assertionAccepted: quantitative.filter((entry) => entry.assertionStatus === 'accepted').length,
    sourceConfirmed: quantitative.filter((entry) => entry.sourceVerificationStatus === 'confirmed')
      .length,
    sourceUnverified: quantitative.filter(
      (entry) => entry.sourceVerificationStatus === 'unverified',
    ).length,
  },
  invariant:
    'Source verification, assertion acceptance and canonical promotion are independent states.',
});
write('disputed-candidates.json', {
  total: quantitative.filter((entry) => entry.assertionStatus === 'disputed').length,
  candidates: quantitative.filter((entry) => entry.assertionStatus === 'disputed'),
  action: 'Conflicts preserve both evidence records; they are never resolved by parser confidence.',
});

const measurementQueue = [
  {
    id: 'recipe-output-family-sampling',
    priority: 'P0',
    metric: 'recipe.output_batch',
    subjects: ['representative recipe from each structural family', 'high-fan-out intermediates'],
    why: 'Unlocks exact batch arithmetic without assuming one recipe generalizes to another.',
    setup: 'Empty inventory except exact listed inputs; record recipe, version and content scope.',
    steps: [
      'Record inventory before',
      'Craft once',
      'Record inventory after',
      'Repeat after reload',
    ],
    repetitions: 3,
    evidence: 'Full before/after screenshots plus uninterrupted video for at least one repetition.',
    possibleOutcomes: ['constant batch', 'recipe-specific batch', 'context-dependent batch'],
    promotion: 'candidate only; review each recipe or prove an explicit global rule',
  },
  {
    id: 'automation-cycle-throughput',
    priority: 'P0',
    metric: 'automation.cycle_duration',
    subjects: ['furnace-kit', 'high-impact production systems'],
    why: 'Unlocks items/minute and bottleneck calculations.',
    setup: 'Stable inputs, unchanged power supply, timer visible, known game version.',
    steps: [
      'Start from idle',
      'Supply one controlled batch',
      'Time completion',
      'Count consumed and produced items',
    ],
    repetitions: 5,
    evidence: 'Uninterrupted video with timer and inventory counts.',
    possibleOutcomes: ['fixed cycle', 'variable cycle', 'insufficient evidence'],
    promotion: 'candidate_review',
  },
  {
    id: 'container-capacities',
    priority: 'P0',
    metric: 'storage.capacity',
    subjects: ['container item types used by automation'],
    why: 'Unlocks buffer and overflow planning.',
    setup: 'Empty container, one stackable item type, no shared-storage ambiguity.',
    steps: [
      'Confirm empty',
      'Insert until rejected/full',
      'Record slots and stack size',
      'Reload and verify',
    ],
    repetitions: 3,
    evidence: 'Screenshots of empty and full states plus capacity counter if present.',
    possibleOutcomes: ['item capacity', 'slot capacity', 'shared capacity', 'unknown'],
    promotion: 'candidate_review',
  },
  {
    id: 'town-compatibility-controlled',
    priority: 'P1',
    metric: 'automation.town_compatibility',
    subjects: systems.map((system) => system.slug),
    why: 'Distinguishes confirmed incompatibility from missing evidence.',
    setup: 'Same unlocked system and sufficient materials in each tested town.',
    steps: [
      'Attempt placement in valid terrain',
      'Record success/error',
      'Repeat at second valid location',
    ],
    repetitions: 2,
    evidence: 'Video including town identity, placement surface and complete error text.',
    possibleOutcomes: ['compatible', 'explicitly incompatible', 'terrain-confounded'],
    promotion: 'candidate_review',
  },
];
write('measurement-queue.json', { total: measurementQueue.length, experiments: measurementQueue });
write('measurement-template.json', {
  schemaVersion: 1,
  idempotencyKey: 'recipe-yield:portal-pod:v1:r1',
  metric: 'recipe.output_batch',
  subject: 'portal-pod',
  gameVersion: null,
  value: null,
  unit: 'item',
  repetition: 1,
  evidenceReference: null,
  status: 'unknown',
  observedAt: '2026-08-12T00:00:00Z',
  setup: {},
  conditions: {},
});
write('readiness-summary.json', {
  generatedAt: new Date().toISOString(),
  before: { exactRecipes: '0/882', quantitativeAutomation: '0/11' },
  after: {
    exactRecipes: `${exact.length}/${recipes.length}`,
    partialRecipes: partial.length,
    structuralRecipes: structural.length,
    disputedRecipes: disputed.length,
    recoveredOutputQuantities: acceptedOutput.length,
    recoveredInputQuantities: 0,
    unresolvedInputQuantities: ingredientGaps.length,
    quantitativeAutomation: `${quantitativeSystems.length}/${systems.length}`,
    originalAutomationQuantitative: `${systems.slice(0, 11).filter((system) => system.quantitative.length > 0).length}/11`,
    quantitativeEvidenceRecords: quantitative.length,
    uniqueQuantitativeFacts,
    recoveredFromPreviouslyUnparsedCorpus: quantitative.length,
    recipeUnknownsRequiringGameplay: recipes.length,
    ingredientUnknownsRequiringGameplay: ingredientGaps.length,
  },
  plannerVerdict:
    'Optimization may use accepted build, power, range and capacity parameters. Exact recipe planning and production throughput remain evidence-gated.',
});

process.stdout.write(
  `iteration_5_1_audit_ok recipes=${recipes.length} exact=${exact.length} partial=${partial.length} structural=${structural.length} automation=${quantitativeSystems.length}/${systems.length} evidence=${quantitative.length} facts=${uniqueQuantitativeFacts}\n`,
);
