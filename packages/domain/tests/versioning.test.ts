import { describe, expect, it } from 'vitest';
import {
  assertValidRange,
  declareVersionScope,
  isEffectiveAt,
  type OrderedVersion,
} from '../src/index.js';

const versions = new Map<string, OrderedVersion>([
  ['v20', { id: 'v20', ordinal: 20 }],
  ['v21', { id: 'v21', ordinal: 21 }],
  ['v22', { id: 'v22', ordinal: 22 }],
]);

describe('version ranges', () => {
  it('uses an inclusive start and exclusive end', () => {
    const range = { introducedVersionId: 'v20', removedVersionId: 'v22' };
    expect(isEffectiveAt(range, versions.get('v20')!, versions)).toBe(true);
    expect(isEffectiveAt(range, versions.get('v21')!, versions)).toBe(true);
    expect(isEffectiveAt(range, versions.get('v22')!, versions)).toBe(false);
  });

  it('rejects inverted ranges', () => {
    expect(() =>
      assertValidRange({ introducedVersionId: 'v22', removedVersionId: 'v20' }, versions),
    ).toThrow(/later/);
  });
});

describe('version knowledge', () => {
  it('does not silently equate unknown game version with an unversioned system rule', () => {
    expect(() =>
      declareVersionScope({
        introducedVersionId: null,
        removedVersionId: null,
        rationale: 'Source omitted game version',
      }),
    ).toThrow(/explicit unknown or unversioned_system/);
    expect(
      declareVersionScope({
        introducedVersionId: null,
        removedVersionId: null,
        nullScope: 'unknown',
        rationale: 'Source omitted game version',
      }).kind,
    ).toBe('unknown');
    expect(
      declareVersionScope({
        introducedVersionId: null,
        removedVersionId: null,
        nullScope: 'unversioned_system',
        rationale: 'Application privacy rule, not gameplay data',
      }).kind,
    ).toBe('unversioned_system');
  });
});
