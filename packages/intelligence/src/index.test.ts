import { describe, expect, it } from 'vitest';
import type {
  AutomationSystem,
  GameDataRepository,
  PokemonSummary,
  RoleSlug,
  SourceEvidence,
  TownDetail,
} from '@pokopia/game-data';
import { analyzeTown, compareItems, nextActions, planAutomation } from './index';

const source: SourceEvidence = {
  url: 'https://example.test/source',
  title: 'Fixture',
  snapshot: 'fixture',
  verificationStatus: 'unverified',
};

function pokemon(slug: string, roles: readonly RoleSlug[]): PokemonSummary {
  return {
    kind: 'pokemon',
    slug,
    name: slug.replace(/^./, (letter) => letter.toUpperCase()),
    number: null,
    specialty: roles.join(' '),
    habitat: null,
    roles: roles.map((role) => ({
      role,
      evidence: `Structured specialty: ${role}`,
      confidence: 0.9,
      derivationMethod: 'specialty_mapping_v1',
      gameVersion: null,
      source,
    })),
    source,
  };
}

const town: TownDetail = {
  kind: 'town',
  slug: 'palette-town',
  name: 'Palette Town',
  description: null,
  maxEnvironmentLevel: 10,
  exclusivePokemon: [],
  resources: ['Stone'],
  plantsAndBlocks: ['Tall grass'],
  facilities: ['Storage box'],
  treasure: [],
  unlocks: [],
  source,
};

describe('town intelligence', () => {
  it('detects duplicate roles and uses marginal coverage for replacements', () => {
    const entries = [
      pokemon('alpha', ['watering']),
      pokemon('beta', ['watering']),
      pokemon('gamma', ['construction', 'resource-generation']),
    ];
    const analysis = analyzeTown({
      town,
      pokemon: entries,
      residentSlugs: ['alpha', 'beta'],
      candidateSlugs: ['gamma'],
      preset: 'Balanced',
      compatibleAutomation: [],
      userLevel: null,
    });
    expect(analysis.duplicateRoles).toEqual([{ role: 'watering', count: 2 }]);
    expect(analysis.residents.every((resident) => resident.category === 'redundant')).toBe(true);
    expect(analysis.replacements[0]).toEqual(
      expect.objectContaining({
        replace: expect.objectContaining({ slug: 'alpha' }),
        with: expect.objectContaining({ slug: 'gamma' }),
        benefit: '+2 roles sin cubrir.',
      }),
    );
  });

  it('keeps progression and automation unknown without user or compatibility evidence', () => {
    const analysis = analyzeTown({
      town,
      pokemon: [],
      residentSlugs: [],
      preset: 'Compact',
      compatibleAutomation: [],
      userLevel: null,
    });
    expect(analysis.health.find((entry) => entry.dimension === 'Progression')?.state).toBe(
      'unknown',
    );
    expect(analysis.health.find((entry) => entry.dimension === 'Automation Coverage')?.state).toBe(
      'unknown',
    );
  });

  it('keeps ideal, owned-only and unknown collection candidates distinct', () => {
    const entries = [
      pokemon('owned-builder', ['construction']),
      pokemon('unknown-waterer', ['watering']),
      pokemon('not-owned-logistics', ['storage', 'transport']),
    ];
    const analysis = analyzeTown({
      town,
      pokemon: entries,
      residentSlugs: [],
      preset: 'Balanced',
      compatibleAutomation: [],
      ownership: {
        'owned-builder': 'owned',
        'unknown-waterer': 'unknown',
        'not-owned-logistics': 'not_owned',
      },
      candidateMode: 'known_collection',
    } as never);
    expect(analysis).toEqual(
      expect.objectContaining({
        candidateMode: 'known_collection',
        ownershipCompleteness: 'partial',
        ownedRecommendations: expect.arrayContaining([
          expect.objectContaining({ with: expect.objectContaining({ slug: 'owned-builder' }) }),
        ]),
        idealRecommendations: expect.arrayContaining([
          expect.objectContaining({
            with: expect.objectContaining({ slug: 'not-owned-logistics' }),
          }),
        ]),
        constraints: expect.arrayContaining([expect.objectContaining({ status: 'unknown' })]),
      }),
    );
  });
});

describe('automation planning', () => {
  it('keeps absent inventory unknown and reports only explicit shortages as missing', () => {
    const system: AutomationSystem = {
      kind: 'automation',
      slug: 'portal-pod',
      name: 'Portal pod',
      what: 'Shared storage',
      why: 'Logistics',
      requirements: [
        { slug: 'pokemetal', name: 'Pokémetal', quantity: 10 },
        { slug: 'rare', name: 'Rare Pokémetal', quantity: 1 },
      ],
      pokemon: null,
      infrastructure: null,
      operationalInputs: ['Items'],
      operationalOutputs: ['Shared access'],
      unlock: 'Shop - Palette Town Lv. 8',
      compatibleTowns: ['Palette Town'],
      limitations: ['Capacity unknown'],
      knownState: 'source_backed',
      contentScope: 'unknown',
      gameVersion: null,
      quantitative: [],
      source,
    };
    const plan = planAutomation(system, town, {
      ownedItemSlugs: ['pokemetal'],
      residentRoles: [],
      townLevel: 7,
      inventory: {
        pokemetal: { ownership: 'yes', quantity: null },
        rare: { ownership: 'no', quantity: 0 },
      },
    });
    expect(plan.canBuild).toBe('no');
    expect(plan.missing).toEqual(['Rare Pokémetal', 'Palette Town · Environment Level 8']);
    expect(plan.unknowns).toContain('La cantidad disponible no está confirmada.');
    expect(plan.operationalReadiness.state).toBe('unknown');
  });
});

describe('comparison engine', () => {
  it('does not turn unknown capacity into a winner', () => {
    const item = (slug: string, type: 'shared' | 'local') => ({
      kind: 'item' as const,
      slug,
      name: slug,
      description: null,
      locations: null,
      category: null,
      craftable: true,
      isFurniture: false,
      isContainer: true,
      dlc: false,
      automationRelevance: 'related' as const,
      source,
      requirements: null,
      tradeValue: null,
      printCost: null,
      favoriteCategories: [],
      paintable: null,
      locationEntries: [],
      recipe: null,
      storage: { type, capacity: null, evidence: 'fixture' },
      useCases: [],
    });
    const repository = {
      getItem: (slug: string) =>
        slug === 'portal-pod' ? item(slug, 'shared') : item(slug, 'local'),
    } as unknown as GameDataRepository;
    const comparison = compareItems(repository, 'big-storage-box', 'portal-pod', 'automation');
    expect(comparison?.recommendation).toBe('portal-pod');
    expect(comparison?.unknowns).toEqual(
      expect.arrayContaining(['Capacidad de big-storage-box', 'Capacidad de portal-pod']),
    );
  });
});

describe('Next Actions V2', () => {
  it('routes and completes Iteration 4 goals using their own state kinds', () => {
    const input = {
      goals: [
        {
          id: 'map',
          type: 'complete-treasure-map',
          slug: 'treasure-map-1',
          label: 'Treasure Map 1',
        },
      ],
      confirmedIds: [] as string[],
      towns: [],
      automation: [],
    };
    expect(nextActions(input)[0]?.href).toBe('/treasure-maps/treasure-map-1');
    expect(nextActions({ ...input, confirmedIds: ['treasure_map:treasure-map-1'] })[0]?.id).toBe(
      'complete:map',
    );
  });

  it('does not manufacture a confident action when all player state is unknown', () => {
    expect(nextActions({ goals: [], confirmedIds: [], towns: [], automation: [] })[0]).toEqual(
      expect.objectContaining({
        id: 'insufficient-evidence',
        confidence: 'unknown',
      }),
    );
  });
});
