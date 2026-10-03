import type { GoalDefinition, GoalPlayerState, GoalType } from '@pokopia/goals';

const GOAL_TYPES = new Set<GoalType>([
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

export class GoalInputError extends Error {}

export interface SanitizedGoalRequest {
  readonly goals: readonly GoalDefinition[];
  readonly entries: GoalPlayerState['entries'];
  readonly inventory: NonNullable<GoalPlayerState['inventory']>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, name: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum)
    throw new GoalInputError(`${name} is invalid`);
  return value;
}

export function sanitizeGoalRequest(value: unknown): SanitizedGoalRequest {
  if (!record(value)) throw new GoalInputError('body must be an object');
  const rawGoals = value.goals ?? [];
  const rawEntries = value.entries ?? {};
  const rawInventory = value.inventory ?? {};
  if (!Array.isArray(rawGoals) || rawGoals.length > 50)
    throw new GoalInputError('goals must contain at most 50 entries');
  if (!record(rawEntries)) throw new GoalInputError('entries must be an object');
  if (!record(rawInventory)) throw new GoalInputError('inventory must be an object');
  const goalIds = new Set<string>();
  const goals = rawGoals.map((rawGoal): GoalDefinition => {
    if (!record(rawGoal)) throw new GoalInputError('goal must be an object');
    const id = boundedText(rawGoal.id, 'goal.id', 160);
    if (goalIds.has(id)) throw new GoalInputError('goal IDs must be unique');
    goalIds.add(id);
    if (typeof rawGoal.type !== 'string' || !GOAL_TYPES.has(rawGoal.type as GoalType))
      throw new GoalInputError('goal.type is invalid');
    const targetLevel = rawGoal.targetLevel;
    if (
      targetLevel !== undefined &&
      targetLevel !== null &&
      (!Number.isInteger(targetLevel) || Number(targetLevel) < 0 || Number(targetLevel) > 100)
    )
      throw new GoalInputError('goal.targetLevel is invalid');
    return {
      id,
      type: rawGoal.type as GoalType,
      slug: boundedText(rawGoal.slug, 'goal.slug', 160),
      label: boundedText(rawGoal.label, 'goal.label', 240),
      ...(targetLevel === undefined ? {} : { targetLevel: targetLevel as number | null }),
    };
  });
  const rawEntryPairs = Object.entries(rawEntries);
  if (rawEntryPairs.length > 2_000) throw new GoalInputError('too many progress entries');
  const entries: Record<string, GoalPlayerState['entries'][string]> = {};
  for (const [key, rawEntry] of rawEntryPairs) {
    if (!key || key.length > 200 || !record(rawEntry))
      throw new GoalInputError('progress entry is invalid');
    if (rawEntry.state !== 'confirmed' && rawEntry.state !== 'inferred')
      throw new GoalInputError('progress state is invalid');
    const entryValue = rawEntry.value;
    if (
      !['boolean', 'number', 'string'].includes(typeof entryValue) ||
      (typeof entryValue === 'number' &&
        (!Number.isFinite(entryValue) || Math.abs(entryValue) > 1e9)) ||
      (typeof entryValue === 'string' && entryValue.length > 300)
    )
      throw new GoalInputError('progress value is invalid');
    entries[key] = { state: rawEntry.state, value: entryValue as boolean | number | string };
  }
  const inventoryPairs = Object.entries(rawInventory);
  if (inventoryPairs.length > 5_000) throw new GoalInputError('too many inventory entries');
  const inventory: Record<string, NonNullable<GoalPlayerState['inventory']>[string]> = {};
  for (const [slug, rawEntry] of inventoryPairs) {
    if (!slug || slug.length > 160 || !record(rawEntry))
      throw new GoalInputError('inventory entry is invalid');
    if (
      rawEntry.ownership !== 'owned' &&
      rawEntry.ownership !== 'not_owned' &&
      rawEntry.ownership !== 'unknown'
    )
      throw new GoalInputError('inventory ownership is invalid');
    if (rawEntry.quantityState !== 'confirmed' && rawEntry.quantityState !== 'unknown')
      throw new GoalInputError('inventory quantity state is invalid');
    if (
      rawEntry.quantity !== null &&
      (!Number.isSafeInteger(rawEntry.quantity) ||
        Number(rawEntry.quantity) < 0 ||
        Number(rawEntry.quantity) > 1e9)
    )
      throw new GoalInputError('inventory quantity is invalid');
    if (
      (rawEntry.quantityState === 'confirmed' && typeof rawEntry.quantity !== 'number') ||
      (rawEntry.quantityState === 'unknown' && rawEntry.quantity !== null)
    )
      throw new GoalInputError('inventory quantity conflicts with its state');
    inventory[slug] = {
      ownership: rawEntry.ownership,
      quantityState: rawEntry.quantityState,
      quantity: rawEntry.quantity as number | null,
    };
  }
  return { goals, entries, inventory };
}
