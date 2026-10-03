import {
  evaluateGoals,
  type GoalCatalog,
  type GoalCatalogEdge,
  type GoalCatalogNode,
  type GoalDefinition,
  type GoalEvaluation,
  type GoalPlayerState,
} from '@pokopia/goals';
import {
  CraftingCycleError,
  calculateCraftPlan,
  simulateAction,
  type CraftPlan,
  type CraftRecipe,
  type EvaluationTrace,
  type PlayerWorldSnapshot,
  type SimulationAction,
} from '@pokopia/rules';

export type PlanCompleteness = 'exact' | 'partial' | 'structural' | 'blocked';
export type CapabilityState = 'available' | 'partial' | 'unavailable';
export type PlanActionType = 'gameplay' | 'confirmation' | 'research' | 'decision';
export type PlanActionKind =
  | 'craft'
  | 'build'
  | 'obtain'
  | 'complete_request'
  | 'unlock'
  | 'place_infrastructure'
  | 'confirm_inventory_quantity'
  | 'confirm_ownership'
  | 'confirm_town_infrastructure'
  | 'measurement_required'
  | 'evidence_unresolved'
  | 'choose_recipe_alternative'
  | 'choose_town'
  | 'choose_optional_route';
export type BlockerType = 'gameplay' | 'state' | 'evidence' | 'measurement';
export type ContentMode = 'all' | 'base_only' | 'expansion_allowed';

export interface PlannerGoal extends GoalDefinition {
  readonly quantity?: number;
  readonly contentScope?: 'base_game' | 'expansion' | 'unknown';
}

export interface PlayerStateSnapshot extends GoalPlayerState {
  readonly revision: string;
  readonly dataVersion: string;
  readonly gameVersion: string | null;
  readonly world?: PlayerWorldSnapshot;
}

export interface PlanConstraint {
  readonly contentMode?: ContentMode;
  readonly selectedTown?: string | null;
  readonly inventoryReserves?: Readonly<Record<string, number>>;
  readonly avoidRecipeIds?: readonly string[];
  readonly requireGoalBefore?: readonly {
    readonly beforeGoalId: string;
    readonly afterGoalId: string;
  }[];
  readonly pinnedActionIds?: readonly string[];
}

export type PlannerPreference =
  | 'minimize_confirmed_materials'
  | 'prioritize_goals_unlocked'
  | 'minimize_actions'
  | 'prefer_current_town'
  | 'avoid_dlc'
  | 'prefer_base_game'
  | 'prioritize_certainty';

export interface PlannerMetric {
  readonly subject: string;
  readonly dimension:
    'power_generation' | 'power_demand' | 'range' | 'capacity' | 'build_duration' | 'throughput';
  readonly value: number;
  readonly unit: string;
  readonly accepted: boolean;
  readonly evidenceIds: readonly string[];
}

export interface PlanGoalsInput {
  readonly goals: readonly PlannerGoal[];
  readonly catalog: GoalCatalog;
  readonly state: PlayerStateSnapshot;
  readonly recipes: readonly CraftRecipe[];
  readonly metrics?: readonly PlannerMetric[];
  readonly constraints?: PlanConstraint;
  readonly preferences?: readonly PlannerPreference[];
  readonly maximumDepth?: number;
}

export interface PlanNode {
  readonly id: string;
  readonly type:
    | 'goal'
    | 'action'
    | 'requirement'
    | 'item'
    | 'recipe'
    | 'automation'
    | 'unlock'
    | 'infrastructure'
    | 'information_request'
    | 'measurement_gap';
  readonly label: string;
  readonly href: string | null;
  readonly goalIds: readonly string[];
  readonly state: 'satisfied' | 'missing' | 'unknown' | 'pending';
}

export interface PlanEdge {
  readonly from: string;
  readonly to: string;
  readonly type:
    'requires' | 'satisfies' | 'unlocks' | 'produces' | 'enables' | 'confirms' | 'blocks';
}

export interface PlanBlocker {
  readonly id: string;
  readonly type: BlockerType;
  readonly subjectId: string;
  readonly label: string;
  readonly reason: string;
  readonly goalIds: readonly string[];
  readonly measurementId: string | null;
}

export interface PlanAction {
  readonly id: string;
  readonly type: PlanActionType;
  readonly kind: PlanActionKind;
  readonly subjectId: string;
  readonly title: string;
  readonly href: string | null;
  readonly whyNow: string;
  readonly unlocksGoals: readonly string[];
  readonly removesBlockers: readonly string[];
  readonly dependsOn: readonly string[];
  readonly certainty: 'confirmed' | 'partial' | 'unknown';
  readonly evidenceIds: readonly string[];
  readonly equivalentTo: readonly string[];
  readonly parallelizableWith: readonly string[];
}

export interface SharedDependency {
  readonly nodeId: string;
  readonly label: string;
  readonly goalIds: readonly string[];
  readonly kind:
    'material' | 'intermediate' | 'unlock' | 'infrastructure' | 'action' | 'requirement';
  readonly exactReusableSurplus: number | null;
}

export interface ResourceAllocation {
  readonly slug: string;
  readonly label: string;
  readonly requiredKnown: number;
  readonly inventoryConfirmed: number | null;
  readonly reserved: number;
  readonly allocated: number | null;
  readonly missing: number | null;
  readonly goalIds: readonly string[];
}

export interface ComparisonDimension {
  readonly id:
    | 'confirmed_materials'
    | 'known_build_time'
    | 'progression_depth'
    | 'blockers'
    | 'shared_goal_utility'
    | 'known_power'
    | 'certainty';
  readonly direction: 'minimize' | 'maximize';
  readonly value: number | null;
  readonly unit: string;
  readonly known: boolean;
}

export interface PlanAlternative {
  readonly id: string;
  readonly label: string;
  readonly goalIds: readonly string[];
  readonly dimensions: readonly ComparisonDimension[];
  readonly unknowns: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly relation: 'pareto' | 'dominated' | 'incomparable' | 'only';
  readonly reason: string;
}

export interface PlanCapability {
  readonly id:
    | 'structuralPlanning'
    | 'exactMaterialPlanning'
    | 'timeOptimization'
    | 'throughputOptimization'
    | 'powerOptimization'
    | 'rangeReasoning';
  readonly state: CapabilityState;
  readonly reason: string;
}

export interface PlanTrace {
  readonly id: string;
  readonly goalId: string;
  readonly requirementId: string | null;
  readonly ruleId: string;
  readonly playerStateRef: string;
  readonly actionId: string | null;
  readonly consequence: string;
  readonly evidenceIds: readonly string[];
}

export interface PlanResult {
  readonly id: string;
  readonly inputFingerprint: string;
  readonly completeness: PlanCompleteness;
  readonly goals: readonly GoalEvaluation[];
  readonly graph: { readonly nodes: readonly PlanNode[]; readonly edges: readonly PlanEdge[] };
  readonly actions: readonly PlanAction[];
  readonly actionFrontier: readonly string[];
  readonly nextBestKnownAction: string | null;
  readonly nextActionReason: string;
  readonly blockers: readonly PlanBlocker[];
  readonly unknowns: readonly string[];
  readonly sharedDependencies: readonly SharedDependency[];
  readonly resources: readonly ResourceAllocation[];
  readonly alternatives: readonly PlanAlternative[];
  readonly paretoFront: readonly string[];
  readonly capabilities: readonly PlanCapability[];
  readonly traces: readonly PlanTrace[];
  readonly dependencyCriticalPath: readonly string[];
  readonly independentActionGroups: readonly (readonly string[])[];
  readonly warnings: readonly string[];
  readonly diagnostics: {
    readonly nodes: number;
    readonly edges: number;
    readonly evaluatedGoals: number;
    readonly memoizedTargets: number;
    readonly prunedAlternatives: number;
  };
}

export interface ScenarioComparisonResult {
  readonly left: ScenarioSummary;
  readonly right: ScenarioSummary;
  readonly relation: 'left_dominates' | 'right_dominates' | 'equivalent' | 'incomparable';
  readonly reason: string;
  readonly dimensions: readonly {
    readonly id: 'completed_goals' | 'blockers' | 'known_actions';
    readonly direction: 'maximize' | 'minimize';
    readonly left: number;
    readonly right: number;
  }[];
}

export interface ScenarioSummary {
  readonly action: SimulationAction;
  readonly status: 'yes' | 'no' | 'unknown';
  readonly changed: readonly string[];
  readonly completeness: PlanCompleteness;
  readonly completedGoals: number;
  readonly blockers: number;
  readonly knownActions: number;
  readonly criticalUnknowns: readonly string[];
}

export interface SavedPlan {
  readonly id: string;
  readonly name: string;
  readonly goals: readonly PlannerGoal[];
  readonly preferences: readonly PlannerPreference[];
  readonly constraints: PlanConstraint;
  readonly createdStateRevision: string;
  readonly dataVersion: string;
  readonly gameVersion: string | null;
  readonly completedActionIds: readonly string[];
  readonly createdAt: string;
}

export interface StalePlanResult {
  readonly stale: boolean;
  readonly reasons: readonly ('player_state' | 'data_version' | 'game_version')[];
}

const MAX_GOALS = 20;
const MAX_DEPTH = 32;

export function planGoals(input: PlanGoalsInput): PlanResult {
  if (input.goals.length === 0) throw new Error('At least one goal is required');
  if (input.goals.length > MAX_GOALS) throw new Error(`At most ${MAX_GOALS} goals are supported`);
  const goalIds = new Set<string>();
  for (const goal of input.goals) {
    if (goalIds.has(goal.id)) throw new Error(`Duplicate goal id: ${goal.id}`);
    goalIds.add(goal.id);
    if (goal.quantity !== undefined && (!Number.isSafeInteger(goal.quantity) || goal.quantity < 1))
      throw new Error(`Invalid goal quantity: ${goal.id}`);
  }
  const goals = [...input.goals].sort((a, b) => a.id.localeCompare(b.id));
  const evaluations = evaluateGoals(goals, input.catalog, input.state);
  const nodeGoals = new Map<string, Set<string>>();
  const nodes = new Map<string, PlanNode>();
  const edges = new Map<string, PlanEdge>();
  const blockers = new Map<string, PlanBlocker>();
  const actions = new Map<string, MutableAction>();
  const traces: PlanTrace[] = [];
  const unknowns = new Set<string>();
  const memoizedTargets = new Map<string, CraftPlan | Error>();
  const directRequirements = new Map<
    string,
    { label: string; quantity: number; goalIds: Set<string> }
  >();

  for (const evaluation of evaluations) {
    const goalDefinition = goals.find((goal) => goal.id === evaluation.goalId)!;
    addNode(nodes, {
      id: `goal:${evaluation.goalId}`,
      type: 'goal',
      label: evaluation.target.label,
      href: evaluation.target.href,
      goalIds: [evaluation.goalId],
      state: evaluation.status === 'completed' ? 'satisfied' : 'pending',
    });
    if (contentMode(input) === 'base_only' && goalDefinition.contentScope === 'expansion') {
      mergeBlocker(blockers, {
        id: `evidence:content-scope:${evaluation.goalId}`,
        type: 'evidence',
        subjectId: evaluation.target.id,
        label: evaluation.target.label,
        reason: 'El objetivo requiere Expansion Pass y el plan está limitado al juego base.',
        goalIds: [evaluation.goalId],
        measurementId: null,
      });
      unknowns.add(`Ruta DLC excluida: ${evaluation.target.label}`);
      continue;
    }
    const missing = new Set(evaluation.missing.map((node) => node.id));
    const unknown = new Set(evaluation.unknown.map((node) => node.id));
    const satisfied = new Set(evaluation.satisfied.map((node) => node.id));
    for (const node of evaluation.dependencyGraph.nodes) {
      if (node.id === evaluation.target.id) continue;
      const state = missing.has(node.id)
        ? 'missing'
        : unknown.has(node.id)
          ? 'unknown'
          : satisfied.has(node.id)
            ? 'satisfied'
            : 'unknown';
      addGoal(nodeGoals, node.id, evaluation.goalId);
      addNode(nodes, {
        id: node.id,
        type: planNodeType(node),
        label: node.label,
        href: node.href,
        goalIds: [evaluation.goalId],
        state,
      });
      addEdge(edges, `goal:${evaluation.goalId}`, node.id, 'requires');
      if (state === 'satisfied') continue;
      const blocker = blockerFor(node, state, evaluation.goalId);
      mergeBlocker(blockers, blocker);
      const action = actionFor(node, state, evaluation.goalId, blocker.id);
      mergeAction(actions, action);
      addNode(nodes, {
        id: action.id,
        type: action.type === 'confirmation' ? 'information_request' : 'action',
        label: action.title,
        href: action.href,
        goalIds: [evaluation.goalId],
        state: 'pending',
      });
      addEdge(edges, action.id, node.id, action.type === 'confirmation' ? 'confirms' : 'satisfies');
      traces.push({
        id: `trace:${evaluation.goalId}:${node.id}`,
        goalId: evaluation.goalId,
        requirementId: node.id,
        ruleId: ruleForNode(node, evaluation.dependencyGraph.edges),
        playerStateRef: input.state.revision,
        actionId: action.id,
        consequence: `La acción afecta al objetivo ${evaluation.target.label}.`,
        evidenceIds: evidenceIds(evaluation, node),
      });
    }
    for (const message of evaluation.unknowns) unknowns.add(message);
    if (
      evaluation.status === 'ready' ||
      (evaluation.status === 'unknown' &&
        evaluation.dependencyGraph.nodes.filter((node) => node.id !== evaluation.target.id)
          .length === 0 &&
        !evaluation.target.id.startsWith('unknown:'))
    ) {
      mergeAction(actions, targetAction(goalDefinition, evaluation));
    }
  }

  const recipeGoals = goals.filter(
    (goal) =>
      (goal.type === 'craft-item' || goal.type === 'get-item') &&
      !(contentMode(input) === 'base_only' && goal.contentScope === 'expansion'),
  );
  for (const goal of recipeGoals) {
    const key = `${goal.slug}:${goal.quantity ?? 1}:${contentMode(input)}`;
    let craft = memoizedTargets.get(key);
    if (!craft) {
      try {
        craft = calculateCraftPlan(filteredRecipes(input), goal.slug, goal.quantity ?? 1, {
          inventory: ruleInventory(input.state),
        });
      } catch (error) {
        craft = error instanceof Error ? error : new Error(String(error));
      }
      memoizedTargets.set(key, craft);
    }
    if (craft instanceof Error) {
      const cycle = craft instanceof CraftingCycleError;
      const id = `${cycle ? 'evidence' : 'gameplay'}:craft:${goal.slug}`;
      mergeBlocker(blockers, {
        id,
        type: cycle ? 'evidence' : 'gameplay',
        subjectId: `item:${goal.slug}`,
        label: goal.label,
        reason: cycle ? 'La dependencia contiene un ciclo y no puede ordenarse.' : craft.message,
        goalIds: [goal.id],
        measurementId: null,
      });
      unknowns.add(craft.message);
      continue;
    }
    for (const requirement of craft.directIngredients) {
      const current = directRequirements.get(requirement.slug) ?? {
        label: requirement.name,
        quantity: 0,
        goalIds: new Set<string>(),
      };
      current.quantity += requirement.quantity;
      current.goalIds.add(goal.id);
      directRequirements.set(requirement.slug, current);
    }
    for (const message of craft.unknownQuantities) {
      unknowns.add(message);
      const measurementId = message.includes('cantidad de salida')
        ? `recipe-output-batch:${goal.slug}`
        : `recipe-quantity:${goal.slug}`;
      const blockerId = `measurement:${measurementId}`;
      mergeBlocker(blockers, {
        id: blockerId,
        type: 'measurement',
        subjectId: `item:${goal.slug}`,
        label: goal.label,
        reason: message,
        goalIds: [goal.id],
        measurementId,
      });
      mergeAction(actions, {
        id: `measure:${measurementId}`,
        type: 'research',
        kind: 'measurement_required',
        subjectId: `item:${goal.slug}`,
        title: `Medición pendiente: ${goal.label}`,
        href: null,
        whyNow:
          'La optimización exacta depende de una medición aceptada; el plan estructural sigue disponible.',
        unlocksGoals: [goal.id],
        removesBlockers: [blockerId],
        dependsOn: [],
        certainty: 'unknown',
        evidenceIds: [],
      });
    }
    for (const alternative of craft.alternatives) {
      if (input.constraints?.avoidRecipeIds?.includes(alternative.recipeId)) continue;
      // Alternative comparison is completed below without selecting a branch greedily.
    }
  }

  const resources = allocateResources(directRequirements, input.state, input.constraints);
  for (const resource of resources) {
    if (resource.inventoryConfirmed === null) continue;
    if ((resource.missing ?? 0) <= 0) continue;
    const id = `gameplay:resource:${resource.slug}`;
    mergeBlocker(blockers, {
      id,
      type: 'gameplay',
      subjectId: `item:${resource.slug}`,
      label: resource.label,
      reason: `Faltan ${resource.missing} unidades confirmadas tras respetar la reserva.`,
      goalIds: resource.goalIds,
      measurementId: null,
    });
  }

  const alternatives = buildAlternatives(goals, evaluations, memoizedTargets, input);
  const compared = classifyPareto(alternatives);
  const sharedDependencies = [...nodeGoals.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([nodeId, ids]): SharedDependency => {
      const node = nodes.get(nodeId)!;
      return {
        nodeId,
        label: node.label,
        goalIds: sorted(ids),
        kind: sharedKind(node),
        exactReusableSurplus: null,
      };
    })
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  const finalActions = finalizeActions(actions, blockers, input);
  const actionFrontier = buildActionFrontier(
    finalActions,
    goals.length,
    input.preferences ?? [],
    input.constraints?.pinnedActionIds ?? [],
  );
  const next = selectNextAction(actionFrontier, finalActions, goals.length);
  const finalNodes = [...nodes.values()]
    .map((node) => ({ ...node, goalIds: sorted(nodeGoals.get(node.id) ?? node.goalIds) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const finalEdges = [...edges.values()].sort(edgeSort);
  const capabilities = capabilitiesFor(input, blockers, resources);
  const criticalPath = dependencyCriticalPath(evaluations, input.maximumDepth ?? MAX_DEPTH);
  const impossible =
    evaluations.some((evaluation) =>
      evaluation.unknowns.some((value) => /cycle|contradiction|impossible/i.test(value)),
    ) ||
    [...blockers.values()].some(
      (blocker) =>
        blocker.type === 'evidence' && /ciclo|cycle|contradiction|impossible/i.test(blocker.reason),
    );
  const scopeBlocked = [...blockers.values()].some((blocker) =>
    blocker.id.startsWith('evidence:content-scope:'),
  );
  const measurementBlocked = [...blockers.values()].some(
    (blocker) => blocker.type === 'measurement',
  );
  const actionIds = new Set(finalActions.map((action) => action.id));
  const unresolvedPinned = (input.constraints?.pinnedActionIds ?? []).filter(
    (id) => !actionIds.has(id),
  );
  const dependencyBlockedPins = finalActions.filter(
    (action) =>
      input.constraints?.pinnedActionIds?.includes(action.id) &&
      action.dependsOn.some((dependency) => actionIds.has(dependency)),
  );
  const anyBlocked = evaluations.some((evaluation) => evaluation.status === 'blocked');
  const completeness: PlanCompleteness =
    impossible || scopeBlocked
      ? 'blocked'
      : measurementBlocked
        ? 'structural'
        : blockers.size || unknowns.size
          ? 'partial'
          : anyBlocked
            ? 'blocked'
            : 'exact';
  const fingerprint = snapshotFingerprint({
    goals,
    state: input.state,
    constraints: input.constraints ?? {},
    preferences: input.preferences ?? [],
  });
  const pruned = compared.filter((alternative) => alternative.relation === 'dominated').length;
  return {
    id: `plan:${fingerprint}`,
    inputFingerprint: fingerprint,
    completeness,
    goals: evaluations,
    graph: { nodes: finalNodes, edges: finalEdges },
    actions: finalActions,
    actionFrontier,
    nextBestKnownAction: next.id,
    nextActionReason: next.reason,
    blockers: [...blockers.values()].sort((a, b) => a.id.localeCompare(b.id)),
    unknowns: sorted(unknowns),
    sharedDependencies,
    resources,
    alternatives: compared,
    paretoFront: compared
      .filter((alternative) => alternative.relation === 'pareto' || alternative.relation === 'only')
      .map((alternative) => alternative.id),
    capabilities,
    traces: traces.sort((a, b) => a.id.localeCompare(b.id)),
    dependencyCriticalPath: criticalPath,
    independentActionGroups: independentGroups(finalActions),
    warnings: [
      'Las comparaciones cubren únicamente dimensiones conocidas.',
      ...(capabilities.find((entry) => entry.id === 'throughputOptimization')?.state ===
      'unavailable'
        ? ['La optimización de throughput no está disponible.']
        : []),
      ...(measurementBlocked
        ? ['Los batches desconocidos impiden calcular ejecuciones y excedentes exactos.']
        : []),
      ...(unresolvedPinned.length
        ? [
            `No se priorizaron ${unresolvedPinned.length} acciones fijadas porque ya no forman parte del plan actual.`,
          ]
        : []),
      ...(dependencyBlockedPins.length
        ? [
            `${dependencyBlockedPins.length} acciones fijadas conservan prerrequisitos pendientes y no pueden adelantarse.`,
          ]
        : []),
      ...(input.state.gameVersion === null
        ? ['La versión del juego es unknown; no se afirma compatibilidad completa entre versiones.']
        : [
            'Parte del corpus conserva version scope unknown; la versión seleccionada no elimina esa incertidumbre.',
          ]),
    ],
    diagnostics: {
      nodes: finalNodes.length,
      edges: finalEdges.length,
      evaluatedGoals: evaluations.length,
      memoizedTargets: memoizedTargets.size,
      prunedAlternatives: pruned,
    },
  };
}

type MutableAction = Omit<
  PlanAction,
  | 'unlocksGoals'
  | 'removesBlockers'
  | 'dependsOn'
  | 'evidenceIds'
  | 'equivalentTo'
  | 'parallelizableWith'
> & {
  unlocksGoals: string[];
  removesBlockers: string[];
  dependsOn: string[];
  evidenceIds: string[];
};

function addGoal(map: Map<string, Set<string>>, id: string, goalId: string): void {
  const values = map.get(id) ?? new Set<string>();
  values.add(goalId);
  map.set(id, values);
}

function addNode(map: Map<string, PlanNode>, node: PlanNode): void {
  const current = map.get(node.id);
  map.set(
    node.id,
    current
      ? { ...current, goalIds: sorted(new Set([...current.goalIds, ...node.goalIds])) }
      : node,
  );
}

function addEdge(
  map: Map<string, PlanEdge>,
  from: string,
  to: string,
  type: PlanEdge['type'],
): void {
  map.set(`${from}|${type}|${to}`, { from, to, type });
}

function mergeBlocker(map: Map<string, PlanBlocker>, blocker: PlanBlocker): void {
  const current = map.get(blocker.id);
  map.set(
    blocker.id,
    current
      ? { ...current, goalIds: sorted(new Set([...current.goalIds, ...blocker.goalIds])) }
      : blocker,
  );
}

function mergeAction(map: Map<string, MutableAction>, action: MutableAction): void {
  const current = map.get(action.id);
  if (!current) {
    map.set(action.id, action);
    return;
  }
  map.set(action.id, {
    ...current,
    unlocksGoals: sorted(new Set([...current.unlocksGoals, ...action.unlocksGoals])),
    removesBlockers: sorted(new Set([...current.removesBlockers, ...action.removesBlockers])),
    dependsOn: sorted(new Set([...current.dependsOn, ...action.dependsOn])),
    evidenceIds: sorted(new Set([...current.evidenceIds, ...action.evidenceIds])),
  });
}

function planNodeType(node: GoalCatalogNode): PlanNode['type'] {
  if (node.kind === 'recipe') return 'recipe';
  if (node.kind === 'automation') return 'automation';
  if (node.kind === 'item' || node.kind === 'material') return 'item';
  if (node.kind === 'requirement') return 'requirement';
  return 'requirement';
}

function blockerFor(
  node: GoalCatalogNode,
  state: 'missing' | 'unknown',
  goalId: string,
): PlanBlocker {
  return {
    id: `${state === 'missing' ? 'gameplay' : 'state'}:${node.id}`,
    type: state === 'missing' ? 'gameplay' : 'state',
    subjectId: node.id,
    label: node.label,
    reason:
      state === 'missing'
        ? `${node.label} está confirmado como no disponible.`
        : `El estado de ${node.label} no está confirmado.`,
    goalIds: [goalId],
    measurementId: null,
  };
}

function actionFor(
  node: GoalCatalogNode,
  state: 'missing' | 'unknown',
  goalId: string,
  blockerId: string,
): MutableAction {
  const confirmation = state === 'unknown';
  const quantity = node.kind === 'item' || node.kind === 'material';
  return {
    id: `${confirmation ? 'confirm' : 'obtain'}:${node.id}`,
    type: confirmation ? 'confirmation' : 'gameplay',
    kind: confirmation
      ? quantity
        ? 'confirm_inventory_quantity'
        : 'confirm_ownership'
      : node.kind === 'automation'
        ? 'build'
        : 'obtain',
    subjectId: node.id,
    title: `${confirmation ? 'Confirma' : 'Consigue'} ${node.label}`,
    href: node.href,
    whyNow: confirmation
      ? 'Confirmar este estado evita recomendar gameplay que quizá ya esté completado.'
      : 'Es un bloqueo confirmado de al menos un objetivo.',
    unlocksGoals: [goalId],
    removesBlockers: [blockerId],
    dependsOn: [],
    certainty: confirmation ? 'unknown' : 'confirmed',
    evidenceIds: [],
  };
}

function targetAction(goal: PlannerGoal, evaluation: GoalEvaluation): MutableAction {
  const kind: PlanActionKind =
    goal.type === 'craft-item'
      ? 'craft'
      : goal.type === 'build-automation'
        ? 'build'
        : goal.type === 'complete-quest'
          ? 'complete_request'
          : goal.type === 'get-item' || goal.type === 'get-collectible'
            ? 'obtain'
            : 'unlock';
  const verb =
    kind === 'craft'
      ? 'Fabrica'
      : kind === 'build'
        ? 'Construye'
        : kind === 'complete_request'
          ? 'Completa'
          : kind === 'obtain'
            ? 'Consigue'
            : 'Desbloquea';
  return {
    id: `complete:${goal.id}`,
    type: 'gameplay',
    kind,
    subjectId: evaluation.target.id,
    title: `${verb} ${evaluation.target.label}`,
    href: evaluation.target.href,
    whyNow:
      'Todas las dependencias estructuradas están confirmadas; la ejecución sigue bajo control del jugador.',
    unlocksGoals: [goal.id],
    removesBlockers: [],
    dependsOn: [],
    certainty: 'partial',
    evidenceIds: evaluation.evidence.map((source) => source.snapshot || source.url),
  };
}

function evidenceIds(evaluation: GoalEvaluation, node: GoalCatalogNode): string[] {
  const edgeEvidence = evaluation.dependencyGraph.edges
    .filter((edge) => edge.from === node.id || edge.to === node.id)
    .flatMap((edge) => edge.evidence.map((source) => source.snapshot || source.url));
  return sorted(new Set(edgeEvidence));
}

function ruleForNode(node: GoalCatalogNode, edges: readonly GoalCatalogEdge[]): string {
  const edge = edges.find((candidate) => candidate.from === node.id || candidate.to === node.id);
  return edge ? `knowledge.${edge.predicate}` : `goal.requirement.${node.kind}`;
}

function contentMode(input: PlanGoalsInput): ContentMode {
  return input.constraints?.contentMode ?? 'all';
}

function filteredRecipes(input: PlanGoalsInput): readonly CraftRecipe[] {
  const avoided = new Set(input.constraints?.avoidRecipeIds ?? []);
  return input.recipes.filter((recipe, index) => {
    const id = recipe.id ?? `${recipe.slug}:${index}`;
    if (avoided.has(id)) return false;
    if (contentMode(input) === 'base_only') return recipe.contentScope !== 'expansion';
    return true;
  });
}

function ruleInventory(state: PlayerStateSnapshot) {
  return Object.fromEntries(
    Object.entries(state.inventory ?? {}).map(([slug, entry]) => [
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
}

function allocateResources(
  requirements: ReadonlyMap<string, { label: string; quantity: number; goalIds: Set<string> }>,
  state: PlayerStateSnapshot,
  constraints: PlanConstraint | undefined,
): ResourceAllocation[] {
  return [...requirements.entries()]
    .map(([slug, requirement]): ResourceAllocation => {
      const inventory = state.inventory?.[slug];
      const confirmed = inventory?.quantityState === 'confirmed' ? inventory.quantity : null;
      const reserve = constraints?.inventoryReserves?.[slug] ?? 0;
      const usable = confirmed === null ? null : Math.max(0, confirmed - reserve);
      const allocated = usable === null ? null : Math.min(usable, requirement.quantity);
      return {
        slug,
        label: requirement.label,
        requiredKnown: requirement.quantity,
        inventoryConfirmed: confirmed,
        reserved: reserve,
        allocated,
        missing: allocated === null ? null : requirement.quantity - allocated,
        goalIds: sorted(requirement.goalIds),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function buildAlternatives(
  goals: readonly PlannerGoal[],
  evaluations: readonly GoalEvaluation[],
  craftPlans: ReadonlyMap<string, CraftPlan | Error>,
  input: PlanGoalsInput,
): PlanAlternative[] {
  const result: PlanAlternative[] = [];
  for (const evaluation of evaluations) {
    for (const [index, alternative] of evaluation.alternatives.entries()) {
      result.push({
        id: `goal:${evaluation.goalId}:alternative:${alternative.id}`,
        label: alternative.label,
        goalIds: [evaluation.goalId],
        dimensions: [
          dimension('progression_depth', 'minimize', null, 'niveles'),
          dimension('blockers', 'minimize', null, 'bloqueos'),
          dimension('certainty', 'maximize', 0, 'evidencia'),
        ],
        unknowns: ['La relación es una alternativa estructural; faltan costes comparables.'],
        evidenceIds: [],
        relation: index === 0 && evaluation.alternatives.length === 1 ? 'only' : 'incomparable',
        reason: 'No hay dimensiones suficientes para declarar un ganador.',
      });
    }
  }
  for (const goal of goals) {
    const prefix = `${goal.slug}:${goal.quantity ?? 1}:`;
    const craft = [...craftPlans.entries()].find(([key]) => key.startsWith(prefix))?.[1];
    if (!craft || craft instanceof Error) continue;
    for (const alternative of craft.alternatives) {
      if (input.constraints?.avoidRecipeIds?.includes(alternative.recipeId)) continue;
      result.push({
        id: `recipe:${alternative.recipeId}`,
        label: alternative.name,
        goalIds: [goal.id],
        dimensions: [
          dimension(
            'confirmed_materials',
            'minimize',
            alternative.ingredientCount,
            'ingredientes directos',
          ),
          dimension('known_build_time', 'minimize', null, 'segundos'),
          dimension('certainty', 'maximize', 0, 'evidencia'),
        ],
        unknowns: ['Batch de salida y coste recursivo desconocidos.'],
        evidenceIds: [],
        relation: 'incomparable',
        reason: 'El número de ingredientes no prueba un coste material menor.',
      });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function dimension(
  id: ComparisonDimension['id'],
  direction: ComparisonDimension['direction'],
  value: number | null,
  unit: string,
): ComparisonDimension {
  return { id, direction, value, unit, known: value !== null };
}

export function compareAlternatives(
  left: PlanAlternative,
  right: PlanAlternative,
): 'left_dominates' | 'right_dominates' | 'equivalent' | 'incomparable' {
  const ids = new Set([...left.dimensions, ...right.dimensions].map((entry) => entry.id));
  let leftBetter = false;
  let rightBetter = false;
  for (const id of ids) {
    const a = left.dimensions.find((entry) => entry.id === id);
    const b = right.dimensions.find((entry) => entry.id === id);
    if (!a || !b || !a.known || !b.known || a.value === null || b.value === null)
      return 'incomparable';
    if (a.direction !== b.direction) return 'incomparable';
    if (a.value === b.value) continue;
    const aWins = a.direction === 'minimize' ? a.value < b.value : a.value > b.value;
    if (aWins) leftBetter = true;
    else rightBetter = true;
    if (leftBetter && rightBetter) return 'incomparable';
  }
  if (left.unknowns.length || right.unknowns.length) return 'incomparable';
  if (leftBetter) return 'left_dominates';
  if (rightBetter) return 'right_dominates';
  return 'equivalent';
}

function classifyPareto(alternatives: readonly PlanAlternative[]): PlanAlternative[] {
  if (alternatives.length <= 1)
    return alternatives.map((alternative) => ({ ...alternative, relation: 'only' }));
  return alternatives.map((alternative, index) => {
    const peers = alternatives.filter(
      (candidate, peerIndex) =>
        peerIndex !== index && intersects(candidate.goalIds, alternative.goalIds),
    );
    const dominated = peers.some(
      (candidate) => compareAlternatives(candidate, alternative) === 'left_dominates',
    );
    if (dominated)
      return {
        ...alternative,
        relation: 'dominated',
        reason: 'Dominada solo en dimensiones conocidas y completas.',
      };
    const comparable = peers.some(
      (candidate) => compareAlternatives(candidate, alternative) !== 'incomparable',
    );
    return {
      ...alternative,
      relation: comparable ? 'pareto' : 'incomparable',
      reason: comparable
        ? 'Permanece en el frente de alternativas no dominadas.'
        : 'No existe ganador demostrable con las dimensiones conocidas.',
    };
  });
}

function finalizeActions(
  actions: ReadonlyMap<string, MutableAction>,
  blockers: ReadonlyMap<string, PlanBlocker>,
  input: PlanGoalsInput,
): PlanAction[] {
  const values = [...actions.values()].sort((a, b) => a.id.localeCompare(b.id));
  const pinned = new Set(input.constraints?.pinnedActionIds ?? []);
  return values.map((action) => {
    const peers = values
      .filter(
        (candidate) =>
          candidate.id !== action.id &&
          candidate.unlocksGoals.length === action.unlocksGoals.length &&
          candidate.type === action.type,
      )
      .map((candidate) => candidate.id);
    const independent = values
      .filter(
        (candidate) =>
          candidate.id !== action.id &&
          !intersects(candidate.dependsOn, [action.id]) &&
          !intersects(action.dependsOn, [candidate.id]) &&
          !intersects(candidate.removesBlockers, action.removesBlockers),
      )
      .map((candidate) => candidate.id);
    return {
      ...action,
      whyNow: pinned.has(action.id)
        ? action.dependsOn.some((dependency) => actions.has(dependency))
          ? `${action.whyNow} El usuario fijó esta acción, pero sus prerrequisitos siguen pendientes.`
          : `${action.whyNow} El usuario fijó esta acción explícitamente.`
        : action.whyNow,
      unlocksGoals: sorted(new Set(action.unlocksGoals)),
      removesBlockers: sorted(
        new Set(action.removesBlockers.filter((blocker) => blockers.has(blocker))),
      ),
      dependsOn: sorted(new Set(action.dependsOn)),
      evidenceIds: sorted(new Set(action.evidenceIds)),
      equivalentTo: sorted(peers),
      parallelizableWith: sorted(independent),
    };
  });
}

function buildActionFrontier(
  actions: readonly PlanAction[],
  goalCount: number,
  preferences: readonly PlannerPreference[],
  pinnedActionIds: readonly string[],
): string[] {
  if (!actions.length) return [];
  const actionIds = new Set(actions.map((action) => action.id));
  const pinned = new Set(pinnedActionIds);
  const readyPinned = actions.filter(
    (action) =>
      pinned.has(action.id) && action.dependsOn.every((dependency) => !actionIds.has(dependency)),
  );
  const candidates = readyPinned.length ? readyPinned : actions;
  const scored = candidates.map((action) => ({
    action,
    tuple: actionTuple(action, goalCount, preferences),
  }));
  const best = scored.reduce((current, candidate) =>
    compareTuple(candidate.tuple, current.tuple) < 0 ? candidate : current,
  ).tuple;
  return scored
    .filter((candidate) => compareTuple(candidate.tuple, best) === 0)
    .map((candidate) => candidate.action.id)
    .sort();
}

function actionTuple(
  action: PlanAction,
  goalCount: number,
  preferences: readonly PlannerPreference[],
): readonly number[] {
  const requiredByAll = action.unlocksGoals.length === goalCount ? 0 : 1;
  const highImpact = action.unlocksGoals.length > 1 ? 0 : 1;
  const confirmedBlocker = action.type === 'gameplay' ? 0 : 1;
  const information = action.type === 'confirmation' ? 0 : 1;
  const multiGoal = -action.unlocksGoals.length;
  const certainty = action.certainty === 'confirmed' ? 0 : action.certainty === 'partial' ? 1 : 2;
  const preferenceTuple = preferences.map((preference) => {
    if (preference === 'prioritize_goals_unlocked') return multiGoal;
    if (preference === 'prioritize_certainty') return certainty;
    if (preference === 'minimize_actions') return action.dependsOn.length;
    return 0;
  });
  return [
    ...preferenceTuple,
    requiredByAll,
    highImpact,
    confirmedBlocker,
    information,
    multiGoal,
    certainty,
  ];
}

function compareTuple(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function selectNextAction(
  frontier: readonly string[],
  actions: readonly PlanAction[],
  goalCount: number,
): { id: string | null; reason: string } {
  if (!frontier.length) return { id: null, reason: 'No hay acciones pendientes.' };
  if (frontier.length > 1)
    return {
      id: null,
      reason: `${frontier.length} acciones son equivalentes con la política conservadora; cualquiera puede hacerse primero.`,
    };
  const action = actions.find((candidate) => candidate.id === frontier[0])!;
  return {
    id: action.id,
    reason:
      action.unlocksGoals.length === goalCount
        ? 'Es necesaria para todos los objetivos activos.'
        : action.type === 'confirmation'
          ? `Reduce incertidumbre en ${action.unlocksGoals.length} objetivo(s).`
          : `Elimina un bloqueo confirmado en ${action.unlocksGoals.length} objetivo(s).`,
  };
}

function capabilitiesFor(
  input: PlanGoalsInput,
  blockers: ReadonlyMap<string, PlanBlocker>,
  resources: readonly ResourceAllocation[],
): PlanCapability[] {
  const automationContext = input.goals.some((goal) => goal.type === 'build-automation');
  const relevantSubjects = new Set([
    ...input.goals.map((goal) => goal.slug),
    ...input.goals.flatMap(
      (goal) =>
        input.catalog.entries[`${goal.type}:${goal.slug}`]?.nodes.map((node) => node.slug) ?? [],
    ),
  ]);
  const accepted = (dimension: PlannerMetric['dimension']) =>
    (input.metrics ?? []).filter(
      (metric) =>
        metric.dimension === dimension &&
        metric.accepted &&
        (relevantSubjects.has(metric.subject) ||
          (automationContext &&
            ['power_generation', 'power_demand', 'range', 'capacity'].includes(dimension))),
    );
  const measurement = [...blockers.values()].some((blocker) => blocker.type === 'measurement');
  const exactResources =
    resources.length > 0 && resources.every((resource) => resource.missing !== null);
  return [
    {
      id: 'structuralPlanning',
      state: 'available',
      reason: 'Dependencias, estado, desbloqueos y acciones se combinan sin requerir throughput.',
    },
    {
      id: 'exactMaterialPlanning',
      state: measurement ? (exactResources ? 'partial' : 'unavailable') : 'available',
      reason: measurement
        ? 'Los batches de receta desconocidos cortan la agregación recursiva exacta.'
        : 'Las cantidades necesarias del plan están aceptadas.',
    },
    {
      id: 'timeOptimization',
      state: accepted('build_duration').length ? 'partial' : 'unavailable',
      reason: accepted('build_duration').length
        ? 'Solo algunos build durations están aceptados; no equivalen al tiempo total del objetivo.'
        : 'No hay tiempos completos aceptados.',
    },
    {
      id: 'throughputOptimization',
      state: accepted('throughput').length ? 'partial' : 'unavailable',
      reason: accepted('throughput').length
        ? 'Solo hay throughput parcial y no cubre todas las cadenas.'
        : 'Faltan ciclos y throughput productivo aceptados.',
    },
    {
      id: 'powerOptimization',
      state:
        accepted('power_generation').length && accepted('power_demand').length
          ? 'partial'
          : 'unavailable',
      reason:
        accepted('power_generation').length && accepted('power_demand').length
          ? 'Puede comprobar capacidad conocida, pero no conectividad o layout sin posiciones.'
          : 'Falta generación o demanda aceptada para el contexto seleccionado.',
    },
    {
      id: 'rangeReasoning',
      state: accepted('range').length ? 'partial' : 'unavailable',
      reason: accepted('range').length
        ? 'Se muestran límites documentados; no se afirma que el layout esté dentro de rango.'
        : 'No hay un rango aceptado aplicable.',
    },
  ];
}

function dependencyCriticalPath(
  evaluations: readonly GoalEvaluation[],
  maximumDepth: number,
): string[] {
  const limit = Math.min(Math.max(maximumDepth, 1), MAX_DEPTH);
  let longest: string[] = [];
  for (const evaluation of evaluations) {
    const adjacency = new Map<string, string[]>();
    for (const edge of evaluation.dependencyGraph.edges) {
      const current = adjacency.get(edge.from) ?? [];
      current.push(edge.to);
      adjacency.set(edge.from, current);
    }
    const visit = (id: string, path: readonly string[]): void => {
      if (path.includes(id) || path.length >= limit) return;
      const next = [...path, id];
      if (next.length > longest.length) longest = next;
      for (const child of (adjacency.get(id) ?? []).sort()) visit(child, next);
    };
    visit(evaluation.target.id, []);
  }
  return longest;
}

function independentGroups(actions: readonly PlanAction[]): readonly (readonly string[])[] {
  const unvisited = new Set(actions.map((action) => action.id));
  const groups: string[][] = [];
  while (unvisited.size) {
    const first = [...unvisited].sort()[0]!;
    const action = actions.find((candidate) => candidate.id === first)!;
    const group = [first, ...action.parallelizableWith.filter((id) => unvisited.has(id))].sort();
    for (const id of group) unvisited.delete(id);
    groups.push(group);
  }
  return groups;
}

function sharedKind(node: PlanNode): SharedDependency['kind'] {
  if (node.id.startsWith('material:')) return 'material';
  if (node.id.startsWith('item:')) return 'intermediate';
  if (node.id.startsWith('automation:')) return 'infrastructure';
  if (node.id.startsWith('unlock:')) return 'unlock';
  return 'requirement';
}

function edgeSort(left: PlanEdge, right: PlanEdge): number {
  return `${left.from}|${left.type}|${left.to}`.localeCompare(
    `${right.from}|${right.type}|${right.to}`,
  );
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  const set = new Set(left);
  return right.some((value) => set.has(value));
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function snapshotFingerprint(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

export function detectStalePlan(saved: SavedPlan, state: PlayerStateSnapshot): StalePlanResult {
  const reasons: StalePlanResult['reasons'][number][] = [];
  if (saved.createdStateRevision !== state.revision) reasons.push('player_state');
  if (saved.dataVersion !== state.dataVersion) reasons.push('data_version');
  if (saved.gameVersion !== state.gameVersion) reasons.push('game_version');
  return { stale: reasons.length > 0, reasons };
}

export function createSavedPlan(
  result: PlanResult,
  name: string,
  input: PlanGoalsInput,
  createdAt = new Date().toISOString(),
): SavedPlan {
  return {
    id: result.id,
    name: name.trim().slice(0, 120) || 'Plan sin título',
    goals: [...input.goals],
    preferences: [...(input.preferences ?? [])],
    constraints: input.constraints ?? {},
    createdStateRevision: input.state.revision,
    dataVersion: input.state.dataVersion,
    gameVersion: input.state.gameVersion,
    completedActionIds: [],
    createdAt,
  };
}

export function simulateScenario(
  input: PlanGoalsInput,
  action: SimulationAction,
): { readonly simulation: ReturnType<typeof simulateAction>; readonly plan: PlanResult } {
  if (!input.state.world) throw new Error('A world snapshot is required for what-if scenarios');
  const simulation = simulateAction(input.state.world, action, input.recipes);
  const inventory = Object.fromEntries(
    Object.entries(simulation.after.inventory).map(([slug, entry]) => [
      slug,
      {
        ownership:
          entry.ownership === 'yes'
            ? ('owned' as const)
            : entry.ownership === 'no'
              ? ('not_owned' as const)
              : ('unknown' as const),
        quantityState: entry.quantity === null ? ('unknown' as const) : ('confirmed' as const),
        quantity: entry.quantity,
      },
    ]),
  );
  const entries = { ...input.state.entries } as Record<string, GoalPlayerState['entries'][string]>;
  for (const system of simulation.after.builtSystems)
    entries[`automation:${system}`] = { state: 'confirmed', value: true };
  for (const [unlock, value] of Object.entries(simulation.after.unlocks))
    if (value !== 'unknown') entries[unlock] = { state: 'confirmed', value: value === 'yes' };
  const hypotheticalState: PlayerStateSnapshot = {
    ...input.state,
    revision: `what-if:${snapshotFingerprint(simulation.after)}`,
    entries,
    inventory,
    world: simulation.after,
  };
  return { simulation, plan: planGoals({ ...input, state: hypotheticalState }) };
}

export function compareScenarios(
  input: PlanGoalsInput,
  leftAction: SimulationAction,
  rightAction: SimulationAction,
): ScenarioComparisonResult {
  const left = scenarioSummary(leftAction, simulateScenario(input, leftAction));
  const right = scenarioSummary(rightAction, simulateScenario(input, rightAction));
  const dimensions: ScenarioComparisonResult['dimensions'] = [
    {
      id: 'completed_goals',
      direction: 'maximize',
      left: left.completedGoals,
      right: right.completedGoals,
    },
    { id: 'blockers', direction: 'minimize', left: left.blockers, right: right.blockers },
    {
      id: 'known_actions',
      direction: 'minimize',
      left: left.knownActions,
      right: right.knownActions,
    },
  ];
  if (left.criticalUnknowns.length || right.criticalUnknowns.length)
    return {
      left,
      right,
      relation: 'incomparable',
      reason:
        'Los escenarios solo pueden compararse estructuralmente: una dimensión crítica sigue unknown y podría invertir el resultado.',
      dimensions,
    };
  const comparisons = dimensions.map(({ direction, left: leftValue, right: rightValue }) =>
    direction === 'maximize' ? leftValue - rightValue : rightValue - leftValue,
  );
  const leftBetter = comparisons.some((value) => value > 0);
  const rightBetter = comparisons.some((value) => value < 0);
  const relation =
    leftBetter && !rightBetter
      ? 'left_dominates'
      : rightBetter && !leftBetter
        ? 'right_dominates'
        : leftBetter || rightBetter
          ? 'incomparable'
          : 'equivalent';
  return {
    left,
    right,
    relation,
    reason:
      relation === 'equivalent'
        ? 'Los escenarios son equivalentes en las dimensiones estructurales conocidas.'
        : relation === 'incomparable'
          ? 'Cada escenario mejora una dimensión conocida diferente; no existe ganador único.'
          : 'La dominancia se limita a completed goals, blockers y acciones estructurales conocidas.',
    dimensions,
  };
}

function scenarioSummary(
  action: SimulationAction,
  result: ReturnType<typeof simulateScenario>,
): ScenarioSummary {
  return {
    action,
    status: result.simulation.status,
    changed: result.simulation.changed,
    completeness: result.plan.completeness,
    completedGoals: result.plan.goals.filter((goal) => goal.status === 'completed').length,
    blockers: result.plan.blockers.length,
    knownActions: result.plan.actions.filter((candidate) => candidate.certainty !== 'unknown')
      .length,
    criticalUnknowns: result.plan.unknowns,
  };
}

export function traceFromEvaluation(trace: EvaluationTrace): readonly string[] {
  return [trace.ruleId, ...trace.children.flatMap(traceFromEvaluation)];
}
