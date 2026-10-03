export type UUID = string;
export type ISODateTime = string;

export const entityKinds = [
  'game',
  'game_version',
  'patch',
  'dlc',
  'content_pack',
  'event',
  'pokemon',
  'pokemon_form',
  'ability',
  'specialty',
  'habitat',
  'region',
  'zone',
  'town',
  'location',
  'biome',
  'item',
  'recipe',
  'crafting_station',
  'building',
  'furniture',
  'facility',
  'structure',
  'automation_system',
  'automation_component',
  'crop',
  'plant',
  'berry',
  'production_system',
  'quest',
  'treasure_map',
  'collectible',
  'ditto_move',
  'achievement',
] as const;

export type EntityKind = (typeof entityKinds)[number];

export const verificationStatuses = [
  'official',
  'confirmed',
  'community_confirmed',
  'inferred',
  'unverified',
  'conflicting',
  'unknown',
  'needs_testing',
] as const;

export type VerificationStatus = (typeof verificationStatuses)[number];
export type KnowledgeKind = 'fact' | 'inference' | 'recommendation';

export interface VersionRange {
  readonly introducedVersionId: UUID | null;
  readonly removedVersionId: UUID | null;
}

export type VersionScope =
  | {
      readonly kind: 'specific';
      readonly introducedVersionId: UUID;
      readonly removedVersionId: UUID | null;
    }
  | { readonly kind: 'unversioned_system'; readonly rationale: string }
  | { readonly kind: 'unknown'; readonly rationale: string };

export interface CanonicalEntity extends VersionRange {
  readonly id: UUID;
  readonly gameId: UUID;
  readonly kind: EntityKind;
  readonly slug: string;
  readonly displayName: string;
  readonly summary: string | null;
}

export type AssertionValue =
  | { readonly type: 'entity'; readonly entityId: UUID }
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'number'; readonly value: number; readonly unit: string | null }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'json'; readonly value: Readonly<Record<string, unknown>> };

export interface Provenance {
  readonly assertionId: UUID;
  readonly sourceId: UUID;
  readonly sourceDocumentId: UUID;
  readonly sourceSnapshotId: UUID;
  readonly sourceUrl: string | null;
  readonly evidenceExcerpt: string | null;
  readonly evidenceLocator: string | null;
  readonly contentHash: string | null;
}

export interface Assertion extends VersionRange {
  readonly id: UUID;
  readonly subjectEntityId: UUID;
  readonly predicate: string;
  readonly value: AssertionValue;
  readonly kind: KnowledgeKind;
  readonly verificationStatus: VerificationStatus;
  readonly confidence: number;
  readonly verifiedVersionId: UUID | null;
  readonly verifiedAt: ISODateTime | null;
  readonly provenance: readonly Provenance[];
}

export interface PokemonSummary {
  readonly entity: CanonicalEntity & { readonly kind: 'pokemon' };
  readonly nationalDexNumber: number | null;
  readonly forms: readonly CanonicalEntity[];
  readonly roleIds: readonly UUID[];
  readonly abilityIds: readonly UUID[];
  readonly locationIds: readonly UUID[];
}

export interface TownSummary {
  readonly entity: CanonicalEntity & { readonly kind: 'town' };
  readonly locationId: UUID | null;
  readonly biomeIds: readonly UUID[];
  readonly residentPokemonIds: readonly UUID[];
  readonly facilityIds: readonly UUID[];
}

export interface SearchQuery {
  readonly text: string;
  readonly kinds?: readonly EntityKind[];
  readonly gameVersionId?: UUID;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface SearchHit {
  readonly entity: CanonicalEntity;
  readonly rank: number;
  readonly matchedText: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface UserProgress {
  readonly userId: UUID;
  readonly entityId: UUID;
  readonly status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  readonly quantity: number | null;
  readonly notes: string | null;
  readonly updatedAt: ISODateTime;
}
