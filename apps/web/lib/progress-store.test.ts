import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRESS,
  parseProgress,
  recordRecentEntity,
  recordSearch,
  revertInference,
  parseProgressResult,
  setInventoryEntry,
  toggleFavorite,
} from './progress-store';

describe('Pokopia progress V5', () => {
  it('migrates V2 without losing confirmed state or goals', () => {
    const migrated = parseProgress(
      JSON.stringify({
        version: 2,
        entries: { 'pokemon:pikachu': { state: 'confirmed', value: true, updatedAt: 'old' } },
        goals: [
          {
            id: 'g1',
            type: 'acquire-pokemon',
            slug: 'pikachu',
            label: 'Pikachu',
            createdAt: 'old',
          },
        ],
      }),
    );
    expect(migrated.version).toBe(5);
    expect(migrated.entries['pokemon:pikachu']?.value).toBe(true);
    expect(migrated.goals).toHaveLength(1);
    expect(migrated.recentlyViewed).toEqual([]);
  });

  it('migrates V3 progression state without changing tri-state values', () => {
    const migrated = parseProgress(
      JSON.stringify({
        version: 3,
        entries: {
          'quest:yawn-up-a-storm': { state: 'confirmed', value: false, updatedAt: 'old' },
        },
        goals: [],
        townResidents: {},
        favorites: [],
        recentlyViewed: [],
        recentSearches: [],
      }),
    );
    expect(migrated.version).toBe(5);
    expect(migrated.entries['quest:yawn-up-a-storm']?.value).toBe(false);
  });

  it('keeps recents, searches and favorites unique and bounded', () => {
    const recent = recordRecentEntity(EMPTY_PROGRESS, { kind: 'item', slug: 'box', label: 'Box' });
    const searched = recordSearch(recent, 'storage');
    const favorite = toggleFavorite(searched, 'item:box');
    expect(favorite.recentlyViewed).toHaveLength(1);
    expect(favorite.recentSearches[0]?.query).toBe('storage');
    expect(favorite.favorites).toEqual(['item:box']);
  });

  it('reverts only inferred entries', () => {
    const state = {
      ...EMPTY_PROGRESS,
      entries: {
        'town:palette:level': {
          state: 'inferred' as const,
          value: 2,
          updatedAt: 'now',
          ruleId: 'level-from-unlock-v2',
        },
      },
    };
    expect(revertInference(state, 'town:palette:level').entries).toEqual({});
  });

  it('migrates V4 owned=true to owned with unknown quantity, never one', () => {
    const migrated = parseProgress(
      JSON.stringify({
        version: 4,
        entries: {
          'item:pokemetal': { state: 'confirmed', value: true, updatedAt: 'old' },
          'item:wood': { state: 'confirmed', value: false, updatedAt: 'old' },
        },
        goals: [],
        townResidents: {},
        favorites: [],
        recentlyViewed: [],
        recentSearches: [],
      }),
    );
    expect(migrated.inventory.pokemetal).toEqual({
      ownership: 'owned',
      quantityState: 'unknown',
      quantity: null,
      updatedAt: 'old',
    });
    expect(migrated.inventory.wood).toEqual({
      ownership: 'not_owned',
      quantityState: 'confirmed',
      quantity: 0,
      updatedAt: 'old',
    });
  });

  it('repairs partial V5 state without promoting malformed inventory', () => {
    const result = parseProgressResult(
      JSON.stringify({
        version: 5,
        entries: {
          'item:valid': { state: 'confirmed', value: true, updatedAt: '2026-08-11' },
          'item:forged': { state: 'admin', value: true, updatedAt: '2026-08-11' },
        },
        inventory: {
          valid: {
            ownership: 'owned',
            quantityState: 'confirmed',
            quantity: 4,
            updatedAt: '2026-08-11',
          },
          forged: {
            ownership: 'admin',
            quantityState: 'confirmed',
            quantity: 999,
            updatedAt: '2026-08-11',
          },
          negative: {
            ownership: 'owned',
            quantityState: 'confirmed',
            quantity: -1,
            updatedAt: '2026-08-11',
          },
        },
        goals: 'not-an-array',
      }),
    );
    expect(result.reason).toBe('repaired');
    expect(result.progress.entries).toEqual({
      'item:valid': { state: 'confirmed', value: true, updatedAt: '2026-08-11' },
    });
    expect(result.progress.goals).toEqual([]);
    expect(result.progress.inventory).toEqual({
      valid: {
        ownership: 'owned',
        quantityState: 'confirmed',
        quantity: 4,
        updatedAt: '2026-08-11',
      },
    });
  });

  it('keeps confirmed zero distinct from unknown quantity', () => {
    const zero = setInventoryEntry(EMPTY_PROGRESS, 'stone', {
      ownership: 'not_owned',
      quantityState: 'confirmed',
      quantity: 0,
    });
    const unknown = setInventoryEntry(EMPTY_PROGRESS, 'wood', {
      ownership: 'owned',
      quantityState: 'unknown',
      quantity: null,
    });
    expect(zero.inventory.stone?.quantity).toBe(0);
    expect(unknown.inventory.wood?.quantity).toBeNull();
  });

  it('does not record unknown ownership as a confirmed missing item', () => {
    const owned = setInventoryEntry(EMPTY_PROGRESS, 'wood', {
      ownership: 'owned',
      quantityState: 'unknown',
      quantity: null,
    });
    const unknown = setInventoryEntry(owned, 'wood', {
      ownership: 'unknown',
      quantityState: 'unknown',
      quantity: null,
    });
    expect(owned.entries['item:wood']).toEqual(expect.objectContaining({ value: true }));
    expect(unknown.entries).not.toHaveProperty('item:wood');
    expect(unknown.inventory.wood?.ownership).toBe('unknown');
  });

  it('returns a stable progress object for an unchanged snapshot', () => {
    const snapshot = JSON.stringify({ ...EMPTY_PROGRESS, favorites: ['item:wood'] });
    expect(parseProgress(snapshot)).toBe(parseProgress(snapshot));
    expect(parseProgress(snapshot).favorites).toEqual(['item:wood']);
  });

  it('fails safely on corrupt and future-version state', () => {
    expect(parseProgressResult('{broken').reason).toBe('corrupt');
    expect(parseProgressResult('{"version":999,"entries":{}}')).toEqual(
      expect.objectContaining({ progress: EMPTY_PROGRESS, reason: 'future-version' }),
    );
  });

  it('bounds legacy collections and strips unsupported fields during migration', () => {
    const legacy = Array.from({ length: 5_200 }, (_, index) => `item:${index}`);
    expect(parseProgress(JSON.stringify(legacy)).entries).toHaveProperty('item:4999');
    expect(Object.keys(parseProgress(JSON.stringify(legacy)).entries)).toHaveLength(5_000);

    const migrated = parseProgress(
      JSON.stringify({
        version: 2,
        entries: {
          'item:valid': {
            state: 'confirmed',
            value: true,
            updatedAt: 'old',
            clientRole: 'admin',
          },
          'item:invalid': { state: 'admin', value: true, updatedAt: 'old' },
        },
        goals: [{ id: 'bad', type: 'admin', slug: 'x', label: 'X', createdAt: 'old' }],
      }),
    );
    expect(migrated.entries).toEqual({
      'item:valid': { state: 'confirmed', value: true, updatedAt: 'old' },
    });
    expect(migrated.goals).toEqual([]);
  });
});
