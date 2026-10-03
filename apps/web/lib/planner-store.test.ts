import { describe, expect, it } from 'vitest';
import { parsePlannerStore, savePlan } from './planner-store';

describe('planner local store', () => {
  it('rejects malformed and future local state', () => {
    expect(parsePlannerStore('{')).toEqual({ version: 1, plans: [], scenarios: [] });
    expect(parsePlannerStore('{"version":2}')).toEqual({ version: 1, plans: [], scenarios: [] });
  });

  it('builds a bounded saved plan without canonical data', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { setItem() {} },
    });
    const state = savePlan(
      { version: 1, plans: [], scenarios: [] },
      {
        id: 'plan:1',
        name: 'Portal',
        goals: [{ id: 'portal', type: 'craft-item', slug: 'portal-pod', label: 'Portal Pod' }],
        preferences: [],
        constraints: {},
        stateRevision: 'state:1',
        dataVersion: '3.1',
        gameVersion: null,
      },
      '2026-08-12T00:00:00.000Z',
    );
    expect(state.plans[0]).toMatchObject({
      name: 'Portal',
      createdStateRevision: 'state:1',
      completedActionIds: [],
    });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original });
  });
});
