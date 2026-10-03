import { describe, expect, it } from 'vitest';
import { evaluateGoal, type GoalCatalog } from './index';

const source = {
  url: 'https://example.test/neo',
  title: 'Neo Dowsing Machine',
  snapshot: 'fixture',
  verificationStatus: 'unverified' as const,
};

const catalog: GoalCatalog = {
  entries: {
    'craft-item:neo-dowsing-machine': {
      target: {
        id: 'item:neo-dowsing-machine',
        kind: 'item',
        slug: 'neo-dowsing-machine',
        label: 'Neo Dowsing Machine',
        href: '/items/neo-dowsing-machine',
        requiredLevel: null,
      },
      nodes: [
        {
          id: 'item:neo-dowsing-machine',
          kind: 'item',
          slug: 'neo-dowsing-machine',
          label: 'Neo Dowsing Machine',
          href: '/items/neo-dowsing-machine',
          requiredLevel: null,
        },
        {
          id: 'item:dowsing-machine',
          kind: 'item',
          slug: 'dowsing-machine',
          label: 'Dowsing Machine',
          href: '/items/dowsing-machine',
          requiredLevel: null,
        },
        {
          id: 'material:pokemetal',
          kind: 'material',
          slug: 'pokemetal',
          label: 'Pokémetal',
          href: '/items/pokemetal',
          requiredLevel: null,
        },
      ],
      edges: [
        {
          from: 'recipe:neo-dowsing-machine',
          to: 'item:dowsing-machine',
          predicate: 'recipe_requires_item',
          direction: 'forward',
          evidence: [source],
        },
      ],
      alternatives: [],
      evidence: [source],
      unknowns: ['Gameplay unverified'],
    },
  },
};

describe('goal engine v2', () => {
  it('keeps absent ownership unknown and explicit false missing', () => {
    const goal = {
      id: 'neo',
      type: 'craft-item' as const,
      slug: 'neo-dowsing-machine',
      label: 'Craft Neo Dowsing Machine',
    };
    const unknown = evaluateGoal(goal, catalog, { entries: {} });
    expect(unknown.status).toBe('unknown');
    expect(unknown.missing).toEqual([]);
    expect(unknown.unknown.map((node) => node.slug)).toEqual(['dowsing-machine', 'pokemetal']);
    const blocked = evaluateGoal(goal, catalog, {
      entries: { 'item:pokemetal': { state: 'confirmed', value: false } },
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.blockers[0]).toContain('Pokémetal');
  });

  it('evaluates a Treasure Map goal from forward requirements', () => {
    const mapCatalog: GoalCatalog = {
      entries: {
        'complete-treasure-map:treasure-map-1': {
          target: {
            id: 'treasure_map:treasure-map-1',
            kind: 'treasure_map',
            slug: 'treasure-map-1',
            label: 'Map 1',
            href: '/treasure-maps/treasure-map-1',
            requiredLevel: null,
          },
          nodes: [
            {
              id: 'treasure_map:treasure-map-1',
              kind: 'treasure_map',
              slug: 'treasure-map-1',
              label: 'Map 1',
              href: '/treasure-maps/treasure-map-1',
              requiredLevel: null,
            },
            {
              id: 'item:dowsing-machine',
              kind: 'item',
              slug: 'dowsing-machine',
              label: 'Dowsing Machine',
              href: '/items/dowsing-machine',
              requiredLevel: null,
            },
          ],
          edges: [
            {
              from: 'treasure_map:treasure-map-1',
              to: 'item:dowsing-machine',
              predicate: 'treasure_map_requires_item',
              direction: 'forward',
              evidence: [source],
            },
          ],
          alternatives: [],
          evidence: [source],
          unknowns: [],
        },
      },
    };
    const goal = {
      id: 'map-1',
      type: 'complete-treasure-map' as const,
      slug: 'treasure-map-1',
      label: 'Map 1',
    };
    expect(evaluateGoal(goal, mapCatalog, { entries: {} }).nextStep?.title).toContain('Confirma');
    expect(
      evaluateGoal(goal, mapCatalog, {
        entries: {
          'treasure_map:treasure-map-1': { state: 'confirmed', value: true },
        },
      }).status,
    ).toBe('completed');
  });

  it('updates Portal-style acquisition goals when the target is confirmed', () => {
    const portalCatalog: GoalCatalog = {
      entries: {
        'get-item:portal-pod': {
          ...catalog.entries['craft-item:neo-dowsing-machine']!,
          target: {
            id: 'item:portal-pod',
            kind: 'item',
            slug: 'portal-pod',
            label: 'Portal Pod',
            href: '/items/portal-pod',
            requiredLevel: null,
          },
          nodes: [],
        },
      },
    };
    const goal = {
      id: 'portal',
      type: 'get-item' as const,
      slug: 'portal-pod',
      label: 'Portal Pod',
    };
    expect(evaluateGoal(goal, portalCatalog, { entries: {} }).status).toBe('unknown');
    expect(
      evaluateGoal(goal, portalCatalog, {
        entries: { 'item:portal-pod': { state: 'confirmed', value: true } },
      }).status,
    ).toBe('completed');
  });

  it('does not invent a next step for unknown targets or dependency cycles', () => {
    const unknown = evaluateGoal(
      { id: 'lost', type: 'get-item', slug: 'not-canonical', label: 'Unknown item' },
      catalog,
      { entries: {} },
    );
    expect(unknown.nextStep).toBeNull();
    expect(unknown.unknowns).toContain(
      'No hay suficiente evidencia para recomendar un siguiente paso fiable.',
    );
    const cyclic: GoalCatalog = {
      entries: {
        ...catalog.entries,
        'craft-item:neo-dowsing-machine': {
          ...catalog.entries['craft-item:neo-dowsing-machine']!,
          unknowns: ['Dependency cycles: item:a → item:b → item:a'],
        },
      },
    };
    expect(
      evaluateGoal(
        {
          id: 'neo',
          type: 'craft-item',
          slug: 'neo-dowsing-machine',
          label: 'Neo Dowsing Machine',
        },
        cyclic,
        { entries: {} },
      ).nextStep,
    ).toBeNull();
  });
});
