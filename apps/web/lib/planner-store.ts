import type { PlanConstraint, PlannerGoal, PlannerPreference, SavedPlan } from '@pokopia/planner';

export interface SavedScenario {
  readonly id: string;
  readonly label: string;
  readonly action: { readonly kind: 'build'; readonly systemSlug: string };
  readonly goalIds: readonly string[];
  readonly createdAt: string;
}

export interface PlannerLocalState {
  readonly version: 1;
  readonly plans: readonly SavedPlan[];
  readonly scenarios: readonly SavedScenario[];
}

const KEY = 'pokopia-planner-v5-5';
const EVENT = 'pokopia-planner-change';
const EMPTY: PlannerLocalState = { version: 1, plans: [], scenarios: [] };
const EMPTY_SERIALIZED = JSON.stringify(EMPTY);

export function plannerStoreSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? EMPTY_SERIALIZED;
  } catch {
    return EMPTY_SERIALIZED;
  }
}

export function subscribePlannerStore(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EVENT, callback);
  };
}

export function parsePlannerStore(snapshot: string): PlannerLocalState {
  try {
    const value = JSON.parse(snapshot) as unknown;
    if (!record(value) || value.version !== 1) return EMPTY;
    const plans = Array.isArray(value.plans) ? value.plans.filter(validPlan).slice(0, 20) : [];
    const scenarios = Array.isArray(value.scenarios)
      ? value.scenarios.filter(validScenario).slice(0, 20)
      : [];
    return { version: 1, plans, scenarios };
  } catch {
    return EMPTY;
  }
}

export function savePlan(
  state: PlannerLocalState,
  input: {
    readonly id: string;
    readonly name: string;
    readonly goals: readonly PlannerGoal[];
    readonly preferences: readonly PlannerPreference[];
    readonly constraints: PlanConstraint;
    readonly stateRevision: string;
    readonly dataVersion: string;
    readonly gameVersion: string | null;
  },
  createdAt = new Date().toISOString(),
): PlannerLocalState {
  const plan: SavedPlan = {
    id: input.id,
    name: input.name.trim().slice(0, 120) || 'Plan sin título',
    goals: input.goals.slice(0, 20),
    preferences: input.preferences,
    constraints: input.constraints,
    createdStateRevision: input.stateRevision,
    dataVersion: input.dataVersion,
    gameVersion: input.gameVersion,
    completedActionIds: [],
    createdAt,
  };
  return write({
    ...state,
    plans: [plan, ...state.plans.filter((entry) => entry.id !== plan.id)].slice(0, 20),
  });
}

export function saveScenario(state: PlannerLocalState, scenario: SavedScenario): PlannerLocalState {
  return write({
    ...state,
    scenarios: [scenario, ...state.scenarios.filter((entry) => entry.id !== scenario.id)].slice(
      0,
      20,
    ),
  });
}

export function markPlanAction(
  state: PlannerLocalState,
  planId: string,
  actionId: string,
): PlannerLocalState {
  return write({
    ...state,
    plans: state.plans.map((plan) =>
      plan.id === planId
        ? {
            ...plan,
            completedActionIds: plan.completedActionIds.includes(actionId)
              ? plan.completedActionIds.filter((id) => id !== actionId)
              : [...plan.completedActionIds, actionId].slice(0, 500),
          }
        : plan,
    ),
  });
}

function write(state: PlannerLocalState): PlannerLocalState {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Local persistence can be unavailable or full; the confirmed game state remains untouched.
  }
  return state;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validPlan(value: unknown): value is SavedPlan {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    value.id.length <= 180 &&
    typeof value.name === 'string' &&
    value.name.length <= 120 &&
    Array.isArray(value.goals) &&
    value.goals.length <= 20 &&
    value.goals.every(
      (goal) =>
        record(goal) &&
        typeof goal.id === 'string' &&
        typeof goal.type === 'string' &&
        typeof goal.slug === 'string' &&
        typeof goal.label === 'string',
    ) &&
    Array.isArray(value.preferences) &&
    record(value.constraints) &&
    typeof value.createdStateRevision === 'string' &&
    typeof value.dataVersion === 'string' &&
    (value.gameVersion === null || typeof value.gameVersion === 'string') &&
    Array.isArray(value.completedActionIds) &&
    value.completedActionIds.every((id) => typeof id === 'string') &&
    typeof value.createdAt === 'string'
  );
}

function validScenario(value: unknown): value is SavedScenario {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    record(value.action) &&
    value.action.kind === 'build' &&
    typeof value.action.systemSlug === 'string' &&
    Array.isArray(value.goalIds) &&
    value.goalIds.every((id) => typeof id === 'string') &&
    typeof value.createdAt === 'string'
  );
}
