import { describe, expect, it } from 'vitest';
import { rankPokemon } from './index';
import type { PokemonSummary } from '@pokopia/game-data';

const source = {
  url: 'https://example.test',
  title: 'Fixture',
  snapshot: 'test',
  verificationStatus: 'unverified' as const,
};
describe('explainable scoring', () => {
  it('ranks direct specialty matches and exposes every contribution', () => {
    const candidates: PokemonSummary[] = [
      {
        kind: 'pokemon',
        slug: 'squirtle',
        name: 'Squirtle',
        number: 7,
        specialty: 'Watering',
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
      {
        kind: 'pokemon',
        slug: 'abra',
        name: 'Abra',
        number: 63,
        specialty: 'Teleport',
        habitat: 'Dark',
        roles: [],
        source,
      },
    ];
    const ranked = rankPokemon(candidates, 'watering');
    expect(ranked[0]?.pokemon.name).toBe('Squirtle');
    expect(ranked[0]?.explanations).toHaveLength(3);
    expect(ranked[0]?.objectiveCapabilityScore).toBe(95);
    expect(ranked[0]?.contextualScore).toBeNull();
  });

  it('keeps missing dimensions unknown instead of scoring them as zero', () => {
    const candidate: PokemonSummary = {
      kind: 'pokemon',
      slug: 'abra',
      name: 'Abra',
      number: 63,
      specialty: null,
      habitat: null,
      roles: [],
      source,
    };
    expect(rankPokemon([candidate], 'watering')).toEqual([]);
  });

  it('separates individual quality from marginal value for a current team', () => {
    const watering = {
      role: 'watering' as const,
      evidence: 'Structured specialty: Water',
      confidence: 0.95,
      derivationMethod: 'specialty_mapping_v1' as const,
      gameVersion: null,
      source,
    };
    const existing: PokemonSummary = {
      kind: 'pokemon',
      slug: 'squirtle',
      name: 'Squirtle',
      number: 7,
      specialty: 'Water',
      habitat: 'Water',
      roles: [watering],
      source,
    };
    const candidate: PokemonSummary = {
      ...existing,
      slug: 'wartortle',
      name: 'Wartortle',
    };
    const result = rankPokemon([candidate], 'watering', undefined, [existing])[0];
    expect(result?.mode).toBe('team_addition');
    expect(result?.marginalRoleGain).toBe(0);
    expect(result?.confidence).toBe('medium');
  });

  it('orders individual candidates by capability, not by team marginality', () => {
    const assignment = (role: 'automation' | 'production', confidence: number) => ({
      role,
      evidence: `Structured specialty: ${role}`,
      confidence,
      derivationMethod: 'specialty_mapping_v1' as const,
      gameVersion: null,
      source,
    });
    const candidates: PokemonSummary[] = [
      {
        kind: 'pokemon',
        slug: 'specialist',
        name: 'Specialist',
        number: null,
        specialty: 'Automation',
        habitat: null,
        roles: [assignment('automation', 0.98)],
        source,
      },
      {
        kind: 'pokemon',
        slug: 'generalist',
        name: 'Generalist',
        number: null,
        specialty: 'Automation production',
        habitat: null,
        roles: [assignment('automation', 0.75), assignment('production', 0.75)],
        source,
      },
    ];
    const ranked = rankPokemon(candidates, 'automation');
    expect(ranked[0]?.pokemon.slug).toBe('specialist');
    expect(ranked[0]).toEqual(
      expect.objectContaining({
        mode: 'individual',
        dataCoverage: expect.any(Number),
        evidenceQualityScore: expect.any(Number),
      }),
    );
  });

  it('uses marginal role gain only in team-addition mode and marks exact ties', () => {
    const role = (value: 'automation' | 'production', confidence = 0.9) => ({
      role: value,
      evidence: `Structured specialty: ${value}`,
      confidence,
      derivationMethod: 'specialty_mapping_v1' as const,
      gameVersion: null,
      source,
    });
    const pokemon = (slug: string, roles: ReturnType<typeof role>[]): PokemonSummary => ({
      kind: 'pokemon',
      slug,
      name: slug,
      number: null,
      specialty: roles.map((entry) => entry.role).join(' '),
      habitat: null,
      roles,
      source,
    });
    const existing = pokemon('existing', [role('automation')]);
    const duplicate = pokemon('duplicate', [role('automation', 0.98)]);
    const complement = pokemon('complement', [role('production', 0.8)]);
    const ranked = rankPokemon([duplicate, complement], 'automation', undefined, [existing]);
    expect(ranked[0]?.pokemon.slug).toBe('complement');
    expect(ranked[0]).toHaveProperty('tie');
  });
});
