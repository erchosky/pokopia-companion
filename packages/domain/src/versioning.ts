import type { VersionRange, VersionScope, UUID } from './model.js';

export interface OrderedVersion {
  readonly id: UUID;
  readonly ordinal: number;
}

export function isEffectiveAt(
  range: VersionRange,
  target: OrderedVersion,
  versions: ReadonlyMap<UUID, OrderedVersion>,
): boolean {
  const introduced = range.introducedVersionId
    ? versions.get(range.introducedVersionId)
    : undefined;
  const removed = range.removedVersionId ? versions.get(range.removedVersionId) : undefined;

  if (range.introducedVersionId && !introduced) {
    throw new Error(`Unknown introduced version: ${range.introducedVersionId}`);
  }
  if (range.removedVersionId && !removed) {
    throw new Error(`Unknown removed version: ${range.removedVersionId}`);
  }

  return (
    (introduced?.ordinal ?? Number.NEGATIVE_INFINITY) <= target.ordinal &&
    target.ordinal < (removed?.ordinal ?? Number.POSITIVE_INFINITY)
  );
}

export function assertValidRange(
  range: VersionRange,
  versions: ReadonlyMap<UUID, OrderedVersion>,
): void {
  if (!range.introducedVersionId || !range.removedVersionId) return;
  const introduced = versions.get(range.introducedVersionId);
  const removed = versions.get(range.removedVersionId);
  if (!introduced || !removed) throw new Error('Version range references an unknown version');
  if (introduced.ordinal >= removed.ordinal) {
    throw new Error('removedVersionId must be later than introducedVersionId');
  }
}

/** Null version IDs are ambiguous; callers must declare unknown versus system-scoped explicitly. */
export function declareVersionScope(input: {
  readonly introducedVersionId: UUID | null;
  readonly removedVersionId: UUID | null;
  readonly nullScope?: 'unversioned_system' | 'unknown';
  readonly rationale: string;
}): VersionScope {
  if (input.introducedVersionId)
    return {
      kind: 'specific',
      introducedVersionId: input.introducedVersionId,
      removedVersionId: input.removedVersionId,
    };
  if (!input.nullScope)
    throw new Error('Null version IDs require an explicit unknown or unversioned_system scope');
  return { kind: input.nullScope, rationale: input.rationale };
}
