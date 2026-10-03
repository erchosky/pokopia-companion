import { describe, expect, it } from 'vitest';
import { sanitizeGoalRequest } from './goal-input';

describe('goal API input', () => {
  it('constructs only allowlisted fields and accepts a bounded valid request', () => {
    expect(
      sanitizeGoalRequest({
        goals: [
          {
            id: 'one',
            type: 'get-item',
            slug: 'portal-pod',
            label: 'Portal Pod',
            attackerControlledRole: 'admin',
          },
        ],
        entries: { 'item:portal-pod': { state: 'confirmed', value: true, role: 'admin' } },
      }),
    ).toEqual({
      goals: [{ id: 'one', type: 'get-item', slug: 'portal-pod', label: 'Portal Pod' }],
      entries: { 'item:portal-pod': { state: 'confirmed', value: true } },
      inventory: {},
    });
  });

  it.each([
    null,
    { goals: [{ id: 'x', type: 'admin', slug: 'x', label: 'x' }] },
    { goals: [], entries: { x: { state: 'confirmed', value: { nested: true } } } },
    {
      goals: [],
      entries: Object.fromEntries(Array.from({ length: 2_001 }, (_, index) => [index, {}])),
    },
  ])('rejects malformed or abusive payload %#', (input) => {
    expect(() => sanitizeGoalRequest(input)).toThrow();
  });
});
