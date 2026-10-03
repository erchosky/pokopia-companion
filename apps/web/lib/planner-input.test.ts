import { describe, expect, it } from 'vitest';
import { sanitizePlannerRequest } from './planner-input';

const goal = { id: 'portal', type: 'craft-item', slug: 'portal-pod', label: 'Portal Pod' };

describe('planner input', () => {
  it('accepts a bounded multi-goal payload and what-if', () => {
    expect(
      sanitizePlannerRequest({
        goals: [goal],
        entries: {},
        inventory: {},
        constraints: { contentMode: 'base_only', inventoryReserves: { pokemetal: 5 } },
        preferences: ['prioritize_certainty'],
        gameVersion: '1.2.0',
        townInfrastructure: { stoneville: { Generator: 'confirmed', Water: 'unknown' } },
        scenarioAction: { kind: 'build', systemSlug: 'mini-generator' },
        scenarioComparison: [
          { kind: 'build', systemSlug: 'mini-generator' },
          { kind: 'build', systemSlug: 'utility-pole' },
        ],
      }),
    ).toMatchObject({
      constraints: { contentMode: 'base_only', inventoryReserves: { pokemetal: 5 } },
      gameVersion: '1.2.0',
      townInfrastructure: { stoneville: { Generator: 'confirmed', Water: 'unknown' } },
      scenarioAction: { kind: 'build', systemSlug: 'mini-generator' },
      scenarioComparison: [
        { kind: 'build', systemSlug: 'mini-generator' },
        { kind: 'build', systemSlug: 'utility-pole' },
      ],
    });
  });

  it('accepts bounded pinned actions and rejects invalid infrastructure state', () => {
    expect(
      sanitizePlannerRequest({
        goals: [goal],
        entries: {},
        inventory: {},
        constraints: { pinnedActionIds: ['complete:item:portal-pod'] },
      }).constraints.pinnedActionIds,
    ).toEqual(['complete:item:portal-pod']);
    expect(() =>
      sanitizePlannerRequest({
        goals: [goal],
        entries: {},
        inventory: {},
        townInfrastructure: { stoneville: { Generator: 'probably' } },
      }),
    ).toThrow();
  });

  it('rejects more than 20 goals and unsafe reserves', () => {
    expect(() =>
      sanitizePlannerRequest({
        goals: Array.from({ length: 21 }, (_, index) => ({ ...goal, id: String(index) })),
        entries: {},
        inventory: {},
      }),
    ).toThrow();
    expect(() =>
      sanitizePlannerRequest({
        goals: [goal],
        entries: {},
        inventory: {},
        constraints: { inventoryReserves: { pokemetal: -1 } },
      }),
    ).toThrow();
  });

  it('rejects unknown preferences and unsafe scenario actions', () => {
    expect(() =>
      sanitizePlannerRequest({
        goals: [goal],
        entries: {},
        inventory: {},
        preferences: ['fastest_magic'],
      }),
    ).toThrow();
    expect(() =>
      sanitizePlannerRequest({
        goals: [goal],
        entries: {},
        inventory: {},
        scenarioAction: { kind: 'craft', recipeSlug: 'portal-pod', quantity: 1e9 },
      }),
    ).toThrow();
  });
});
