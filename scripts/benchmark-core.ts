import { performance } from 'node:perf_hooks';
import { join } from 'node:path';
import { createGameDataRepository } from '@pokopia/game-data';
import { createGoalCatalog, evaluateGoal } from '@pokopia/goals';
import { createKnowledgeGraph } from '@pokopia/knowledge';
import { createSearchEngine } from '@pokopia/search';
import { calculateCraftPlan, evaluateAutomation } from '@pokopia/rules';

const database =
  process.env.POKOPIA_DATABASE_PATH ?? join(process.cwd(), 'audit-data/pokopia-review.sqlite');
const repository = createGameDataRepository(database);
const graph = createKnowledgeGraph(repository);
const search = createSearchEngine(repository);
const goal = {
  id: 'benchmark',
  type: 'craft-item' as const,
  slug: 'neo-dowsing-machine',
  label: 'Neo Dowsing Machine',
};
const catalog = createGoalCatalog(repository, graph, [goal]);
const recipes = repository.listRecipes(10_000);
const portal = repository.getRecipe('portal-pod') ?? recipes[0]!;
const automaticDoors =
  repository.listAutomationSystems().find((system) => system.slug === 'automatic-doors') ??
  repository.listAutomationSystems()[0]!;

function measure(operation: () => unknown, repetitions: number) {
  for (let index = 0; index < 5; index += 1) operation();
  const samples = Array.from({ length: repetitions }, () => {
    const started = performance.now();
    operation();
    return performance.now() - started;
  }).sort((left, right) => left - right);
  return {
    repetitions,
    medianMs: Number(samples[Math.floor(samples.length / 2)]?.toFixed(3)),
    p95Ms: Number(samples[Math.floor(samples.length * 0.95)]?.toFixed(3)),
    maxMs: Number(samples.at(-1)?.toFixed(3)),
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  runtime: process.version,
  database,
  operations: {
    search: measure(() => search.search({ text: 'pokemon para regar', limit: 24 }), 100),
    graphTraversal: measure(
      () => graph.getDependencies(graph.resolve('item', 'neo-dowsing-machine')!, 16),
      5_000,
    ),
    goalEvaluation: measure(() => evaluateGoal(goal, catalog, { entries: {} }), 10_000),
    craftingEvaluation: measure(
      () => calculateCraftPlan(recipes, portal.slug, 20, { inventory: {} }),
      1_000,
    ),
    automationEvaluation: measure(
      () =>
        evaluateAutomation(
          automaticDoors,
          { slug: 'palette-town', name: 'Palette Town' },
          {
            inventory: {},
            residentRoles: [],
            townLevel: null,
            infrastructure: {},
            built: 'unknown',
          },
        ),
      5_000,
    ),
  },
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
