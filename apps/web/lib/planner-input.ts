import type { GoalDefinition } from '@pokopia/goals';
import type {
  ContentMode,
  PlanConstraint,
  PlannerPreference,
  PlayerStateSnapshot,
} from '@pokopia/planner';
import type { SimulationAction } from '@pokopia/rules';
import { sanitizeGoalRequest } from './goal-input';

const PREFERENCES = new Set<PlannerPreference>([
  'minimize_confirmed_materials',
  'prioritize_goals_unlocked',
  'minimize_actions',
  'prefer_current_town',
  'avoid_dlc',
  'prefer_base_game',
  'prioritize_certainty',
]);
const CONTENT_MODES = new Set<ContentMode>(['all', 'base_only', 'expansion_allowed']);

export interface SanitizedPlannerRequest {
  readonly goals: readonly (GoalDefinition & {
    readonly contentScope?: 'base_game' | 'expansion' | 'unknown';
  })[];
  readonly entries: PlayerStateSnapshot['entries'];
  readonly inventory: NonNullable<PlayerStateSnapshot['inventory']>;
  readonly constraints: PlanConstraint;
  readonly preferences: readonly PlannerPreference[];
  readonly gameVersion: string | null;
  readonly townInfrastructure: Readonly<
    Record<string, Readonly<Record<string, 'confirmed' | 'missing' | 'unknown'>>>
  >;
  readonly scenarioAction: SimulationAction | null;
  readonly scenarioComparison: readonly [SimulationAction, SimulationAction] | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizePlannerRequest(value: unknown): SanitizedPlannerRequest {
  const base = sanitizeGoalRequest(value);
  if (base.goals.length === 0 || base.goals.length > 20)
    throw new Error('planner requires between 1 and 20 goals');
  if (!record(value)) throw new Error('planner body must be an object');
  const rawConstraints = record(value.constraints) ? value.constraints : {};
  const contentMode = rawConstraints.contentMode ?? 'all';
  if (typeof contentMode !== 'string' || !CONTENT_MODES.has(contentMode as ContentMode))
    throw new Error('invalid content mode');
  const selectedTown = rawConstraints.selectedTown;
  if (
    selectedTown !== undefined &&
    selectedTown !== null &&
    (typeof selectedTown !== 'string' || selectedTown.length > 160)
  )
    throw new Error('invalid selected town');
  const reserves: Record<string, number> = {};
  if (rawConstraints.inventoryReserves !== undefined) {
    if (!record(rawConstraints.inventoryReserves)) throw new Error('invalid reserves');
    const pairs = Object.entries(rawConstraints.inventoryReserves);
    if (pairs.length > 100) throw new Error('too many reserves');
    for (const [slug, rawQuantity] of pairs) {
      if (
        !slug ||
        slug.length > 160 ||
        !Number.isSafeInteger(rawQuantity) ||
        Number(rawQuantity) < 0 ||
        Number(rawQuantity) > 1e9
      )
        throw new Error('invalid reserve');
      reserves[slug] = Number(rawQuantity);
    }
  }
  const preferences = Array.isArray(value.preferences)
    ? [...new Set(value.preferences)].map((preference) => {
        if (typeof preference !== 'string' || !PREFERENCES.has(preference as PlannerPreference))
          throw new Error('invalid preference');
        return preference as PlannerPreference;
      })
    : [];
  if (preferences.length > PREFERENCES.size) throw new Error('too many preferences');
  const gameVersion = value.gameVersion;
  if (
    gameVersion !== undefined &&
    gameVersion !== null &&
    (typeof gameVersion !== 'string' || gameVersion.length > 80)
  )
    throw new Error('invalid game version');
  const townInfrastructure = sanitizeTownInfrastructure(value.townInfrastructure);
  const pinnedActionIds = boundedStrings(rawConstraints.pinnedActionIds, 'pinned action', 100);
  return {
    goals: base.goals.map((goal, index) => {
      const rawGoal = Array.isArray(value.goals) ? value.goals[index] : null;
      const scope = record(rawGoal) ? rawGoal.contentScope : undefined;
      if (
        scope !== undefined &&
        scope !== 'base_game' &&
        scope !== 'expansion' &&
        scope !== 'unknown'
      )
        throw new Error('invalid goal content scope');
      return { ...goal, ...(scope === undefined ? {} : { contentScope: scope }) };
    }),
    entries: base.entries,
    inventory: base.inventory,
    constraints: {
      contentMode: contentMode as ContentMode,
      ...(selectedTown === undefined ? {} : { selectedTown: selectedTown as string | null }),
      inventoryReserves: reserves,
      ...(pinnedActionIds.length ? { pinnedActionIds } : {}),
    },
    preferences,
    gameVersion: typeof gameVersion === 'string' ? gameVersion : null,
    townInfrastructure,
    scenarioAction: sanitizeScenarioAction(value.scenarioAction),
    scenarioComparison: sanitizeScenarioComparison(value.scenarioComparison),
  };
}

function sanitizeScenarioComparison(
  value: unknown,
): readonly [SimulationAction, SimulationAction] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length !== 2) throw new Error('invalid scenario comparison');
  const left = sanitizeScenarioAction(value[0]);
  const right = sanitizeScenarioAction(value[1]);
  if (!left || !right) throw new Error('invalid scenario comparison');
  return [left, right];
}

function sanitizeTownInfrastructure(
  value: unknown,
): Readonly<Record<string, Readonly<Record<string, 'confirmed' | 'missing' | 'unknown'>>>> {
  if (value === undefined || value === null) return {};
  if (!record(value)) throw new Error('invalid town infrastructure');
  const towns = Object.entries(value);
  if (towns.length > 100) throw new Error('too many towns');
  return Object.fromEntries(
    towns.map(([town, rawStates]) => {
      if (!town || town.length > 160 || !record(rawStates))
        throw new Error('invalid town infrastructure');
      const states = Object.entries(rawStates);
      if (states.length > 200) throw new Error('too many infrastructure entries');
      return [
        town,
        Object.fromEntries(
          states.map(([name, state]) => {
            if (
              !name ||
              name.length > 160 ||
              (state !== 'confirmed' && state !== 'missing' && state !== 'unknown')
            )
              throw new Error('invalid infrastructure state');
            return [name, state];
          }),
        ),
      ];
    }),
  );
}

function boundedStrings(value: unknown, label: string, maximum: number): readonly string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`invalid ${label} list`);
  return [...new Set(value.map((entry) => bounded(entry, label)))];
}

function sanitizeScenarioAction(value: unknown): SimulationAction | null {
  if (value === undefined || value === null) return null;
  if (!record(value) || typeof value.kind !== 'string') throw new Error('invalid scenario action');
  if (value.kind === 'build')
    return { kind: 'build', systemSlug: bounded(value.systemSlug, 'system slug') };
  if (value.kind === 'unlock')
    return { kind: 'unlock', unlockId: bounded(value.unlockId, 'unlock id') };
  if (value.kind === 'satisfy')
    return { kind: 'satisfy', predicateId: bounded(value.predicateId, 'predicate id') };
  if (value.kind === 'craft') {
    const quantity = value.quantity;
    if (!Number.isSafeInteger(quantity) || Number(quantity) < 1 || Number(quantity) > 999)
      throw new Error('invalid scenario quantity');
    return {
      kind: 'craft',
      recipeSlug: bounded(value.recipeSlug, 'recipe slug'),
      quantity: Number(quantity),
    };
  }
  throw new Error('invalid scenario action');
}

function bounded(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value.length > 160)
    throw new Error(`invalid ${label}`);
  return value;
}
