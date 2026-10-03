import type { EntityKind, KnowledgeKind, UUID, VerificationStatus } from '@pokopia/domain';

export const canonicalSeedFormat = 'pokopia-canonical-seed/v1' as const;

export interface SeedSourceDocument {
  readonly naturalKey: string;
  readonly snapshotKey: string;
  readonly sourceUrl: string | null;
  readonly documentPath: string;
  readonly mediaType: string;
  readonly contentHash: string;
  readonly title: string | null;
  readonly parserVersion: string;
}

export interface SeedEntity {
  readonly naturalKey: string;
  readonly kind: EntityKind;
  readonly slug: string;
  readonly displayName: string;
  readonly summary: string | null;
  readonly introducedVersion: string | null;
  readonly removedVersion: string | null;
}

export type SeedAssertionValue =
  | { readonly type: 'entity'; readonly naturalKey: string }
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'number'; readonly value: number; readonly unit: string | null }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'json'; readonly value: Readonly<Record<string, unknown>> };

export interface SeedAssertion {
  readonly assertionHash: string;
  readonly subjectNaturalKey: string;
  readonly predicate: string;
  readonly value: SeedAssertionValue;
  readonly kind: KnowledgeKind;
  readonly verificationStatus: VerificationStatus;
  readonly confidence: number;
  readonly introducedVersion: string | null;
  readonly removedVersion: string | null;
  readonly evidence: readonly {
    readonly sourceDocumentNaturalKey: string;
    readonly locator: string | null;
    readonly excerpt: string | null;
    readonly evidenceHash: string | null;
  }[];
}

export interface CanonicalSeedBundle {
  readonly format: typeof canonicalSeedFormat;
  readonly generatedAt: string;
  readonly game: { readonly slug: string; readonly name: string };
  readonly versions: readonly {
    readonly version: string;
    readonly ordinal: number;
    readonly releasedAt: string | null;
    readonly isCurrent: boolean;
  }[];
  readonly source: {
    readonly name: string;
    readonly kind: 'official' | 'publisher' | 'community' | 'manual_test' | 'internal';
    readonly snapshotKey: string;
    readonly capturedAt: string;
    readonly contentHash: string;
    readonly parserVersion: string;
  };
  readonly documents: readonly SeedSourceDocument[];
  readonly entities: readonly SeedEntity[];
  readonly assertions: readonly SeedAssertion[];
}

export interface SeedResult {
  readonly gameId: UUID;
  readonly snapshotId: UUID;
  readonly entitiesUpserted: number;
  readonly assertionsStaged: number;
}

export interface CanonicalSeeder {
  /** Stages assertions; it never promotes candidates to accepted facts without review. */
  seed(bundle: CanonicalSeedBundle): Promise<SeedResult>;
}

export function assertCanonicalSeedBundle(value: unknown): asserts value is CanonicalSeedBundle {
  if (!value || typeof value !== 'object') throw new Error('Seed must be an object');
  const candidate = value as Partial<CanonicalSeedBundle>;
  if (candidate.format !== canonicalSeedFormat) {
    throw new Error(`Unsupported seed format: ${String(candidate.format)}`);
  }
  if (!candidate.game?.slug || !candidate.game.name) throw new Error('Seed game is incomplete');
  if (!Array.isArray(candidate.versions) || !Array.isArray(candidate.entities)) {
    throw new Error('Seed versions and entities must be arrays');
  }
  if (!Array.isArray(candidate.documents) || !Array.isArray(candidate.assertions)) {
    throw new Error('Seed documents and assertions must be arrays');
  }
  const naturalKeys = new Set<string>();
  for (const entity of candidate.entities) {
    if (!entity.naturalKey || naturalKeys.has(entity.naturalKey)) {
      throw new Error(`Duplicate or empty entity natural key: ${entity.naturalKey}`);
    }
    naturalKeys.add(entity.naturalKey);
  }
  for (const assertion of candidate.assertions) {
    if (!naturalKeys.has(assertion.subjectNaturalKey)) {
      throw new Error(`Assertion subject is missing: ${assertion.subjectNaturalKey}`);
    }
    if (assertion.confidence < 0 || assertion.confidence > 1) {
      throw new Error(`Assertion confidence is out of range: ${assertion.assertionHash}`);
    }
  }
}
