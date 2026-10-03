import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  extractQuantitativeAssertions,
  reconcileQuantitativeAssertions,
  type QuantitativePageInput,
} from '../src/quantitative.js';

const fixture = fileURLToPath(new URL('fixtures/quantitative-electricity.json', import.meta.url));
const buildFixture = fileURLToPath(new URL('fixtures/quantitative-build.json', import.meta.url));

describe('quantitative evidence extraction', () => {
  it('extracts source-backed power and range values from the real electricity table shape', async () => {
    const page = JSON.parse(await readFile(fixture, 'utf8')) as QuantitativePageInput;
    const assertions = extractQuantitativeAssertions(page);
    expect(assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subjectSlug: 'mini-generator',
          predicate: 'power_generation',
          value: 5,
          unit: 'power_unit',
        }),
        expect.objectContaining({
          subjectSlug: 'windmill-kit',
          predicate: 'power_generation',
          value: 20,
          qualifier: 'high_altitude',
        }),
        expect.objectContaining({
          subjectSlug: 'utility-pole',
          predicate: 'transmission_range',
          value: 15,
          qualifier: 'between_transmitters',
        }),
        expect.objectContaining({
          subjectSlug: 'electricity-network',
          predicate: 'generator_limit',
          value: 64,
        }),
        expect.objectContaining({
          subjectSlug: 'charging-station',
          predicate: 'display_capacity',
          value: 40,
        }),
      ]),
    );
    expect(assertions.every((entry) => entry.sourceVerificationStatus === 'unverified')).toBe(true);
    expect(assertions.every((entry) => entry.assertionStatus === 'accepted')).toBe(true);
  });

  it('extracts sprinkler range without treating a decorative number as a quantity', () => {
    const assertions = extractQuantitativeAssertions({
      sourceUrl: 'https://www.serebii.net/pokemonpokopia/vegetables.shtml',
      sourceHash: 'fixture-vegetables',
      text: 'A Sprinkler works in a diamond which reaches out 5 squares horizontally and vertically and in the tiles diagonally between them, covering up to 60 blocks. Poster number 300 looks nice.',
      tables: [],
    });
    expect(assertions.map(({ predicate, value, unit }) => ({ predicate, value, unit }))).toEqual([
      { predicate: 'watering_axial_range', value: 5, unit: 'tile' },
      { predicate: 'watering_capacity', value: 60, unit: 'tile' },
    ]);
  });

  it('extracts build duration, dimensions and worker count from a real build-table fixture', async () => {
    const page = JSON.parse(await readFile(buildFixture, 'utf8')) as QuantitativePageInput;
    const assertions = extractQuantitativeAssertions(page);
    expect(assertions.map(({ predicate, value, unit }) => ({ predicate, value, unit }))).toEqual([
      { predicate: 'build_duration', value: 1, unit: 'hour' },
      { predicate: 'build_width', value: 2, unit: 'block' },
      { predicate: 'build_depth', value: 2, unit: 'block' },
      { predicate: 'build_height', value: 5, unit: 'block' },
      { predicate: 'build_worker_count', value: 2, unit: 'pokemon' },
    ]);
  });

  it('preserves explicit patch version instead of inferring base-game scope', () => {
    const assertions = extractQuantitativeAssertions({
      sourceUrl: 'https://www.serebii.net/pokemonpokopia/patch.shtml',
      sourceHash: 'fixture-patch',
      text: 'Version 1.1.0 Increased the placement limit for items that use electricity from 512 to 1,024.',
      tables: [],
    });
    expect(assertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          predicate: 'electric_item_limit',
          value: 1024,
          gameVersion: '1.1.0',
          contentScope: 'unknown',
        }),
        expect.objectContaining({
          predicate: 'previous_electric_item_limit',
          value: 512,
          gameVersion: 'pre-1.1.0',
        }),
      ]),
    );
  });

  it('does not invent a recipe output from ingredient quantities or item images', () => {
    const assertions = extractQuantitativeAssertions({
      sourceUrl: 'https://www.serebii.net/pokemonpokopia/items/portalpod.shtml',
      sourceHash: 'fixture-portal-pod',
      text: 'Recipe Location Shop - Palette Town Lv. 8 Pokémetal * 10 Rare Pokémetal * 1',
      tables: [],
    });
    expect(assertions).toEqual([]);
  });

  it('marks conflicting values disputed without choosing the higher-confidence parser result', () => {
    const base = extractQuantitativeAssertions({
      sourceUrl: 'https://example.invalid/electricity-a',
      sourceHash: 'a',
      text: '',
      tables: [],
    });
    const template = {
      id: 'a',
      subjectKind: 'game_rule' as const,
      subjectSlug: 'fixture-network',
      predicate: 'fixture_limit',
      value: 10,
      unit: 'item' as const,
      qualifier: null,
      derivation: 'source_fact' as const,
      parentAssertionIds: [],
      sourceUrl: 'https://example.invalid/a',
      sourceHash: 'a',
      locator: 'fixture',
      evidenceText: '10',
      parserId: 'fixture',
      parserConfidence: 1,
      evidenceConfidence: 0.9,
      sourceVerificationStatus: 'unverified' as const,
      assertionStatus: 'accepted' as const,
      contentScope: 'unknown' as const,
      gameVersion: null,
    };
    const reconciled = reconcileQuantitativeAssertions([
      ...base,
      template,
      { ...template, id: 'b', value: 12, sourceUrl: 'https://example.invalid/b' },
    ]);
    expect(reconciled.map((entry) => entry.assertionStatus)).toEqual(['disputed', 'disputed']);
  });
});
