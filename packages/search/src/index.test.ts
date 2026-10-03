import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GameDataRepository, SearchRecord } from '@pokopia/game-data';
import { createGameDataRepository, findRepositoryRoot } from '@pokopia/game-data';
import {
  createSearchEngine,
  expandSearchText,
  inferKinds,
  inferSearchIntent,
  normalizeSearchText,
  searchVariants,
} from './index';

describe('search normalization', () => {
  it('routes answer-shaped queries to decision tools', () => {
    expect(inferSearchIntent('mejor Pokémon para construir')?.href).toBe(
      '/best-pokemon/construction',
    );
    expect(inferSearchIntent('cómo conseguir portal pod')?.href).toBe('/items/portal-pod');
    expect(inferSearchIntent('qué necesito para subir Palette Town')?.href).toContain(
      '/towns/palettetown',
    );
    expect(inferSearchIntent('automatizar agricultura')?.href).toBe('/automation#planner');
    expect(inferSearchIntent('mapa del tesoro 6')?.href).toBe('/treasure-maps/treasure-map-6');
    expect(inferSearchIntent('CD expansion')?.href).toBe('/collectibles?scope=expansion');
    expect(inferSearchIntent('como aprender Water Gun')?.href).toBe('/ditto-moves/water-gun');
    expect(searchVariants('como aprender Water Gun')).toContain('water gun');
  });
  it('routes Iteration 5 crafting and readiness intents deterministically', () => {
    expect(inferSearchIntent('qué necesito para fabricar Portal Pod')?.href).toBe(
      '/recipes/portal-pod',
    );
    expect(inferSearchIntent('quiero fabricar 20 Portal Pod')?.href).toBe(
      '/recipes/portal-pod?quantity=20',
    );
    expect(inferSearchIntent('qué puedo automatizar')?.href).toBe('/automation#planner');
    expect(inferSearchIntent('qué bloquea la electricidad')?.action).toBe('Ver traza operativa');
    expect(inferSearchIntent('qué puedo hacer ahora')?.href).toBe('/my-pokopia');
    expect(inferSearchIntent('qué desbloquea Automatic Doors')?.href).toBe(
      '/items/automatic-doors',
    );
  });
  it('delegates Iteration 5.5 multi-goal and decision intents to the Planner', () => {
    expect(inferSearchIntent('quiero construir Portal Pod y Automatic Doors')?.href).toBe(
      '/planner',
    );
    expect(inferSearchIntent('qué comparten estos objetivos')?.action).toBe('Elegir objetivos');
    expect(inferSearchIntent('qué hago primero')?.href).toBe('/planner');
    expect(inferSearchIntent('qué información me falta para decidir')?.action).toBe(
      'Recalcular plan',
    );
  });
  it('keeps Unicode and normalizes whitespace', () =>
    expect(normalizeSearchText('  Flabébé   Pokémon ')).toBe('Flabébé Pokémon'));
  it('bounds attacker-controlled fuzzy-search work', () => {
    const normalized = normalizeSearchText('token '.repeat(1000));
    expect([...normalized]).toHaveLength(71);
    expect(normalized.split(' ')).toHaveLength(12);
    expect(searchVariants('storage '.repeat(100)).length).toBeLessThanOrEqual(20);
  });
  it('expands known gameplay synonyms', () =>
    expect(expandSearchText('pokemon para regar')).toContain('watering'));
  it('emits independent fallback queries for lexical search', () =>
    expect(searchVariants('pokemon para regar')).toEqual(
      expect.arrayContaining(['pokemon para regar', 'watering', 'water']),
    ));
  it('treats entity words as filters and keeps relevant synonym results', () => {
    const item: SearchRecord = {
      kind: 'item',
      slug: 'basin',
      title: 'Water basin',
      excerpt: 'Item',
      url: 'https://example.test/basin',
      rank: 1,
    };
    const source = {
      url: 'https://example.test/squirtle',
      title: 'Squirtle',
      snapshot: 'test',
      verificationStatus: 'unverified' as const,
    };
    const repository: GameDataRepository = {
      health: () => {
        throw new Error('unused');
      },
      coverage: () => [],
      relationshipAudit: () => ({
        total: 0,
        types: {},
        selfLinks: 0,
        orphanSources: 0,
        orphanTargets: 0,
        ambiguousDocumentLinks: 0,
        duplicateEdges: 0,
        semanticRelationships: 0,
      }),
      listPokemon: () => [
        {
          kind: 'pokemon',
          slug: 'squirtle',
          name: 'Squirtle',
          number: 7,
          specialty: 'Watering',
          habitat: 'Water',
          roles: [],
          source,
        },
      ],
      getPokemon: () => null,
      listItems: () => [],
      getItem: () => null,
      listRecipes: () => [],
      getRecipe: () => null,
      listTowns: () => [],
      getTown: () => null,
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
      search: (query) => (query === 'water' ? [item] : []),
    };
    expect(inferKinds('pokemon para regar')).toEqual(['pokemon']);
    expect(createSearchEngine(repository).search({ text: 'pokemon para regar' })).toEqual([
      expect.objectContaining({ kind: 'pokemon', slug: 'squirtle' }),
    ]);
  });
  it('corrects the common Portal Pod typo without replacing the original query', () =>
    expect(searchVariants('portal pot')).toEqual(
      expect.arrayContaining(['portal pot', 'portal pod']),
    ));

  it('puts an exact synonym title before generic storage matches', () => {
    const source = {
      url: 'https://example.test/item',
      title: 'Item',
      snapshot: 'test',
      verificationStatus: 'unverified' as const,
    };
    const item = (slug: string, name: string, description: string) => ({
      kind: 'item' as const,
      slug,
      name,
      description,
      locations: null,
      category: null,
      craftable: null,
      isFurniture: null,
      isContainer: null,
      dlc: null,
      automationRelevance: 'unknown' as const,
      source,
    });
    const repository = {
      coverage: () => [],
      listPokemon: () => [],
      listItems: () => [
        item('antique-chest', 'Antique chest', 'A storage chest'),
        item('portal-pod', 'Portal pod', 'Shared retrieval from any pod'),
      ],
      listRecipes: () => [],
      listTowns: () => [],
      listAutomationSystems: () => [],
      listQuests: () => [],
      getQuest: () => null,
      listTreasureMaps: () => [],
      getTreasureMap: () => null,
      listCollectibles: () => [],
      getCollectible: () => null,
      listDittoMoves: () => [],
      getDittoMove: () => null,
      search: () => [],
    } as unknown as GameDataRepository;
    expect(createSearchEngine(repository).search({ text: 'baul compartido' })[0]?.title).toBe(
      'Portal pod',
    );
  });

  it('preserves the highest-quality record when structured and FTS results collide', () => {
    const source = {
      url: 'https://example.test/portal-pod',
      title: 'Portal Pod',
      snapshot: 'test',
      verificationStatus: 'unverified' as const,
    };
    const repository = {
      listPokemon: () => [],
      listItems: () => [
        {
          kind: 'item',
          slug: 'portal-pod',
          name: 'Portal Pod',
          description: 'Shared storage across every pod.',
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
      listRecipes: () => [],
      listTowns: () => [],
      listAutomationSystems: () => [],
      listQuests: () => [],
      getQuest: () => null,
      listTreasureMaps: () => [],
      getTreasureMap: () => null,
      listCollectibles: () => [],
      getCollectible: () => null,
      listDittoMoves: () => [],
      getDittoMove: () => null,
      search: () => [
        {
          kind: 'item',
          slug: 'portal-pod',
          title: 'Portal Pod',
          excerpt: 'Low-quality FTS fragment',
          url: source.url,
          rank: 13,
        },
      ],
    } as unknown as GameDataRepository;
    expect(createSearchEngine(repository).search({ text: 'portal pod' })[0]).toEqual(
      expect.objectContaining({ rank: 100, excerpt: 'Shared storage across every pod.' }),
    );
  });

  it('expands general construction, automation and large-storage language', () => {
    expect(searchVariants('storage grande')).toEqual(
      expect.arrayContaining(['storage grande', 'large', 'big']),
    );
    expect(searchVariants('mejor pokemon para construir')).toEqual(
      expect.arrayContaining(['construction', 'build']),
    );
    expect(inferSearchIntent('automatizar Palette Town')?.href).toContain('palettetown');
  });

  it('passes every mandatory regression query against the real canonical database', () => {
    const root = findRepositoryRoot();
    const canonical = join(root, 'data/canonical/v3.1/pokopia-canonical.sqlite');
    const review = join(root, 'audit-data/pokopia-review.sqlite');
    const path = existsSync(canonical) ? canonical : review;
    expect(existsSync(path), `Real canonical database missing: ${path}`).toBe(true);
    const engine = createSearchEngine(createGameDataRepository(path));
    const cases = [
      ['portal pod', 'portal-pod'],
      ['portal pot', 'portal-pod'],
      ['baul compartido', 'portal-pod'],
      ['baúl compartido', 'portal-pod'],
      ['pokemon para regar', null],
      ['pokémon para regar', null],
      ['mejor pokemon para construir', null],
      ['automatizar palette town', 'palettetown'],
      ['como conseguir portal pod', 'portal-pod'],
      ['storage grande', 'big-storage-box'],
      ['Yawn Up A Storm', 'yawn-up-a-storm'],
      ['Decorative Quick Ball', 'treasure-map-6'],
      ['Music CD 100', 'music-cd-100'],
      ['Water Gun', 'water-gun'],
    ] as const;
    for (const [query, expectedSlug] of cases) {
      const results = engine.search({ text: query, limit: 10 });
      expect(results.length, `No results for “${query}”`).toBeGreaterThan(0);
      if (expectedSlug)
        expect(
          results.some((result) => result.slug === expectedSlug),
          `Missing ${expectedSlug} for “${query}”: ${results.map((entry) => entry.slug).join(', ')}`,
        ).toBe(true);
      if (query === 'storage grande') expect(results[0]?.slug).toBe('big-storage-box');
    }
  }, 15_000);
});
