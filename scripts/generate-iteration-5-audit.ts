import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createGameDataRepository, resolveDatabasePath } from '@pokopia/game-data';
import {
  buildCraftGraph,
  calculateCraftPlan,
  evaluateAutomation,
  rulesFromAutomation,
  rulesFromRecipes,
  simulateAction,
  type InventoryItemState,
} from '@pokopia/rules';

const database = resolveDatabasePath();
if (!database) throw new Error('Canonical database not found.');
const databaseLabel = relative(process.cwd(), database);
const repository = createGameDataRepository(database);
const recipes = repository.listRecipes(10_000);
const systems = repository.listAutomationSystems();
const graph = buildCraftGraph(recipes);
const output = join(process.cwd(), 'audit-data/iteration-5');
mkdirSync(output, { recursive: true });

const write = (name: string, value: unknown) =>
  writeFileSync(join(output, name), `${JSON.stringify(value, null, 2)}\n`);

const exactOutput = recipes.filter(
  (recipe) =>
    recipe.outputQuantity !== null &&
    ['source_backed', 'accepted_measurement'].includes(recipe.outputQuantityStatus),
);
const unknownIngredients = recipes.flatMap((recipe) =>
  recipe.ingredients
    .filter((ingredient) => ingredient.quantity === null)
    .map((ingredient) => ({ recipe: recipe.slug, ingredient: ingredient.slug })),
);
const recursiveRecipes = new Set(
  graph.edges
    .filter((edge) => recipes.some((recipe) => recipe.slug === edge.to))
    .map((edge) => edge.from),
);
const inverseReferenced = new Set(Object.keys(graph.producesByIngredient));

write('crafting-coverage.json', {
  database: databaseLabel,
  totalRecipes: recipes.length,
  structuralRecipes: recipes.filter((recipe) => recipe.ingredients.length > 0).length,
  ingredientEdges: graph.edges.length,
  exactOutputBatch: exactOutput.length,
  unknownOutputBatch: recipes.length - exactOutput.length,
  unknownIngredientQuantities: unknownIngredients.length,
  verdict:
    exactOutput.length === recipes.length
      ? 'quantitative-ready'
      : 'structural-only-until-output-batches-are-accepted',
});
write('recursive-coverage.json', {
  recipesWithSubrecipes: recursiveRecipes.size,
  recipesReferencedByOtherRecipes: recipes.filter((recipe) => inverseReferenced.has(recipe.slug))
    .length,
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  alternativeOutputs: graph.nodes.filter((node) => node.recipeAlternatives > 1),
});
write('inventory-migration.json', {
  schema: 5,
  invariants: [
    'V4 item true -> ownership owned + quantityState unknown + quantity null',
    'V4 item false -> ownership not_owned + quantityState confirmed + quantity 0',
    'absence -> unknown, never zero',
    'negative, non-integer and over-limit quantities are rejected',
  ],
});
write('unknown-values.json', {
  recipeOutputBatches: recipes
    .filter((recipe) => recipe.outputQuantity === null || recipe.outputQuantityStatus === 'unknown')
    .map((recipe) => recipe.slug),
  ingredientQuantities: unknownIngredients,
  automationThroughput: systems.map((system) => system.slug),
  note: 'Lists are unknown, not zero and not false.',
});

const automationCoverage = systems.map((system) => ({
  slug: system.slug,
  buildRequirements: system.requirements.length,
  unknownBuildQuantities: system.requirements.filter((entry) => entry.quantity === null).length,
  infrastructure: system.infrastructure?.length ?? 0,
  operationalInputs: system.operationalInputs?.length ?? 0,
  effects: system.operationalOutputs?.length ?? 0,
  pokemonRoles: system.pokemon?.length ?? 0,
  compatibleTowns: system.compatibleTowns.length,
  contentScope: system.contentScope,
  gameVersion: system.gameVersion,
  throughput: 'unknown',
}));
write('automation-coverage.json', {
  total: systems.length,
  systems: automationCoverage,
});
write('production-chain-coverage.json', {
  totalSystems: systems.length,
  structuralChains: systems.filter(
    (system) => system.requirements.length > 0 && (system.operationalOutputs?.length ?? 0) > 0,
  ).length,
  quantitativeChains: systems.filter((system) => system.quantitative.length > 0).length,
  unavailableParameters: ['recipe output batch', 'production throughput', 'storage capacity'],
});

const recipeRules = rulesFromRecipes(recipes);
const automationRules = rulesFromAutomation(systems);
write('rule-coverage.json', {
  totalRules: recipeRules.length + automationRules.length,
  recipeRules: recipeRules.length,
  automationRules: automationRules.length,
  families: [...recipeRules, ...automationRules].reduce<Record<string, number>>((counts, rule) => {
    counts[rule.family] = (counts[rule.family] ?? 0) + 1;
    return counts;
  }, {}),
  disabled: [...recipeRules, ...automationRules].filter((rule) => !rule.enabled).length,
  deprecated: [...recipeRules, ...automationRules].filter((rule) => rule.deprecated).length,
});
write('version-coverage.json', {
  recipes: recipes.reduce<Record<string, number>>((counts, recipe) => {
    const scope = recipe.source.verificationStatus === 'confirmed' ? 'source-confirmed' : 'unknown';
    counts[scope] = (counts[scope] ?? 0) + 1;
    return counts;
  }, {}),
  automation: automationCoverage.reduce<Record<string, number>>((counts, system) => {
    const scope = system.contentScope ?? 'unknown';
    counts[scope] = (counts[scope] ?? 0) + 1;
    return counts;
  }, {}),
  note: 'Unknown version/scope is preserved and is not treated as base game.',
});

const portal = recipes.find((recipe) => recipe.slug === 'portal-pod');
const portalPlan = portal ? calculateCraftPlan(recipes, portal.slug, 20) : null;
const doors = systems.find((system) => system.slug === 'automatic-doors');
const automationTrace = doors
  ? evaluateAutomation(
      doors,
      { slug: 'palette-town', name: 'Palette Town' },
      {
        inventory: Object.fromEntries(
          doors.requirements.map((entry) => [
            entry.slug,
            { ownership: 'yes', quantity: entry.quantity } satisfies InventoryItemState,
          ]),
        ),
        residentRoles: [],
        townLevel: null,
        infrastructure: {},
        built: 'yes',
      },
    )
  : null;
write('trace-samples.json', {
  portalPod20: portalPlan?.trace ?? 'recipe-not-found',
  automaticDoors: automationTrace?.trace ?? 'system-not-found',
});

const simulationSnapshot = {
  inventory: { ore: { ownership: 'no' as const, quantity: 0 } },
  townLevels: {},
  infrastructure: {},
  builtSystems: [],
  unlocks: {},
};
const simulation = simulateAction(
  simulationSnapshot,
  { kind: 'craft', recipeSlug: 'fixture-ingot', quantity: 1 },
  [
    {
      slug: 'fixture-ingot',
      name: 'Fixture ingot',
      outputQuantity: 1,
      outputQuantityStatus: 'source_backed',
      ingredients: [{ slug: 'ore', name: 'Ore', quantity: 2 }],
    },
  ],
);
write('simulation-cases.json', {
  blockedCraft: simulation,
  immutableInput: JSON.stringify(simulationSnapshot) === JSON.stringify(simulation.before),
});
write('adversarial-cases.json', {
  coveredByTests: [
    'cycle',
    'huge requested quantity',
    'multiple recipe alternatives',
    'confirmed zero vs unknown inventory',
    'shared intermediate surplus',
    'derived default batch quarantine',
    'unknown town compatibility',
    'unaccepted measurement ignored',
    'immutable blocked simulation',
    'corrupt and future player-state recovery',
  ],
});
write('p0-evidence-queue.json', {
  priority: 'P0',
  items: [
    {
      domain: 'crafting',
      gap: '882 output batch sizes are not evidence-backed',
      protocol: 'Recipe yield and batch size',
      blocking: ['exact N-copy plans', 'exact recursive totals', 'exact simulation mutation'],
    },
    {
      domain: 'automation',
      gap: 'throughput, cycle duration and consumption are not accepted measurements',
      protocol: 'Automation throughput',
      blocking: ['items/min', 'time estimates', 'throughput bottlenecks'],
    },
    {
      domain: 'automation',
      gap: 'electricity capacity/range and town compatibility are partial',
      protocol: 'Automation range and controlled compatibility verification',
      blocking: ['layout simulation', 'negative compatibility claims'],
    },
  ],
});
write('summary.json', {
  generatedAt: new Date().toISOString(),
  database: databaseLabel,
  recipes: recipes.length,
  automationSystems: systems.length,
  ruleCount: recipeRules.length + automationRules.length,
  structuralProductionChains: systems.filter(
    (system) => system.requirements.length > 0 && (system.operationalOutputs?.length ?? 0) > 0,
  ).length,
  quantitativeProductionChains: 0,
  verdict: 'structural engine ready; quantitative automation remains evidence-gated',
});
