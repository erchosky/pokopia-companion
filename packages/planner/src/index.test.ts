import { describe, expect, it } from 'vitest';
import type { GoalCatalog, GoalCatalogNode } from '@pokopia/goals';
import type { CraftRecipe, PlayerWorldSnapshot } from '@pokopia/rules';
import {
  compareAlternatives,
  compareScenarios,
  createSavedPlan,
  detectStalePlan,
  planGoals,
  simulateScenario,
  snapshotFingerprint,
  type PlanAlternative,
  type PlanGoalsInput,
  type PlayerStateSnapshot,
  type PlannerGoal,
} from './index';

const source = {
  url: 'https://example.test/source',
  title: 'Fixture',
  snapshot: 'fixture',
  verificationStatus: 'confirmed' as const,
};

const node = (kind: GoalCatalogNode['kind'], slug: string, label = slug): GoalCatalogNode => ({
  id: `${kind}:${slug}`,
  kind,
  slug,
  label,
  href: `/items/${slug}`,
  requiredLevel: null,
});

const iron = node('material', 'iron-ingot', 'Iron Ingot');
const portal = node('item', 'portal-pod', 'Portal Pod');
const doors = node('item', 'automatic-doors', 'Automatic Doors');

const catalog: GoalCatalog = {
  entries: {
    'craft-item:portal-pod': {
      target: portal,
      nodes: [portal, iron],
      edges: [
        {
          from: portal.id,
          to: iron.id,
          predicate: 'recipe_requires_material',
          direction: 'forward',
          evidence: [source],
        },
      ],
      alternatives: [],
      evidence: [source],
      unknowns: [],
    },
    'craft-item:automatic-doors': {
      target: doors,
      nodes: [doors, iron],
      edges: [
        {
          from: doors.id,
          to: iron.id,
          predicate: 'recipe_requires_material',
          direction: 'forward',
          evidence: [source],
        },
      ],
      alternatives: [],
      evidence: [source],
      unknowns: [],
    },
    'build-automation:mini-generator': {
      target: node('automation', 'mini-generator', 'Mini Generator'),
      nodes: [node('automation', 'mini-generator', 'Mini Generator')],
      edges: [],
      alternatives: [],
      evidence: [source],
      unknowns: [],
    },
  },
};

const goals: readonly PlannerGoal[] = [
  { id: 'doors', type: 'craft-item', slug: 'automatic-doors', label: 'Automatic Doors' },
  { id: 'portal', type: 'craft-item', slug: 'portal-pod', label: 'Portal Pod' },
];

const recipes: readonly CraftRecipe[] = [
  {
    id: 'recipe:portal',
    slug: 'portal-pod',
    name: 'Portal Pod',
    outputQuantity: null,
    outputQuantityStatus: 'unknown',
    ingredients: [{ slug: 'iron-ingot', name: 'Iron Ingot', quantity: 3 }],
    contentScope: 'base_game',
    source,
  },
  {
    id: 'recipe:doors',
    slug: 'automatic-doors',
    name: 'Automatic Doors',
    outputQuantity: null,
    outputQuantityStatus: 'unknown',
    ingredients: [{ slug: 'iron-ingot', name: 'Iron Ingot', quantity: 5 }],
    contentScope: 'base_game',
    source,
  },
];

const state = (quantity: number | null = null): PlayerStateSnapshot => ({
  revision: 'state-v1',
  dataVersion: '3.1',
  gameVersion: null,
  entries: {},
  inventory: {
    'iron-ingot': {
      ownership: quantity === null ? 'unknown' : quantity > 0 ? 'owned' : 'not_owned',
      quantityState: quantity === null ? 'unknown' : 'confirmed',
      quantity,
    },
  },
});

const input = (snapshot = state()): PlanGoalsInput => ({
  goals,
  catalog,
  state: snapshot,
  recipes,
});

describe('multi-goal planner', () => {
  it('builds one combined graph and detects a shared dependency', () => {
    const result = planGoals(input());
    expect(result.goals).toHaveLength(2);
    expect(result.sharedDependencies).toEqual([
      expect.objectContaining({ nodeId: 'material:iron-ingot', goalIds: ['doors', 'portal'] }),
    ]);
    expect(result.graph.nodes.filter((entry) => entry.id === iron.id)).toHaveLength(1);
  });

  it('aggregates known direct materials and allocates inventory once', () => {
    const result = planGoals({
      ...input(state(6)),
      constraints: { inventoryReserves: { 'iron-ingot': 1 } },
    });
    expect(result.resources).toEqual([
      expect.objectContaining({
        slug: 'iron-ingot',
        requiredKnown: 8,
        inventoryConfirmed: 6,
        reserved: 1,
        allocated: 5,
        missing: 3,
      }),
    ]);
  });

  it('requests information instead of assuming unknown inventory is missing', () => {
    const result = planGoals(input());
    const action = result.actions.find((entry) => entry.id === 'confirm:material:iron-ingot');
    expect(action).toMatchObject({
      type: 'confirmation',
      kind: 'confirm_inventory_quantity',
      unlocksGoals: ['doors', 'portal'],
    });
    expect(result.actions.some((entry) => entry.title === 'Consigue Iron Ingot')).toBe(false);
  });

  it('turns a confirmed shortage into a gameplay blocker', () => {
    const result = planGoals(input(state(0)));
    expect(result.blockers).toContainEqual(
      expect.objectContaining({ type: 'gameplay', subjectId: iron.id }),
    );
    expect(result.actions).toContainEqual(
      expect.objectContaining({ id: 'obtain:material:iron-ingot', type: 'gameplay' }),
    );
  });

  it('keeps unknown recipe batches structural and never returns exact material planning', () => {
    const result = planGoals(input(state(8)));
    expect(result.completeness).toBe('structural');
    expect(
      result.capabilities.find((entry) => entry.id === 'exactMaterialPlanning')?.state,
    ).not.toBe('available');
    expect(
      result.capabilities.find((entry) => entry.id === 'throughputOptimization'),
    ).toMatchObject({
      state: 'unavailable',
    });
    expect(result.warnings.join(' ')).toContain('batches desconocidos');
  });

  it('does not expose global power metrics outside an automation goal context', () => {
    const metrics = [
      {
        subject: 'mini-generator',
        dimension: 'power_generation' as const,
        value: 10,
        unit: 'power',
        accepted: true,
        evidenceIds: ['fixture'],
      },
      {
        subject: 'automatic-doors',
        dimension: 'power_demand' as const,
        value: 2,
        unit: 'power',
        accepted: true,
        evidenceIds: ['fixture'],
      },
    ];
    const craftResult = planGoals({ ...input(), metrics });
    expect(craftResult.capabilities.find((entry) => entry.id === 'powerOptimization')?.state).toBe(
      'unavailable',
    );
    const automationResult = planGoals({
      ...input(),
      goals: [
        {
          id: 'generator',
          type: 'build-automation',
          slug: 'mini-generator',
          label: 'Mini Generator',
        },
      ],
      metrics,
    });
    expect(
      automationResult.capabilities.find((entry) => entry.id === 'powerOptimization')?.state,
    ).toBe('partial');
  });

  it('prioritizes an explicitly pinned action when it has no pending dependency', () => {
    const pinned = 'measure:recipe-quantity:portal-pod';
    const result = planGoals({
      ...input(),
      constraints: { pinnedActionIds: [pinned] },
    });
    expect(result.actionFrontier).toEqual([pinned]);
    expect(result.nextBestKnownAction).toBe(pinned);
    expect(result.actions.find((action) => action.id === pinned)?.whyNow).toContain(
      'fijó esta acción',
    );
  });

  it('is deterministic and does not mutate confirmed state', () => {
    const snapshot = state(8);
    const before = JSON.stringify(snapshot);
    const first = planGoals(input(snapshot));
    const second = planGoals(input(snapshot));
    expect(second).toEqual(first);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('returns equivalent next actions instead of inventing a winner', () => {
    const localCatalog: GoalCatalog = {
      entries: {
        'craft-item:a': {
          target: node('item', 'a'),
          nodes: [node('item', 'a'), node('material', 'x')],
          edges: [],
          alternatives: [],
          evidence: [source],
          unknowns: [],
        },
        'craft-item:b': {
          target: node('item', 'b'),
          nodes: [node('item', 'b'), node('material', 'y')],
          edges: [],
          alternatives: [],
          evidence: [source],
          unknowns: [],
        },
      },
    };
    const result = planGoals({
      goals: [
        { id: 'a', type: 'craft-item', slug: 'a', label: 'A' },
        { id: 'b', type: 'craft-item', slug: 'b', label: 'B' },
      ],
      catalog: localCatalog,
      state: { ...state(), inventory: {} },
      recipes: [
        {
          slug: 'a',
          name: 'A',
          outputQuantity: 1,
          outputQuantityStatus: 'source_backed',
          ingredients: [],
        },
        {
          slug: 'b',
          name: 'B',
          outputQuantity: 1,
          outputQuantityStatus: 'source_backed',
          ingredients: [],
        },
      ],
    });
    expect(result.actionFrontier).toHaveLength(2);
    expect(result.nextBestKnownAction).toBeNull();
    expect(result.nextActionReason).toContain('equivalentes');
  });

  it('lets shared information gain outrank a single-goal gameplay action', () => {
    const mixedState: PlayerStateSnapshot = {
      ...state(),
      inventory: {
        'iron-ingot': state().inventory!['iron-ingot']!,
        stone: { ownership: 'not_owned', quantityState: 'confirmed', quantity: 0 },
      },
    };
    const localCatalog: GoalCatalog = {
      entries: {
        ...catalog.entries,
        'craft-item:stone-goal': {
          target: node('item', 'stone-goal'),
          nodes: [node('item', 'stone-goal'), node('material', 'stone', 'Stone')],
          edges: [],
          alternatives: [],
          evidence: [source],
          unknowns: [],
        },
      },
    };
    const result = planGoals({
      ...input(mixedState),
      goals: [
        ...goals,
        { id: 'stone', type: 'craft-item', slug: 'stone-goal', label: 'Stone Goal' },
      ],
      catalog: localCatalog,
      recipes: [
        ...recipes,
        {
          slug: 'stone-goal',
          name: 'Stone Goal',
          outputQuantity: 1,
          outputQuantityStatus: 'source_backed',
          ingredients: [{ slug: 'stone', name: 'Stone', quantity: 1 }],
        },
      ],
    });
    expect(result.nextBestKnownAction).toBe('confirm:material:iron-ingot');
  });

  it('marks alternatives with critical unknowns incomparable', () => {
    const alternative = (
      id: string,
      value: number | null,
      unknowns: string[],
    ): PlanAlternative => ({
      id,
      label: id,
      goalIds: ['goal'],
      dimensions: [
        {
          id: 'confirmed_materials',
          direction: 'minimize',
          value,
          unit: 'items',
          known: value !== null,
        },
      ],
      unknowns,
      evidenceIds: [],
      relation: 'incomparable',
      reason: '',
    });
    expect(compareAlternatives(alternative('a', 2, []), alternative('b', null, ['unknown']))).toBe(
      'incomparable',
    );
  });

  it('uses conservative Pareto dominance only with complete known dimensions', () => {
    const alternative = (id: string, value: number): PlanAlternative => ({
      id,
      label: id,
      goalIds: ['goal'],
      dimensions: [{ id: 'blockers', direction: 'minimize', value, unit: 'blockers', known: true }],
      unknowns: [],
      evidenceIds: [],
      relation: 'pareto',
      reason: '',
    });
    expect(compareAlternatives(alternative('a', 1), alternative('b', 2))).toBe('left_dominates');
  });

  it('excludes an expansion-only recipe in Base Game mode', () => {
    const result = planGoals({
      goals: [
        {
          id: 'dlc',
          type: 'craft-item',
          slug: 'dlc-item',
          label: 'DLC Item',
          contentScope: 'expansion',
        },
      ],
      catalog: {
        entries: {
          'craft-item:dlc-item': {
            target: node('item', 'dlc-item'),
            nodes: [node('item', 'dlc-item')],
            edges: [],
            alternatives: [],
            evidence: [source],
            unknowns: [],
          },
        },
      },
      state: state(),
      recipes: [
        {
          slug: 'dlc-item',
          name: 'DLC Item',
          outputQuantity: 1,
          outputQuantityStatus: 'source_backed',
          ingredients: [],
          contentScope: 'expansion',
        },
      ],
      constraints: { contentMode: 'base_only' },
    });
    expect(result.blockers).toContainEqual(
      expect.objectContaining({
        type: 'evidence',
        reason: expect.stringContaining('Expansion Pass'),
      }),
    );
    expect(result.actions).toEqual([]);
  });

  it('guards cyclic recipe dependencies without looping', () => {
    const result = planGoals({
      goals: [{ id: 'cycle', type: 'craft-item', slug: 'a', label: 'A' }],
      catalog: {
        entries: {
          'craft-item:a': {
            target: node('item', 'a'),
            nodes: [node('item', 'a')],
            edges: [],
            alternatives: [],
            evidence: [source],
            unknowns: [],
          },
        },
      },
      state: state(),
      recipes: [
        {
          slug: 'a',
          name: 'A',
          outputQuantity: 1,
          outputQuantityStatus: 'source_backed',
          ingredients: [{ slug: 'b', name: 'B', quantity: 1 }],
        },
        {
          slug: 'b',
          name: 'B',
          outputQuantity: 1,
          outputQuantityStatus: 'source_backed',
          ingredients: [{ slug: 'a', name: 'A', quantity: 1 }],
        },
      ],
    });
    expect(result.completeness).toBe('blocked');
    expect(result.blockers.some((entry) => entry.reason.includes('ciclo'))).toBe(true);
  });

  it('detects stale saved plans across independent revision dimensions', () => {
    const result = planGoals(input());
    const saved = createSavedPlan(result, 'Portal + Doors', input(), '2026-08-12T00:00:00.000Z');
    expect(detectStalePlan(saved, state())).toEqual({ stale: false, reasons: [] });
    expect(
      detectStalePlan(saved, { ...state(), revision: 'state-v2', dataVersion: '3.2' }),
    ).toEqual({
      stale: true,
      reasons: ['player_state', 'data_version'],
    });
    expect(detectStalePlan(saved, { ...state(), gameVersion: '1.2.0' })).toEqual({
      stale: true,
      reasons: ['game_version'],
    });
  });

  it('simulates a build without mutating confirmed state', () => {
    const world: PlayerWorldSnapshot = {
      inventory: {},
      townLevels: {},
      infrastructure: {},
      builtSystems: [],
      unlocks: {},
    };
    const scenarioInput: PlanGoalsInput = {
      goals: [
        {
          id: 'generator',
          type: 'build-automation',
          slug: 'mini-generator',
          label: 'Mini Generator',
        },
      ],
      catalog,
      state: { ...state(), world },
      recipes,
    };
    const before = JSON.stringify(scenarioInput.state);
    const scenario = simulateScenario(scenarioInput, {
      kind: 'build',
      systemSlug: 'mini-generator',
    });
    expect(scenario.simulation.after.builtSystems).toEqual(['mini-generator']);
    expect(scenario.plan.goals[0]?.status).toBe('completed');
    expect(JSON.stringify(scenarioInput.state)).toBe(before);
  });

  it('compares two what-if scenarios only on known dimensions without mutating state', () => {
    const scenarioInput: PlanGoalsInput = {
      goals: [
        {
          id: 'generator',
          type: 'build-automation',
          slug: 'mini-generator',
          label: 'Mini Generator',
        },
      ],
      catalog,
      state: {
        ...state(),
        world: {
          inventory: {},
          townLevels: {},
          infrastructure: {},
          builtSystems: [],
          unlocks: {},
        },
      },
      recipes,
    };
    const before = JSON.stringify(scenarioInput.state);
    const comparison = compareScenarios(
      scenarioInput,
      { kind: 'build', systemSlug: 'mini-generator' },
      { kind: 'unlock', unlockId: 'unrelated-unlock' },
    );
    expect(comparison.relation).toBe('left_dominates');
    expect(comparison.dimensions.map((dimension) => dimension.id)).toEqual([
      'completed_goals',
      'blockers',
      'known_actions',
    ]);
    expect(JSON.stringify(scenarioInput.state)).toBe(before);
  });

  it('supports a deterministic 20-goal highly shared graph', () => {
    const entries: Record<string, GoalCatalog['entries'][string]> = {};
    const manyGoals: PlannerGoal[] = [];
    const manyRecipes: CraftRecipe[] = [];
    for (let index = 0; index < 20; index += 1) {
      const slug = `goal-${index}`;
      const target = node('item', slug, `Goal ${index}`);
      entries[`craft-item:${slug}`] = {
        target,
        nodes: [target, iron],
        edges: [],
        alternatives: [],
        evidence: [source],
        unknowns: [],
      };
      manyGoals.push({ id: slug, type: 'craft-item', slug, label: `Goal ${index}` });
      manyRecipes.push({
        slug,
        name: `Goal ${index}`,
        outputQuantity: 1,
        outputQuantityStatus: 'source_backed',
        ingredients: [{ slug: iron.slug, name: iron.label, quantity: 1 }],
      });
    }
    const first = planGoals({
      goals: manyGoals,
      catalog: { entries },
      state: state(),
      recipes: manyRecipes,
    });
    const second = planGoals({
      goals: [...manyGoals].reverse(),
      catalog: { entries },
      state: state(),
      recipes: manyRecipes,
    });
    expect(first.sharedDependencies[0]?.goalIds).toHaveLength(20);
    expect(second.inputFingerprint).toBe(first.inputFingerprint);
  });

  it('fingerprints key order deterministically', () => {
    expect(snapshotFingerprint({ b: 2, a: 1 })).toBe(snapshotFingerprint({ a: 1, b: 2 }));
  });
});
