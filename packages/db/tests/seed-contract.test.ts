import { describe, expect, it } from 'vitest';
import { assertCanonicalSeedBundle, canonicalSeedFormat } from '../src/index.js';

const valid = {
  format: canonicalSeedFormat,
  generatedAt: '2026-08-09T00:00:00Z',
  game: { slug: 'pokemon-pokopia', name: 'Pokémon Pokopia' },
  versions: [],
  source: {
    name: 'fixture',
    kind: 'internal',
    snapshotKey: 'fixture-1',
    capturedAt: '2026-08-09T00:00:00Z',
    contentHash: 'abc',
    parserVersion: 'test',
  },
  documents: [],
  entities: [
    {
      naturalKey: 'pokemon:test',
      kind: 'pokemon',
      slug: 'test',
      displayName: 'Test',
      summary: null,
      introducedVersion: null,
      removedVersion: null,
    },
  ],
  assertions: [],
} as const;

describe('canonical seed contract', () => {
  it('accepts a minimal deterministic bundle', () => {
    expect(() => assertCanonicalSeedBundle(valid)).not.toThrow();
  });

  it('rejects assertions without a known subject', () => {
    const invalid = {
      ...valid,
      assertions: [
        {
          assertionHash: 'x',
          subjectNaturalKey: 'missing',
          predicate: 'has.name',
          value: { type: 'text', value: 'x' },
          kind: 'fact',
          verificationStatus: 'unverified',
          confidence: 0.5,
          introducedVersion: null,
          removedVersion: null,
          evidence: [],
        },
      ],
    };
    expect(() => assertCanonicalSeedBundle(invalid)).toThrow(/subject is missing/);
  });
});
