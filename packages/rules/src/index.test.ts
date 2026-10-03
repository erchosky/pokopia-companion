import { describe, expect, it } from 'vitest';
import {
  buildCraftGraph,
  calculateCraftPlan,
  CraftingCycleError,
  evaluateAutomation,
  evaluateRequirements,
  inferLowerTownLevels,
  normalizeItemRate,
  simulateAction,
  topologicalOrder,
} from './index';

describe('rule dependency engine', () => {
  const nodes = [
    { id: 'wood', label: 'Get wood', dependencies: [] },
    { id: 'bench', label: 'Build bench', dependencies: ['wood'] },
  ];
  it('orders dependencies before goals', () =>
    expect(topologicalOrder(nodes)).toEqual(['wood', 'bench']));
  it('does not infer unknown requirements as confirmed', () =>
    expect(evaluateRequirements(nodes, { bench: 'user_confirmed' })[1]?.missing).toEqual(['wood']));
});

describe('crafting graph', () => {
  const recipes = [
    {
      slug: 'table',
      name: 'Table',
      outputQuantity: 1,
      ingredients: [
        { slug: 'lumber', name: 'Lumber', quantity: 2 },
        { slug: 'iron-ingot', name: 'Iron ingot', quantity: 1 },
      ],
    },
    {
      slug: 'iron-ingot',
      name: 'Iron ingot',
      outputQuantity: 1,
      ingredients: [{ slug: 'iron-ore', name: 'Iron ore', quantity: 3 }],
    },
  ];
  it('aggregates direct and recursive materials for multiple copies', () => {
    const plan = calculateCraftPlan(recipes, 'table', 5);
    expect(plan.directIngredients).toEqual([
      { slug: 'iron-ingot', name: 'Iron ingot', quantity: 5 },
      { slug: 'lumber', name: 'Lumber', quantity: 10 },
    ]);
    expect(plan.baseMaterials).toEqual([
      { slug: 'iron-ore', name: 'Iron ore', quantity: 15 },
      { slug: 'lumber', name: 'Lumber', quantity: 10 },
    ]);
  });

  it('rejects recipe cycles', () => {
    const cyclic = [
      {
        slug: 'a',
        name: 'A',
        outputQuantity: 1,
        ingredients: [{ slug: 'b', name: 'B', quantity: 1 }],
      },
      {
        slug: 'b',
        name: 'B',
        outputQuantity: 1,
        ingredients: [{ slug: 'a', name: 'A', quantity: 1 }],
      },
    ];
    expect(() => calculateCraftPlan(cyclic, 'a', 1)).toThrow(CraftingCycleError);
  });

  it('never turns a derived default batch into exact arithmetic', () => {
    const plan = calculateCraftPlan(
      [
        {
          slug: 'portal-pod',
          name: 'Portal Pod',
          outputQuantity: 1,
          outputQuantityStatus: 'derived_default',
          ingredients: [{ slug: 'pokemetal', name: 'Pokémetal', quantity: 2 }],
        },
      ],
      'portal-pod',
      20,
      { inventory: { pokemetal: { ownership: 'yes', quantity: 100 } } },
    );
    expect(plan.crafts).toBeNull();
    expect(plan.status).toBe('unknown');
    expect(plan.unknownQuantities).toContain('Portal Pod: cantidad de salida por fabricación');
  });

  it('distinguishes confirmed zero from unknown inventory', () => {
    const recipe = [
      {
        slug: 'door',
        name: 'Door',
        outputQuantity: 1,
        ingredients: [{ slug: 'metal', name: 'Metal', quantity: 2 }],
      },
    ];
    expect(
      calculateCraftPlan(recipe, 'door', 1, {
        inventory: { metal: { ownership: 'no', quantity: 0 } },
      }).status,
    ).toBe('blocked');
    expect(calculateCraftPlan(recipe, 'door', 1).status).toBe('unknown');
  });

  it('does not choose silently between multiple recipes', () => {
    const alternatives = [
      {
        id: 'metal-path',
        slug: 'door',
        name: 'Metal door',
        outputQuantity: 1,
        ingredients: [{ slug: 'metal', name: 'Metal', quantity: 2 }],
      },
      {
        id: 'wood-path',
        slug: 'door',
        name: 'Wood door',
        outputQuantity: 1,
        ingredients: [{ slug: 'wood', name: 'Wood', quantity: 4 }],
      },
    ];
    const plan = calculateCraftPlan(alternatives, 'door', 1);
    expect(plan.status).toBe('choice_required');
    expect(plan.alternatives.map((entry) => entry.recipeId)).toEqual(['metal-path', 'wood-path']);
  });

  it('reuses batch surplus across shared intermediate branches', () => {
    const recipes = [
      {
        slug: 'machine',
        name: 'Machine',
        outputQuantity: 1,
        ingredients: [
          { slug: 'part-a', name: 'Part A', quantity: 1 },
          { slug: 'part-b', name: 'Part B', quantity: 1 },
        ],
      },
      {
        slug: 'part-a',
        name: 'Part A',
        outputQuantity: 1,
        ingredients: [{ slug: 'bolt', name: 'Bolt', quantity: 1 }],
      },
      {
        slug: 'part-b',
        name: 'Part B',
        outputQuantity: 1,
        ingredients: [{ slug: 'bolt', name: 'Bolt', quantity: 1 }],
      },
      {
        slug: 'bolt',
        name: 'Bolt',
        outputQuantity: 2,
        ingredients: [{ slug: 'ore', name: 'Ore', quantity: 3 }],
      },
    ];
    const plan = calculateCraftPlan(recipes, 'machine', 1, {
      inventory: {
        'part-a': { ownership: 'no', quantity: 0 },
        'part-b': { ownership: 'no', quantity: 0 },
        bolt: { ownership: 'no', quantity: 0 },
        ore: { ownership: 'yes', quantity: 3 },
      },
    });
    expect(plan.baseMaterials).toEqual([]);
    expect(plan.surplus.find((entry) => entry.slug === 'bolt')?.quantity).toBe(1);
  });

  it('builds forward and inverse craft graph indexes', () => {
    const graph = buildCraftGraph(recipes);
    expect(graph.edges).toContainEqual({ from: 'table', to: 'iron-ingot', quantity: 1 });
    expect(graph.producesByIngredient['iron-ingot']).toEqual(['table']);
  });

  it('rejects unsafe quantities', () => {
    expect(() => calculateCraftPlan(recipes, 'table', Number.MAX_SAFE_INTEGER)).toThrow(
      /safe positive integer/,
    );
  });
});

describe('safe town inference', () => {
  it('infers only lower levels and records provenance', () => {
    const inferred = inferLowerTownLevels('palette-town', 3, '2026-08-09T00:00:00.000Z');
    expect(inferred.map((entry) => entry.id)).toEqual([
      'town-level:palette-town:1',
      'town-level:palette-town:2',
    ]);
    expect(inferred[0]?.inferredFrom).toBe('town:palette-town:level:3');
  });
});

describe('automation readiness V2', () => {
  const system = {
    slug: 'automatic-doors',
    name: 'Automatic Doors',
    requirements: [{ slug: 'pokemetal', name: 'Pokémetal', quantity: 2 }],
    pokemon: null,
    infrastructure: ['Electricity supply'],
    operationalInputs: ['Electricity'],
    operationalOutputs: ['Automatic opening and closing'],
    unlock: null,
    compatibleTowns: ['Palette Town'],
    limitations: ['Throughput unknown'],
  };

  it('separates enough construction materials from unknown electricity', () => {
    const result = evaluateAutomation(
      system,
      { slug: 'palette-town', name: 'Palette Town' },
      {
        inventory: { pokemetal: { ownership: 'yes', quantity: 2 } },
        residentRoles: [],
        townLevel: null,
        infrastructure: {},
        built: 'yes',
      },
    );
    expect(result.build.state).toBe('yes');
    expect(result.operational.state).toBe('unknown');
    expect(result.effects).toEqual(['Automatic opening and closing']);
    expect(result.materialOutputs).toEqual([]);
    expect(result.throughput.available).toBe(false);
  });

  it('does not convert lack of compatible-town evidence into incompatibility', () => {
    const result = evaluateAutomation(
      system,
      { slug: 'waste', name: 'Wasteland' },
      {
        inventory: { pokemetal: { ownership: 'yes', quantity: 2 } },
        residentRoles: [],
        townLevel: null,
        infrastructure: { electricity: 'yes', 'electricity-supply': 'yes' },
        built: 'yes',
      },
    );
    expect(
      result.build.requirements.find((entry) => entry.category === 'town_compatibility')?.state,
    ).toBe('unknown');
  });

  it('uses only accepted measurements for throughput', () => {
    const proposed = {
      metric: 'throughput' as const,
      state: 'exact' as const,
      value: 5,
      minimum: null,
      maximum: null,
      unit: 'items/min',
      reviewState: 'measured' as const,
      evidence: [],
    };
    const input = {
      inventory: { pokemetal: { ownership: 'yes' as const, quantity: 2 } },
      residentRoles: [],
      townLevel: null,
      infrastructure: { electricity: 'yes' as const, 'electricity-supply': 'yes' as const },
      built: 'yes' as const,
    };
    expect(
      evaluateAutomation(system, { slug: 'palette-town', name: 'Palette Town' }, input, [proposed])
        .throughput.available,
    ).toBe(false);
    expect(
      evaluateAutomation(system, { slug: 'palette-town', name: 'Palette Town' }, input, [
        { ...proposed, reviewState: 'accepted' },
      ]).throughput.available,
    ).toBe(true);
  });

  it('uses accepted source parameters without pretending they are manual measurements', () => {
    const quantitativeSystem = {
      ...system,
      quantitative: [
        {
          id: 'sprinkler-range',
          predicate: 'watering_axial_range',
          value: 5,
          unit: 'tile',
          qualifier: 'diamond',
          derivation: 'source_fact' as const,
          evidenceText: 'Reaches out 5 squares horizontally and vertically.',
          assertionStatus: 'accepted' as const,
          source: {
            url: 'https://www.serebii.net/pokemonpokopia/vegetables.shtml',
            snapshot: 'fixture',
            verificationStatus: 'unverified' as const,
          },
        },
      ],
    };
    const result = evaluateAutomation(
      quantitativeSystem,
      { slug: 'palette-town', name: 'Palette Town' },
      {
        inventory: { pokemetal: { ownership: 'yes', quantity: 2 } },
        residentRoles: [],
        townLevel: null,
        infrastructure: {},
        built: 'yes',
      },
    );
    expect(result.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'range',
          value: 5,
          unit: 'tile',
          derivation: 'source_fact',
        }),
      ]),
    );
  });
});

describe('unit-safe rate normalization', () => {
  it('keeps the observed rate and labels the normalized value as derived', () => {
    expect(normalizeItemRate(6, 30)).toEqual({
      observed: { quantity: 6, unit: 'item', duration: 30, durationUnit: 'second' },
      normalized: { value: 12, unit: 'item_per_minute', derivation: 'mathematical_derived' },
    });
  });

  it('rejects zero-duration rates', () => {
    expect(() => normalizeItemRate(3, 0)).toThrow(/positive/);
  });
});

describe('immutable simulation V1', () => {
  it('does not mutate the input snapshot when a craft is blocked', () => {
    const snapshot = {
      inventory: { ore: { ownership: 'no' as const, quantity: 0 } },
      townLevels: {},
      infrastructure: {},
      builtSystems: [],
      unlocks: {},
    };
    const before = JSON.stringify(snapshot);
    const result = simulateAction(snapshot, { kind: 'craft', recipeSlug: 'ingot', quantity: 1 }, [
      {
        slug: 'ingot',
        name: 'Ingot',
        outputQuantity: 1,
        ingredients: [{ slug: 'ore', name: 'Ore', quantity: 2 }],
      },
    ]);
    expect(result.status).toBe('no');
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(result.after).not.toBe(snapshot);
  });
});
