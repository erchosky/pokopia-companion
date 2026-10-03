import { createGoalCatalog } from '@pokopia/goals';
import {
  compareScenarios,
  planGoals,
  simulateScenario,
  snapshotFingerprint,
  type PlannerMetric,
  type PlayerStateSnapshot,
} from '@pokopia/planner';
import type { PlayerWorldSnapshot } from '@pokopia/rules';
import { clientIdentity, RATE_LIMIT_POLICIES, securityLog } from '@pokopia/security';
import { knowledgeGraph, repository } from '@/lib/data';
import { readBoundedJson } from '@/lib/bounded-json';
import { sanitizePlannerRequest } from '@/lib/planner-input';
import { webRateLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const subject = clientIdentity(request.headers, {
    platform: process.env.VERCEL === '1' ? 'vercel' : 'generic',
    trustProxyHeaders: process.env.POKOPIA_TRUST_PROXY_HEADERS === 'true',
  });
  const limit = await webRateLimiter().consume(RATE_LIMIT_POLICIES.goalEvaluation, subject);
  if (!limit.allowed)
    return Response.json(
      { error: 'Too many planner evaluations. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1_000))),
        },
      },
    );
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, {
      maximumBytes: 96 * 1024,
      maximumDepth: 10,
      maximumNodes: 8_000,
    });
  } catch (error) {
    const oversized = error instanceof Error && error.message === 'payload-too-large';
    return Response.json(
      { error: oversized ? 'Planner payload too large.' : 'Invalid JSON payload.' },
      { status: oversized ? 413 : 400 },
    );
  }
  let input: ReturnType<typeof sanitizePlannerRequest>;
  try {
    input = sanitizePlannerRequest(raw);
  } catch {
    securityLog('warn', 'planner.invalid_payload', { subject });
    return Response.json({ error: 'Invalid planner payload.' }, { status: 400 });
  }
  const [data, graph] = await Promise.all([repository(), knowledgeGraph()]);
  const recipes = data.listRecipes(10_000);
  const entries = projectTownInfrastructure(
    input.entries,
    input.townInfrastructure,
    input.constraints.selectedTown,
  );
  const stateRevision = snapshotFingerprint({
    entries,
    inventory: input.inventory,
    gameVersion: input.gameVersion,
    selectedTown: input.constraints.selectedTown ?? null,
  });
  const state: PlayerStateSnapshot = {
    revision: stateRevision,
    dataVersion: data.health().snapshot,
    gameVersion: input.gameVersion,
    entries,
    inventory: input.inventory,
    world: worldSnapshot(entries, input.inventory, input.townInfrastructure),
  };
  const plannerInput = {
    goals: input.goals,
    catalog: createGoalCatalog(data, graph, input.goals),
    state,
    recipes,
    metrics: quantitativeMetrics(data.listQuantitativeParameters()),
    constraints: input.constraints,
    preferences: input.preferences,
  };
  const result = input.scenarioComparison
    ? {
        simulation: null,
        plan: planGoals(plannerInput),
        scenarioComparison: compareScenarios(
          plannerInput,
          input.scenarioComparison[0],
          input.scenarioComparison[1],
        ),
      }
    : input.scenarioAction
      ? { ...simulateScenario(plannerInput, input.scenarioAction), scenarioComparison: null }
      : { simulation: null, plan: planGoals(plannerInput), scenarioComparison: null };
  return Response.json({ ...result, stateRevision, dataVersion: state.dataVersion });
}

function worldSnapshot(
  entries: PlayerStateSnapshot['entries'],
  inventory: NonNullable<PlayerStateSnapshot['inventory']>,
  townInfrastructure: Readonly<
    Record<string, Readonly<Record<string, 'confirmed' | 'missing' | 'unknown'>>>
  >,
): PlayerWorldSnapshot {
  const ruleInventory = Object.fromEntries(
    Object.entries(inventory).map(([slug, entry]) => [
      slug,
      {
        ownership:
          entry.ownership === 'owned'
            ? ('yes' as const)
            : entry.ownership === 'not_owned'
              ? ('no' as const)
              : ('unknown' as const),
        quantity: entry.quantityState === 'confirmed' ? entry.quantity : null,
      },
    ]),
  );
  const townLevels: Record<string, number | null> = {};
  const builtSystems: string[] = [];
  const unlocks: Record<string, 'yes' | 'no' | 'unknown'> = {};
  for (const [id, entry] of Object.entries(entries)) {
    const town = id.match(/^town:(.+):level$/);
    if (town?.[1]) townLevels[town[1]] = typeof entry.value === 'number' ? entry.value : null;
    else if (id.startsWith('automation:') && entry.value === true)
      builtSystems.push(id.slice('automation:'.length));
    else if (typeof entry.value === 'boolean') unlocks[id] = entry.value ? 'yes' : 'no';
  }
  return {
    inventory: ruleInventory,
    townLevels,
    infrastructure: Object.fromEntries(
      Object.entries(townInfrastructure).map(([town, states]) => [
        town,
        Object.fromEntries(
          Object.entries(states).map(([name, state]) => [
            name,
            state === 'confirmed' ? 'yes' : state === 'missing' ? 'no' : 'unknown',
          ]),
        ),
      ]),
    ),
    builtSystems: builtSystems.sort(),
    unlocks,
  };
}

function projectTownInfrastructure(
  entries: PlayerStateSnapshot['entries'],
  townInfrastructure: Readonly<
    Record<string, Readonly<Record<string, 'confirmed' | 'missing' | 'unknown'>>>
  >,
  selectedTown: string | null | undefined,
): PlayerStateSnapshot['entries'] {
  if (!selectedTown) return entries;
  const selected = townInfrastructure[selectedTown];
  if (!selected) return entries;
  return Object.fromEntries([
    ...Object.entries(entries),
    ...Object.entries(selected).flatMap(([name, state]) =>
      state === 'unknown'
        ? []
        : [
            [
              `infrastructure:${name}`,
              { state: 'confirmed' as const, value: state === 'confirmed' },
            ] as const,
          ],
    ),
  ]);
}

function quantitativeMetrics(
  values: ReturnType<Awaited<ReturnType<typeof repository>>['listQuantitativeParameters']>,
): PlannerMetric[] {
  return values.flatMap((parameter): PlannerMetric[] => {
    if (parameter.assertionStatus !== 'accepted') return [];
    const predicate = parameter.predicate.toLocaleLowerCase('en');
    const dimension = predicate.includes('generation')
      ? 'power_generation'
      : predicate.includes('demand') || predicate.includes('consumption')
        ? 'power_demand'
        : predicate.includes('range') || predicate.includes('reach')
          ? 'range'
          : predicate.includes('capacity') || predicate.includes('limit')
            ? 'capacity'
            : predicate.includes('duration') || predicate.includes('build_time')
              ? 'build_duration'
              : predicate.includes('throughput') || predicate.includes('rate')
                ? 'throughput'
                : null;
    if (!dimension) return [];
    return [
      {
        subject: parameter.subjectSlug,
        dimension,
        value: parameter.value,
        unit: parameter.unit,
        accepted: true,
        evidenceIds: [parameter.source.snapshot || parameter.source.url],
      },
    ];
  });
}
