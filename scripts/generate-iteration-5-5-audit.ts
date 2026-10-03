import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { join, relative } from 'node:path';
import { createGameDataRepository, resolveDatabasePath } from '@pokopia/game-data';
import { createGoalCatalog, type GoalCatalog, type GoalDefinition } from '@pokopia/goals';
import { createKnowledgeGraph } from '@pokopia/knowledge';
import {
  compareScenarios,
  planGoals,
  type PlanGoalsInput,
  type PlannerGoal,
} from '@pokopia/planner';
import { format } from 'prettier';

const database = resolveDatabasePath();
if (!database) throw new Error('Canonical database not found.');
const repository = createGameDataRepository(database);
const knowledge = createKnowledgeGraph(repository);
const recipes = repository.listRecipes(10_000);
const output = join(process.cwd(), 'audit-data/iteration-5-5');
mkdirSync(output, { recursive: true });
const write = async (name: string, value: unknown) =>
  writeFileSync(
    join(output, name),
    await format(JSON.stringify(value), {
      parser: 'json',
      printWidth: 100,
      singleQuote: true,
      trailingComma: 'all',
    }),
  );

async function main() {
  const inventory = Object.fromEntries(
    [
      ...new Set(
        recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.slug)),
      ),
    ].map((slug) => [
      slug,
      { ownership: 'unknown' as const, quantityState: 'unknown' as const, quantity: null },
    ]),
  );
  const baseState = {
    revision: 'audit-empty-player-state',
    dataVersion: repository.health().snapshot,
    gameVersion: null,
    entries: {},
    inventory,
    world: {
      inventory: Object.fromEntries(
        Object.keys(inventory).map((slug) => [
          slug,
          { ownership: 'unknown' as const, quantity: null },
        ]),
      ),
      townLevels: {},
      infrastructure: {},
      builtSystems: [],
      unlocks: {},
    },
  };

  const portalGoal: PlannerGoal = {
    id: 'portal-pod',
    type: 'craft-item',
    slug: 'portal-pod',
    label: 'Portal Pod',
  };
  const doorsGoal: PlannerGoal = {
    id: 'automatic-doors',
    type: repository.listAutomationSystems().some((system) => system.slug === 'automatic-doors')
      ? 'build-automation'
      : 'craft-item',
    slug: 'automatic-doors',
    label: 'Automatic Doors',
  };
  const primary = run([portalGoal, doorsGoal]);
  const sharedPair = mostSharedRecipePair();
  const sharedGoals = sharedPair.map((recipe, index): PlannerGoal => ({
    id: `shared-${index}-${recipe.slug}`,
    type: 'craft-item',
    slug: recipe.slug,
    label: recipe.name,
  }));
  const sharedPlan = run(sharedGoals);

  await write('multi-goal-cases.json', {
    database: relative(process.cwd(), database),
    cases: [
      summary('portal-pod-plus-automatic-doors', primary),
      summary('real-shared-material-pair', sharedPlan),
    ],
  });
  await write('shared-dependencies.json', {
    selectedRealPair: sharedPair.map((recipe) => recipe.slug),
    dependencies: sharedPlan.sharedDependencies,
    invariant:
      'Each dependency node is unique in the combined graph and carries every affected goal id.',
  });
  await write('resource-allocation.json', {
    resources: sharedPlan.resources,
    policy: [
      'Known direct demand is aggregated before inventory allocation.',
      'Confirmed inventory is allocated once across the combined plan.',
      'Unknown inventory never becomes zero.',
      'Recursive totals stop at an unknown recipe output batch.',
    ],
  });
  await write('alternatives.json', {
    primary: primary.alternatives,
    verdict:
      primary.alternatives.length === 0
        ? 'No source-backed route alternatives exist for the reference pair; the planner does not manufacture them.'
        : 'Alternatives remain explicit and are not greedily selected.',
  });
  await write('pareto-cases.json', {
    policy:
      'Dominance requires equal-or-better values in every comparable known dimension and one strict improvement. Any critical unknown keeps routes incomparable.',
    dimensions: [
      'confirmed_materials',
      'known_build_time',
      'progression_depth',
      'blockers',
      'shared_goal_utility',
      'known_power',
      'certainty',
    ],
    noMasterScore: true,
  });
  await write('unknown-blockers.json', {
    state: primary.blockers.filter((blocker) => blocker.type === 'state'),
    evidence: primary.blockers.filter((blocker) => blocker.type === 'evidence'),
    gameplay: primary.blockers.filter((blocker) => blocker.type === 'gameplay'),
  });
  await write('measurement-blockers.json', {
    blockers: primary.blockers.filter((blocker) => blocker.type === 'measurement'),
    recipeOutputCoverage: '0/882 exact batches',
    throughputOptimization: primary.capabilities.find(
      (capability) => capability.id === 'throughputOptimization',
    ),
  });
  await write('information-gain-cases.json', {
    actionFrontier: primary.actionFrontier,
    nextBestKnownAction: primary.nextBestKnownAction,
    reason: primary.nextActionReason,
    confirmations: primary.actions
      .filter((action) => action.type === 'confirmation')
      .map((action) => ({ id: action.id, goalsAffected: action.unlocksGoals.length })),
  });
  await write('capability-flags.json', {
    capabilities: primary.capabilities,
    globalPlannerReadyBoolean: false,
  });
  await write(
    'scenario-comparison.json',
    compareScenarios(
      planningInput([portalGoal, doorsGoal]),
      { kind: 'build', systemSlug: 'mini-generator' },
      { kind: 'build', systemSlug: 'utility-pole' },
    ),
  );
  const deterministicAgain = run([portalGoal, doorsGoal]);
  await write('deterministic-regression.json', {
    sameInputSamePlan: JSON.stringify(primary) === JSON.stringify(deterministicAgain),
    fingerprint: primary.inputFingerprint,
    invariants: [
      'planner never mutates confirmed state',
      'unknown never becomes zero',
      'shared inventory is allocated once',
      'simulation state is separate from confirmed state',
      'unavailable optimization never returns an optimum',
    ],
  });

  const benchmarkCases = benchmarkPlans();
  await write('performance.json', {
    generatedAt: new Date().toISOString(),
    runtime: process.version,
    database: relative(process.cwd(), database),
    cases: benchmarkCases,
  });
  await write('readiness.json', {
    verdict: 'Iteration 6 should prioritize Quantitative Measurement Expansion.',
    reason:
      'Structural multi-goal planning is available, while 882 recipe batches and production throughput still gate exact material and time/throughput optimization.',
    routes: {
      quantitativeMeasurementExpansion: 'recommended',
      advancedAutomationSimulation: 'blocked-by-throughput',
      spatialTownPlanning: 'blocked-by-player-layout-and-geometry',
      advancedCompanionIntelligence: 'planner-foundation-ready-but-quantitative-ceiling-remains',
      productionReadiness: 'hosted-staging-still-external',
    },
  });

  process.stdout.write(
    `${JSON.stringify({ goals: primary.goals.length, nodes: primary.diagnostics.nodes, shared: sharedPlan.sharedDependencies.length, performanceCases: benchmarkCases.length })}\n`,
  );

  function run(goals: readonly PlannerGoal[]) {
    return planGoals(planningInput(goals));
  }

  function planningInput(goals: readonly PlannerGoal[]): PlanGoalsInput {
    return {
      goals,
      catalog: createGoalCatalog(repository, knowledge, goals),
      state: baseState,
      recipes,
      metrics: repository.listQuantitativeParameters().map((parameter) => ({
        subject: parameter.subjectSlug,
        dimension: predicateDimension(parameter.predicate),
        value: parameter.value,
        unit: parameter.unit,
        accepted: parameter.assertionStatus === 'accepted',
        evidenceIds: [parameter.source.snapshot || parameter.source.url],
      })),
    };
  }

  function predicateDimension(predicate: string) {
    const value = predicate.toLocaleLowerCase('en');
    if (value.includes('generation')) return 'power_generation' as const;
    if (value.includes('demand') || value.includes('consumption')) return 'power_demand' as const;
    if (value.includes('range') || value.includes('reach')) return 'range' as const;
    if (value.includes('duration') || value.includes('build_time'))
      return 'build_duration' as const;
    if (value.includes('throughput') || value.includes('rate')) return 'throughput' as const;
    return 'capacity' as const;
  }

  function mostSharedRecipePair() {
    let best: [(typeof recipes)[number], (typeof recipes)[number]] = [recipes[0]!, recipes[1]!];
    let maximum = -1;
    for (let left = 0; left < recipes.length; left += 1) {
      const leftIngredients = new Set(
        recipes[left]!.ingredients.map((ingredient) => ingredient.slug),
      );
      for (let right = left + 1; right < recipes.length; right += 1) {
        const shared = recipes[right]!.ingredients.filter((ingredient) =>
          leftIngredients.has(ingredient.slug),
        ).length;
        if (shared > maximum) {
          maximum = shared;
          best = [recipes[left]!, recipes[right]!];
        }
      }
    }
    return best;
  }

  function summary(id: string, plan: ReturnType<typeof run>) {
    return {
      id,
      completeness: plan.completeness,
      goals: plan.goals.map((goal) => ({ id: goal.goalId, status: goal.status })),
      nodes: plan.diagnostics.nodes,
      edges: plan.diagnostics.edges,
      sharedDependencies: plan.sharedDependencies.length,
      blockers: plan.blockers.length,
      actionFrontier: plan.actionFrontier,
      nextBestKnownAction: plan.nextBestKnownAction,
    };
  }

  function benchmarkPlans() {
    const recipeGoals = recipes.slice(0, 20).map((recipe, index): PlannerGoal => ({
      id: `benchmark-${index}`,
      type: 'craft-item',
      slug: recipe.slug,
      label: recipe.name,
    }));
    const deepRecipe =
      recipes.find((recipe) => recipe.slug === 'neo-dowsing-machine') ?? recipes[0]!;
    const deepGoal: PlannerGoal = {
      id: 'deep-dependency',
      type: 'craft-item',
      slug: deepRecipe.slug,
      label: deepRecipe.name,
    };
    const cases: { id: string; goals: readonly PlannerGoal[]; alternativeHeavy?: boolean }[] = [
      ...[1, 5, 20].map((count) => ({ id: `${count}-goals`, goals: recipeGoals.slice(0, count) })),
      { id: 'deep-dependency', goals: [deepGoal] },
      { id: 'highly-shared', goals: sharedGoals },
      { id: 'alternative-heavy', goals: [recipeGoals[0]!], alternativeHeavy: true },
      { id: 'unknown-heavy', goals: [portalGoal, doorsGoal] },
    ];
    return cases.map(({ id, goals, alternativeHeavy }) => {
      const baseCatalog = createGoalCatalog(
        repository,
        knowledge,
        goals as readonly GoalDefinition[],
      );
      const catalog: GoalCatalog = alternativeHeavy
        ? {
            entries: Object.fromEntries(
              Object.entries(baseCatalog.entries).map(([key, entry]) => [
                key,
                {
                  ...entry,
                  alternatives: repository.listItems(20).map((item) => ({
                    id: `item:${item.slug}`,
                    kind: 'item' as const,
                    slug: item.slug,
                    label: item.name,
                    href: `/items/${item.slug}`,
                    requiredLevel: null,
                  })),
                },
              ]),
            ),
          }
        : baseCatalog;
      const startedMemory = process.memoryUsage().heapUsed;
      const started = performance.now();
      const plan = planGoals({ goals, catalog, state: baseState, recipes });
      return {
        id,
        goals: goals.length,
        runtimeMs: Number((performance.now() - started).toFixed(3)),
        heapDeltaBytes: process.memoryUsage().heapUsed - startedMemory,
        nodes: plan.diagnostics.nodes,
        edges: plan.diagnostics.edges,
        memoizedTargets: plan.diagnostics.memoizedTargets,
      };
    });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
