export type ProgressKind =
  | 'pokemon'
  | 'recipe'
  | 'item'
  | 'quest'
  | 'town'
  | 'automation'
  | 'treasure_map'
  | 'collectible'
  | 'ditto_move';
export type ProgressState = 'confirmed' | 'inferred' | 'unknown';

export interface ProgressEntry {
  readonly state: Exclude<ProgressState, 'unknown'>;
  readonly value: boolean | number | string;
  readonly updatedAt: string;
  readonly inferredFrom?: string;
  readonly rule?: string;
  readonly ruleId?: string;
}

export interface InventoryEntry {
  readonly ownership: 'owned' | 'not_owned' | 'unknown';
  readonly quantityState: 'confirmed' | 'unknown';
  readonly quantity: number | null;
  readonly updatedAt: string;
}

export type TownInfrastructureState = 'confirmed' | 'missing' | 'unknown';

export interface ProgressGoal {
  readonly id: string;
  readonly type:
    | 'get-item'
    | 'craft-item'
    | 'reach-town-level'
    | 'build-automation'
    | 'acquire-pokemon'
    | 'complete-quest'
    | 'complete-treasure-map'
    | 'get-collectible'
    | 'learn-ditto-move';
  readonly slug: string;
  readonly label: string;
  readonly createdAt: string;
}

export interface RecentEntity {
  readonly kind: ProgressKind;
  readonly slug: string;
  readonly label: string;
  readonly viewedAt: string;
}

export interface RecentSearch {
  readonly query: string;
  readonly searchedAt: string;
}

export interface PokopiaProgress {
  readonly version: 5;
  readonly entries: Readonly<Record<string, ProgressEntry>>;
  readonly inventory: Readonly<Record<string, InventoryEntry>>;
  readonly townInfrastructure: Readonly<
    Record<string, Readonly<Record<string, TownInfrastructureState>>>
  >;
  readonly goals: readonly ProgressGoal[];
  readonly townResidents: Readonly<Record<string, readonly string[]>>;
  readonly favorites: readonly string[];
  readonly recentlyViewed: readonly RecentEntity[];
  readonly recentSearches: readonly RecentSearch[];
}

const PROGRESS_KINDS = new Set<ProgressKind>([
  'pokemon',
  'recipe',
  'item',
  'quest',
  'town',
  'automation',
  'treasure_map',
  'collectible',
  'ditto_move',
]);
const PROGRESS_GOAL_TYPES = new Set<ProgressGoal['type']>([
  'get-item',
  'craft-item',
  'reach-town-level',
  'build-automation',
  'acquire-pokemon',
  'complete-quest',
  'complete-treasure-map',
  'get-collectible',
  'learn-ditto-move',
]);

export const PROGRESS_STORAGE_KEY = 'pokopia-progress-v5';
export const PROGRESS_BACKUP_KEY = 'pokopia-progress-recovery-backup';
export const PROGRESS_RECOVERY_KEY = 'pokopia-progress-recovery-notice';
export const V3_STORAGE_KEY = 'pokopia-progress-v3';
export const V2_STORAGE_KEY = 'pokopia-progress-v2';
export const LEGACY_STORAGE_KEY = 'pokopia-progress-v1';
export const V4_STORAGE_KEY = 'pokopia-progress-v4';
export const PROGRESS_EVENT = 'pokopia-progress-change';
export const EMPTY_PROGRESS: PokopiaProgress = {
  version: 5,
  entries: {},
  inventory: {},
  townInfrastructure: {},
  goals: [],
  townResidents: {},
  favorites: [],
  recentlyViewed: [],
  recentSearches: [],
};
export const EMPTY_PROGRESS_SERIALIZED = JSON.stringify(EMPTY_PROGRESS);

export function progressId(kind: ProgressKind, slug: string): string {
  return `${kind}:${slug}`;
}

export interface ProgressParseResult {
  readonly progress: PokopiaProgress;
  readonly recovered: boolean;
  readonly reason: 'valid' | 'migrated' | 'repaired' | 'corrupt' | 'future-version';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProgressV5(value: Record<string, unknown>): ProgressParseResult {
  const sourceEntries = isRecord(value.entries) ? value.entries : {};
  const entries = Object.fromEntries(
    Object.entries(sourceEntries)
      .slice(0, 5_000)
      .filter(
        ([id, entry]) =>
          id.length > 0 &&
          id.length <= 200 &&
          isRecord(entry) &&
          (entry.state === 'confirmed' || entry.state === 'inferred') &&
          ['boolean', 'number', 'string'].includes(typeof entry.value) &&
          (typeof entry.value !== 'number' ||
            (Number.isFinite(entry.value) && Math.abs(entry.value) <= 1e9)) &&
          (typeof entry.value !== 'string' || entry.value.length <= 300) &&
          typeof entry.updatedAt === 'string' &&
          entry.updatedAt.length <= 64,
      )
      .map(([id, entry]) => {
        const source = entry as Record<string, unknown>;
        const optionalText = (name: 'inferredFrom' | 'rule' | 'ruleId') =>
          typeof source[name] === 'string' && source[name].length <= 300
            ? { [name]: source[name] }
            : {};
        return [
          id,
          {
            state: source.state,
            value: source.value,
            updatedAt: source.updatedAt,
            ...optionalText('inferredFrom'),
            ...optionalText('rule'),
            ...optionalText('ruleId'),
          } as ProgressEntry,
        ];
      }),
  );
  const goals = Array.isArray(value.goals)
    ? value.goals
        .filter(
          (goal): goal is ProgressGoal =>
            isRecord(goal) &&
            typeof goal.id === 'string' &&
            goal.id.length <= 160 &&
            typeof goal.type === 'string' &&
            PROGRESS_GOAL_TYPES.has(goal.type as ProgressGoal['type']) &&
            typeof goal.slug === 'string' &&
            goal.slug.length <= 160 &&
            typeof goal.label === 'string' &&
            goal.label.length <= 240 &&
            typeof goal.createdAt === 'string' &&
            goal.createdAt.length <= 64,
        )
        .slice(0, 50)
    : [];
  const townResidents = isRecord(value.townResidents)
    ? Object.fromEntries(
        Object.entries(value.townResidents)
          .filter(
            ([town, residents]) =>
              town.length <= 160 &&
              Array.isArray(residents) &&
              residents.every((resident) => typeof resident === 'string' && resident.length <= 160),
          )
          .slice(0, 100)
          .map(([town, residents]) => [town, (residents as string[]).slice(0, 100)]),
      )
    : {};
  const favorites = Array.isArray(value.favorites)
    ? value.favorites
        .filter((id): id is string => typeof id === 'string' && id.length <= 200)
        .slice(0, 100)
    : [];
  const recentlyViewed = Array.isArray(value.recentlyViewed)
    ? value.recentlyViewed
        .filter(
          (entry): entry is RecentEntity =>
            isRecord(entry) &&
            typeof entry.kind === 'string' &&
            PROGRESS_KINDS.has(entry.kind as ProgressKind) &&
            typeof entry.slug === 'string' &&
            entry.slug.length <= 160 &&
            typeof entry.label === 'string' &&
            entry.label.length <= 240 &&
            typeof entry.viewedAt === 'string' &&
            entry.viewedAt.length <= 64,
        )
        .slice(0, 12)
    : [];
  const recentSearches = Array.isArray(value.recentSearches)
    ? value.recentSearches
        .filter(
          (entry): entry is RecentSearch =>
            isRecord(entry) &&
            typeof entry.query === 'string' &&
            entry.query.length <= 120 &&
            typeof entry.searchedAt === 'string',
        )
        .slice(0, 8)
    : [];
  const sourceInventory = isRecord(value.inventory) ? value.inventory : {};
  const inventoryEntries = Object.fromEntries(
    Object.entries(sourceInventory)
      .slice(0, 5_000)
      .filter(
        ([slug, entry]) =>
          slug.length > 0 &&
          slug.length <= 160 &&
          isRecord(entry) &&
          (entry.ownership === 'owned' ||
            entry.ownership === 'not_owned' ||
            entry.ownership === 'unknown') &&
          (entry.quantityState === 'confirmed' || entry.quantityState === 'unknown') &&
          (entry.quantity === null ||
            (typeof entry.quantity === 'number' &&
              Number.isSafeInteger(entry.quantity) &&
              entry.quantity >= 0 &&
              entry.quantity <= 1e9)) &&
          typeof entry.updatedAt === 'string' &&
          entry.updatedAt.length <= 64 &&
          (entry.quantityState !== 'confirmed' || typeof entry.quantity === 'number') &&
          (entry.quantityState !== 'unknown' || entry.quantity === null),
      )
      .map(([slug, entry]) => [slug, { ...(entry as unknown as InventoryEntry) }]),
  ) as Record<string, InventoryEntry>;
  if (Object.keys(inventoryEntries).length === 0) {
    for (const [id, entry] of Object.entries(entries)) {
      if (!id.startsWith('item:') || typeof entry.value !== 'boolean') continue;
      const slug = id.slice('item:'.length);
      inventoryEntries[slug] = entry.value
        ? {
            ownership: 'owned',
            quantityState: 'unknown',
            quantity: null,
            updatedAt: entry.updatedAt,
          }
        : {
            ownership: 'not_owned',
            quantityState: 'confirmed',
            quantity: 0,
            updatedAt: entry.updatedAt,
          };
    }
  }
  const townInfrastructure = (
    isRecord(value.townInfrastructure)
      ? Object.fromEntries(
          Object.entries(value.townInfrastructure)
            .slice(0, 100)
            .filter(([town, states]) => town.length <= 160 && isRecord(states))
            .map(([town, states]) => [
              town,
              Object.fromEntries(
                Object.entries(states as Record<string, unknown>)
                  .slice(0, 200)
                  .filter(
                    ([key, state]) =>
                      key.length <= 160 &&
                      (state === 'confirmed' || state === 'missing' || state === 'unknown'),
                  ),
              ),
            ]),
        )
      : {}
  ) as Record<string, Record<string, TownInfrastructureState>>;
  const progress: PokopiaProgress = {
    version: 5,
    entries,
    inventory: inventoryEntries,
    townInfrastructure,
    goals,
    townResidents,
    favorites,
    recentlyViewed,
    recentSearches,
  };
  const repaired = JSON.stringify(progress) !== JSON.stringify(value);
  return { progress, recovered: repaired, reason: repaired ? 'repaired' : 'valid' };
}

export function parseProgressResult(snapshot: string): ProgressParseResult {
  try {
    const parsed = JSON.parse(snapshot) as unknown;
    if (isRecord(parsed) && typeof parsed.version === 'number' && parsed.version > 5)
      return { progress: EMPTY_PROGRESS, recovered: true, reason: 'future-version' };
    if (isRecord(parsed) && parsed.version === 5) return normalizeProgressV5(parsed);
    if (
      isRecord(parsed) &&
      ((parsed as { version?: number }).version === 4 ||
        (parsed as { version?: number }).version === 3)
    ) {
      const previous = parsed as Omit<PokopiaProgress, 'version'>;
      const result = normalizeProgressV5({ ...previous, version: 5 });
      return { ...result, recovered: true, reason: 'migrated' };
    }
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { version?: number }).version === 2
    ) {
      const legacy = parsed as {
        entries?: Readonly<Record<string, ProgressEntry>>;
        goals?: readonly ProgressGoal[];
      };
      const result = normalizeProgressV5({
        ...EMPTY_PROGRESS,
        entries: legacy.entries ?? {},
        goals: legacy.goals ?? [],
        version: 5,
      });
      return { ...result, recovered: true, reason: 'migrated' };
    }
    if (Array.isArray(parsed)) {
      const timestamp = 'legacy-import';
      const result = normalizeProgressV5({
        ...EMPTY_PROGRESS,
        entries: Object.fromEntries(
          parsed
            .filter(
              (value): value is string =>
                typeof value === 'string' && value.length > 0 && value.length <= 200,
            )
            .slice(0, 5_000)
            .map((id) => [id, { state: 'confirmed', value: true, updatedAt: timestamp }]),
        ),
      });
      return { ...result, recovered: true, reason: 'migrated' };
    }
  } catch {
    return { progress: EMPTY_PROGRESS, recovered: true, reason: 'corrupt' };
  }
  return { progress: EMPTY_PROGRESS, recovered: true, reason: 'corrupt' };
}

// Every progress-aware component parses the same snapshot on every render. Memoizing the last
// snapshot keeps that O(1) and gives consumers a referentially stable progress object.
let lastParsedSnapshot: string | undefined;
let lastParsedProgress: PokopiaProgress = EMPTY_PROGRESS;

export function parseProgress(snapshot: string): PokopiaProgress {
  if (snapshot !== lastParsedSnapshot) {
    lastParsedProgress = parseProgressResult(snapshot).progress;
    lastParsedSnapshot = snapshot;
  }
  return lastParsedProgress;
}

// useSyncExternalStore calls getSnapshot on every render; only re-validate when storage changed.
let lastStoredSnapshot: string | undefined;

export function readProgressSnapshot(): string {
  try {
    const current =
      localStorage.getItem(PROGRESS_STORAGE_KEY) ??
      localStorage.getItem(V4_STORAGE_KEY) ??
      localStorage.getItem(V3_STORAGE_KEY) ??
      localStorage.getItem(V2_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STORAGE_KEY) ??
      EMPTY_PROGRESS_SERIALIZED;
    if (current === lastStoredSnapshot) return current;
    const parsed = parseProgressResult(current);
    const normalized = JSON.stringify(parsed.progress);
    if (parsed.recovered) {
      if (current.length <= 1024 * 1024) localStorage.setItem(PROGRESS_BACKUP_KEY, current);
      localStorage.setItem(PROGRESS_RECOVERY_KEY, parsed.reason);
      localStorage.setItem(PROGRESS_STORAGE_KEY, normalized);
      lastStoredSnapshot = normalized;
      return normalized;
    }
    lastStoredSnapshot = current;
    return current;
  } catch {
    return EMPTY_PROGRESS_SERIALIZED;
  }
}

export function readProgressRecovery(): {
  readonly reason: string;
  readonly backup: string;
} | null {
  try {
    const reason = localStorage.getItem(PROGRESS_RECOVERY_KEY);
    const backup = localStorage.getItem(PROGRESS_BACKUP_KEY);
    return reason && backup ? { reason, backup } : null;
  } catch {
    return null;
  }
}

export function readProgressRecoverySnapshot(): string {
  return JSON.stringify(readProgressRecovery());
}

export function clearProgressRecovery(): void {
  try {
    localStorage.removeItem(PROGRESS_RECOVERY_KEY);
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

export function recordRecentEntity(
  progress: PokopiaProgress,
  entity: Omit<RecentEntity, 'viewedAt'>,
  viewedAt = new Date().toISOString(),
): PokopiaProgress {
  return {
    ...progress,
    recentlyViewed: [
      { ...entity, viewedAt },
      ...progress.recentlyViewed.filter(
        (current) => current.kind !== entity.kind || current.slug !== entity.slug,
      ),
    ].slice(0, 12),
  };
}

export function recordSearch(
  progress: PokopiaProgress,
  query: string,
  searchedAt = new Date().toISOString(),
): PokopiaProgress {
  const normalized = query.trim();
  if (normalized.length < 2) return progress;
  return {
    ...progress,
    recentSearches: [
      { query: normalized, searchedAt },
      ...progress.recentSearches.filter(
        (current) => current.query.toLocaleLowerCase('es') !== normalized.toLocaleLowerCase('es'),
      ),
    ].slice(0, 8),
  };
}

export function toggleFavorite(progress: PokopiaProgress, id: string): PokopiaProgress {
  return {
    ...progress,
    favorites: progress.favorites.includes(id)
      ? progress.favorites.filter((current) => current !== id)
      : [id, ...progress.favorites].slice(0, 100),
  };
}

export function revertInference(progress: PokopiaProgress, id: string): PokopiaProgress {
  if (progress.entries[id]?.state !== 'inferred') return progress;
  const entries = { ...progress.entries };
  delete entries[id];
  return { ...progress, entries };
}

export function writeProgress(progress: PokopiaProgress): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    // Private browsing or storage quotas can disable persistence.
  }
}

export function setInventoryEntry(
  progress: PokopiaProgress,
  slug: string,
  entry: Omit<InventoryEntry, 'updatedAt'>,
  updatedAt = new Date().toISOString(),
): PokopiaProgress {
  if (!slug || slug.length > 160) return progress;
  if (
    entry.quantityState === 'confirmed' &&
    (entry.quantity === null ||
      !Number.isSafeInteger(entry.quantity) ||
      entry.quantity < 0 ||
      entry.quantity > 1e9)
  )
    return progress;
  const normalized: InventoryEntry =
    entry.quantityState === 'unknown'
      ? { ...entry, quantity: null, updatedAt }
      : { ...entry, updatedAt };
  const entries = { ...progress.entries };
  // Unknown ownership must not be recorded as a confirmed "not owned" item state.
  if (normalized.ownership === 'unknown') delete entries[`item:${slug}`];
  else
    entries[`item:${slug}`] = {
      state: 'confirmed',
      value: normalized.ownership === 'owned',
      updatedAt,
    };
  return {
    ...progress,
    entries,
    inventory: { ...progress.inventory, [slug]: normalized },
  };
}

export function subscribeProgress(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(PROGRESS_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(PROGRESS_EVENT, callback);
  };
}
