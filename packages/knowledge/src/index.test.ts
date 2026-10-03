import { describe, expect, it } from 'vitest';
import type { GameDataRepository, SourceEvidence } from '@pokopia/game-data';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createGameDataRepository,
  findRepositoryRoot,
  type GameDataRepository as ConcreteGameDataRepository,
} from '@pokopia/game-data';
import { createKnowledgeGraph } from './index';

const source: SourceEvidence = {
  url: 'https://example.test/portal-pod',
  title: 'Portal pod',
  snapshot: 'fixture',
  verificationStatus: 'unverified',
};

function repository(): GameDataRepository {
  return {
    health: () => ({
      databasePath: 'fixture',
      schema: 'canonical',
      snapshot: 'fixture',
      pages: 3,
      facts: 2,
      relationships: 10,
      entities: {},
      warnings: [],
    }),
    relationshipAudit: () => ({
      total: 10,
      types: { links_to: 10 },
      orphanSources: 0,
      orphanTargets: 0,
      selfLinks: 1,
      duplicateEdges: 0,
      semanticRelationships: 0,
      ambiguousDocumentLinks: 10,
    }),
    coverage: () => [],
    listPokemon: () => [
      {
        kind: 'pokemon',
        slug: 'squirtle',
        name: 'Squirtle',
        number: 7,
        specialty: 'Water',
        habitat: 'Water',
        roles: [
          {
            role: 'watering',
            evidence: 'Structured specialty: Water',
            confidence: 0.95,
            derivationMethod: 'specialty_mapping_v1',
            gameVersion: null,
            source,
          },
        ],
        source,
      },
    ],
    getPokemon: () => ({
      kind: 'pokemon',
      slug: 'squirtle',
      name: 'Squirtle',
      number: 7,
      specialty: 'Water',
      habitat: 'Water',
      roles: [],
      source,
      classification: null,
      height: null,
      weight: null,
      favorites: [],
      canDive: null,
      locations: ['Palette Town'],
      habitatTypes: [],
      rawFacts: [],
    }),
    listItems: () => [
      {
        kind: 'item',
        slug: 'portal-pod',
        name: 'Portal pod',
        description: 'Shared storage',
        locations: null,
        category: null,
        craftable: true,
        isFurniture: false,
        isContainer: true,
        dlc: false,
        automationRelevance: 'direct',
        source,
      },
    ],
    getItem: () => null,
    listRecipes: () => [
      {
        kind: 'recipe',
        slug: 'portal-pod',
        name: 'Portal pod',
        unlock: 'Shop - Palette Town Lv. 8',
        ingredients: [{ name: 'Pokémetal', slug: 'pokemetal', quantity: 10 }],
        outputQuantity: 1,
        outputQuantityStatus: 'derived_default',
        station: 'Workbench',
        source,
      },
    ],
    getRecipe: () => null,
    listTowns: () => [
      {
        kind: 'town',
        slug: 'palettetown',
        name: 'Palette Town',
        description: null,
        maxEnvironmentLevel: 10,
        source,
      },
    ],
    getTown: () => ({
      kind: 'town',
      slug: 'palettetown',
      name: 'Palette Town',
      description: null,
      maxEnvironmentLevel: 10,
      source,
      exclusivePokemon: ['Squirtle'],
      resources: ['Pokémetal'],
      plantsAndBlocks: [],
      facilities: ['Workbench'],
      treasure: [],
      unlocks: [{ name: 'Portal pod', level: 8, kind: 'recipe' }],
    }),
    listAutomationSystems: () => [],
    listQuantitativeParameters: () => [],
    listQuests: () => [],
    getQuest: () => null,
    listTreasureMaps: () => [],
    getTreasureMap: () => null,
    listCollectibles: () => [],
    getCollectible: () => null,
    listDittoMoves: () => [],
    getDittoMove: () => null,
    search: () => [],
  };
}

describe('knowledge graph', () => {
  it('keeps direction and epistemic class on semantic relationships', () => {
    const graph = createKnowledgeGraph(repository());
    const pokemon = graph.resolve('pokemon', 'squirtle');
    expect(pokemon).not.toBeNull();
    const roles = graph
      .getRelations(pokemon!)
      .filter((relationship) => relationship.predicate === 'pokemon_performs_role');
    expect(roles).toEqual([
      expect.objectContaining({
        from: expect.objectContaining({ slug: 'squirtle' }),
        to: expect.objectContaining({ slug: 'watering' }),
        relationshipClass: 'derived_fact',
        confidence: 'high',
      }),
    ]);
  });

  it('traverses recipe requirements without converting document links into facts', () => {
    const graph = createKnowledgeGraph(repository());
    const recipe = graph.resolve('recipe', 'portal-pod');
    const traversal = graph.getDependencies(recipe!);
    expect(traversal.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'material', slug: 'pokemetal' }),
        expect.objectContaining({ kind: 'requirement', slug: 'palettetown-level-8' }),
      ]),
    );
    expect(graph.quality()).toEqual(
      expect.objectContaining({
        rawDocumentRelationships: 10,
        rawAmbiguousLinks: 10,
        rawSelfLinks: 1,
      }),
    );
    expect(graph.quality().semanticRelationships).toBeGreaterThan(0);
  });

  it('returns no synergy when the source has no reviewed synergy predicate', () => {
    const graph = createKnowledgeGraph(repository());
    expect(graph.getSynergies(graph.resolve('pokemon', 'squirtle')!)).toEqual([]);
  });

  it('classifies semantic orphans instead of treating every isolation as a parser defect', () => {
    const fixture = repository();
    const graph = createKnowledgeGraph({
      ...fixture,
      listItems: () => [
        ...fixture.listItems(),
        {
          kind: 'item',
          slug: 'decorative-shell',
          name: 'Decorative shell',
          description: 'A decorative souvenir.',
          locations: 'Beach',
          category: 'Decoration',
          craftable: false,
          isFurniture: true,
          isContainer: false,
          dlc: false,
          automationRelevance: 'unknown',
          source,
        },
      ],
    });
    expect(graph.classifyOrphans()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: expect.objectContaining({ slug: 'decorative-shell' }),
          classification: 'LEGITIMATELY_ISOLATED',
        }),
      ]),
    );
  });

  it('merges independent evidence without duplicating the semantic relation', () => {
    const fixture = repository();
    const original = fixture.listPokemon();
    const secondSource: SourceEvidence = {
      ...source,
      url: 'https://example.test/pokedex/squirtle',
      title: 'Squirtle Pokédex',
    };
    const withRepeatedAssertion = {
      ...fixture,
      listPokemon: () => [
        {
          ...original[0]!,
          roles: [
            ...original[0]!.roles,
            {
              ...original[0]!.roles[0]!,
              evidence: 'Pokédex specialty: Water',
              source: secondSource,
            },
          ],
        },
      ],
    } satisfies ConcreteGameDataRepository;
    const graph = createKnowledgeGraph(withRepeatedAssertion);
    const relation = graph
      .getRelations(graph.resolve('pokemon', 'squirtle')!)
      .find((entry) => entry.predicate === 'pokemon_performs_role');
    expect(relation?.evidence).toHaveLength(2);
    expect(new Set(relation?.evidence.map((entry) => entry.source.url)).size).toBe(2);
  });

  it('traverses the real Neo Dowsing Machine dependency chain through Dowsing Machine', () => {
    const root = findRepositoryRoot();
    const canonical = join(root, 'data/canonical/v3.1/pokopia-canonical.sqlite');
    const review = join(root, 'audit-data/pokopia-review.sqlite');
    const database = existsSync(canonical) ? canonical : review;
    expect(existsSync(database), `Real canonical database missing: ${database}`).toBe(true);
    const data = createGameDataRepository(database);
    const graph = createKnowledgeGraph(data);
    const neo = graph.resolve('item', 'neo-dowsing-machine');
    expect(neo).not.toBeNull();
    const traversal = graph.getDependencies(neo!);
    expect(traversal.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'recipe', slug: 'neo-dowsing-machine' }),
        expect.objectContaining({ kind: 'item', slug: 'dowsing-machine' }),
        expect.objectContaining({ kind: 'recipe', slug: 'dowsing-machine' }),
        expect.objectContaining({ kind: 'material', slug: 'pokemetal' }),
      ]),
    );
    expect(traversal.cycles).toEqual([]);
  });

  it('keeps Treasure Map requirements, rewards and unlocks in the documented direction', () => {
    const canonical = existsSync(
      join(findRepositoryRoot(), 'data/canonical/v3.1/pokopia-canonical.sqlite'),
    )
      ? join(findRepositoryRoot(), 'data/canonical/v3.1/pokopia-canonical.sqlite')
      : join(findRepositoryRoot(), 'audit-data/pokopia-review.sqlite');
    const graph = createKnowledgeGraph(createGameDataRepository(canonical));
    const map = graph.resolve('treasure_map', 'treasure-map-1');
    expect(map).not.toBeNull();
    const relations = graph.getRelations(map!);
    expect(relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: map,
          predicate: 'treasure_map_requires_item',
          to: expect.objectContaining({ slug: 'dowsing-machine' }),
        }),
        expect.objectContaining({
          from: map,
          predicate: 'treasure_map_rewards_item',
          to: expect.objectContaining({ slug: 'decorative-great-ball' }),
        }),
        expect.objectContaining({
          from: map,
          predicate: 'treasure_map_unlocks_recipe',
          to: expect.objectContaining({ slug: 'decorative-great-ball' }),
        }),
      ]),
    );
    expect(graph.getDependencies(map!).cycles).toEqual([]);
  });
});
