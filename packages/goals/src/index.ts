import type { GameDataRepository, SourceEvidence } from '@pokopia/game-data';
import type {
  GraphEntityKind,
  GraphEntityRef,
  KnowledgeGraph,
  RelationshipPredicate,
} from '@pokopia/knowledge';

export type GoalType =
  | 'get-item'
  | 'craft-item'
  | 'reach-town-level'
  | 'build-automation'
  | 'acquire-pokemon'
  | 'complete-quest'
  | 'complete-treasure-map'
  | 'get-collectible'
  | 'learn-ditto-move';

export interface GoalDefinition {
  readonly id: string;
  readonly type: GoalType;
  readonly slug: string;
  readonly label: string;
  readonly targetLevel?: number | null;
}

export interface GoalCatalogNode {
  readonly id: string;
  readonly kind: GraphEntityKind;
  readonly slug: string;
  readonly label: string;
  readonly href: string;
  readonly requiredLevel: number | null;
}

export interface GoalCatalogEdge {
  readonly from: string;
  readonly to: string;
  readonly predicate: RelationshipPredicate;
  readonly direction: 'forward' | 'reverse_product_lookup';
  readonly evidence: readonly SourceEvidence[];
}

export interface GoalCatalogEntry {
  readonly target: GoalCatalogNode;
  readonly nodes: readonly GoalCatalogNode[];
  readonly edges: readonly GoalCatalogEdge[];
  readonly alternatives: readonly GoalCatalogNode[];
  readonly evidence: readonly SourceEvidence[];
  readonly unknowns: readonly string[];
}

export interface GoalCatalog {
  readonly entries: Readonly<Record<string, GoalCatalogEntry>>;
}

export interface GoalProgressEntry {
  readonly state: 'confirmed' | 'inferred';
  readonly value: boolean | number | string;
}

export interface GoalPlayerState {
  readonly entries: Readonly<Record<string, GoalProgressEntry>>;
  readonly inventory?: Readonly<
    Record<
      string,
      {
        readonly ownership: 'owned' | 'not_owned' | 'unknown';
        readonly quantityState: 'confirmed' | 'unknown';
        readonly quantity: number | null;
      }
    >
  >;
}

export interface GoalEvaluation {
  readonly goalId: string;
  readonly target: GoalCatalogNode;
  readonly status: 'completed' | 'ready' | 'in_progress' | 'blocked' | 'unknown';
  readonly satisfied: readonly GoalCatalogNode[];
  readonly missing: readonly GoalCatalogNode[];
  readonly unknown: readonly GoalCatalogNode[];
  readonly blockers: readonly string[];
  readonly dependencyGraph: {
    readonly nodes: readonly GoalCatalogNode[];
    readonly edges: readonly GoalCatalogEdge[];
  };
  readonly nextStep: {
    readonly title: string;
    readonly href: string;
    readonly reason: string;
  } | null;
  readonly alternatives: readonly GoalCatalogNode[];
  readonly evidence: readonly SourceEvidence[];
  readonly confidence: 'high' | 'medium' | 'low' | 'unknown';
  readonly confidenceReasons: readonly string[];
  readonly unknowns: readonly string[];
}

export function createGoalCatalog(
  repository: GameDataRepository,
  graph: KnowledgeGraph,
  targets?: readonly Pick<GoalDefinition, 'type' | 'slug'>[],
): GoalCatalog {
  const entries: Record<string, GoalCatalogEntry> = {};
  const requested = targets
    ? new Set(targets.map((target) => `${target.type}:${target.slug}`))
    : null;
  const addGraphEntry = (
    kind:
      'item' | 'automation' | 'pokemon' | 'quest' | 'treasure_map' | 'collectible' | 'ditto_move',
    slug: string,
    goalTypes: readonly GoalType[],
  ) => {
    const root = graph.resolve(kind, slug);
    if (!root) return;
    const traversal = graph.getDependencies(root, 16);
    const relationships = traversal.relationships;
    const nodes = traversal.nodes.map(catalogNode);
    const edges = relationships.map((relationship): GoalCatalogEdge => ({
      from: entityId(relationship.from),
      to: entityId(relationship.to),
      predicate: relationship.predicate,
      direction:
        relationship.predicate === 'recipe_produces_item' ? 'reverse_product_lookup' : 'forward',
      evidence: uniqueSources(relationship.evidence.map((entry) => entry.source)),
    }));
    const sourceEvidence = uniqueSources(
      relationships.flatMap((relationship) => relationship.evidence.map((entry) => entry.source)),
    );
    const alternatives = graph.getAlternatives(root).map((relation) => catalogNode(relation.to));
    const entry: GoalCatalogEntry = {
      target: catalogNode(root),
      nodes,
      edges,
      alternatives,
      evidence: sourceEvidence,
      unknowns: [
        ...(traversal.cycles.length ? [`Dependency cycles: ${traversal.cycles.join('; ')}`] : []),
        ...(traversal.truncated
          ? ['La cadena de dependencias superó el límite seguro de recorrido.']
          : []),
        ...(sourceEvidence.some((source) => source.verificationStatus !== 'confirmed')
          ? ['La evidencia de la fuente sigue sin verificación de gameplay.']
          : []),
      ],
    };
    for (const type of goalTypes)
      if (!requested || requested.has(`${type}:${slug}`)) entries[`${type}:${slug}`] = entry;
  };

  for (const item of repository.listItems(10_000))
    if (
      !requested ||
      requested.has(`get-item:${item.slug}`) ||
      requested.has(`craft-item:${item.slug}`)
    )
      addGraphEntry('item', item.slug, ['get-item', 'craft-item']);
  for (const system of repository.listAutomationSystems())
    if (!requested || requested.has(`build-automation:${system.slug}`))
      addGraphEntry('automation', system.slug, ['build-automation']);
  for (const pokemon of repository.listPokemon(10_000))
    if (!requested || requested.has(`acquire-pokemon:${pokemon.slug}`))
      addGraphEntry('pokemon', pokemon.slug, ['acquire-pokemon']);
  for (const town of repository.listTowns()) {
    if (requested && !requested.has(`reach-town-level:${town.slug}`)) continue;
    const node = graph.resolve('town', town.slug);
    if (!node) continue;
    entries[`reach-town-level:${town.slug}`] = {
      target: catalogNode(node),
      nodes: [catalogNode(node)],
      edges: [],
      alternatives: [],
      evidence: [town.source],
      unknowns: [],
    };
  }
  for (const quest of repository.listQuests())
    if (!requested || requested.has(`complete-quest:${quest.slug}`))
      addGraphEntry('quest', quest.slug, ['complete-quest']);
  for (const map of repository.listTreasureMaps())
    if (!requested || requested.has(`complete-treasure-map:${map.slug}`))
      addGraphEntry('treasure_map', map.slug, ['complete-treasure-map']);
  for (const collectible of repository.listCollectibles())
    if (!requested || requested.has(`get-collectible:${collectible.slug}`))
      addGraphEntry('collectible', collectible.slug, ['get-collectible']);
  for (const move of repository.listDittoMoves())
    if (!requested || requested.has(`learn-ditto-move:${move.slug}`))
      addGraphEntry('ditto_move', move.slug, ['learn-ditto-move']);
  return { entries };
}

export function evaluateGoal(
  goal: GoalDefinition,
  catalog: GoalCatalog,
  state: GoalPlayerState,
): GoalEvaluation {
  const entry = catalog.entries[`${goal.type}:${goal.slug}`];
  if (!entry) return unknownGoal(goal);
  const targetStateId = progressId(goal.type, goal.slug);
  const targetState = state.entries[targetStateId];
  const targetSatisfied =
    goal.type === 'reach-town-level'
      ? townLevelSatisfied(goal, targetState)
      : targetState?.state === 'confirmed' && targetState.value === true;
  const dependencies = entry.nodes.filter((node) => node.id !== entry.target.id);
  const classified = dependencies.map((node) => ({ node, state: classifyNode(node, state) }));
  const satisfied = classified
    .filter((value) => value.state === 'satisfied')
    .map((value) => value.node);
  const missing = classified
    .filter((value) => value.state === 'missing')
    .map((value) => value.node);
  const unknown = classified
    .filter((value) => value.state === 'unknown')
    .map((value) => value.node);
  const blockers = missing.map((node) => `${node.label} está confirmado como no disponible.`);
  const status: GoalEvaluation['status'] = targetSatisfied
    ? 'completed'
    : blockers.length
      ? 'blocked'
      : dependencies.length > 0 && unknown.length === 0
        ? 'ready'
        : satisfied.length > 0
          ? 'in_progress'
          : 'unknown';
  const next = missing[0] ?? leafUnknown(unknown, entry.edges) ?? unknown[0] ?? null;
  const confidenceReasons = [
    `${satisfied.length}/${dependencies.length} dependencias confirmadas.`,
    entry.evidence.length
      ? `${entry.evidence.length} documento(s) con procedencia.`
      : 'Sin evidencia enlazada al objetivo.',
    ...(unknown.length ? [`${unknown.length} estados del usuario siguen unknown.`] : []),
  ];
  const evidenceConfirmed = entry.evidence.filter(
    (source) => source.verificationStatus === 'confirmed',
  ).length;
  const confidence: GoalEvaluation['confidence'] = !entry.evidence.length
    ? 'unknown'
    : evidenceConfirmed === entry.evidence.length && unknown.length === 0
      ? 'high'
      : unknown.length <= Math.max(1, Math.floor(dependencies.length / 3))
        ? 'medium'
        : 'low';
  return {
    goalId: goal.id,
    target: entry.target,
    status,
    satisfied,
    missing,
    unknown,
    blockers,
    dependencyGraph: { nodes: entry.nodes, edges: entry.edges },
    nextStep: targetSatisfied
      ? null
      : confidence === 'unknown' ||
          entry.unknowns.some((value) => /cycles|límite seguro/i.test(value))
        ? null
        : next
          ? {
              title: `${missing.includes(next) ? 'Consigue' : 'Confirma'} ${next.label}`,
              href: next.href,
              reason: missing.includes(next)
                ? 'Es un bloqueo explícito de la cadena de dependencias.'
                : 'Es la primera dependencia hoja cuyo estado aún no conoces.',
            }
          : {
              title: `Revisa ${entry.target.label}`,
              href: entry.target.href,
              reason: 'No hay un requisito estructurado adicional que pueda ordenarse.',
            },
    alternatives: entry.alternatives,
    evidence: entry.evidence,
    confidence,
    confidenceReasons,
    unknowns: [
      ...new Set([
        ...entry.unknowns,
        ...unknown.map((node) => `Estado unknown: ${node.label}`),
        ...(confidence === 'unknown'
          ? ['No hay suficiente evidencia para recomendar un siguiente paso fiable.']
          : []),
      ]),
    ],
  };
}

export function evaluateGoals(
  goals: readonly GoalDefinition[],
  catalog: GoalCatalog,
  state: GoalPlayerState,
): readonly GoalEvaluation[] {
  return goals.map((goal) => evaluateGoal(goal, catalog, state));
}

function classifyNode(
  node: GoalCatalogNode,
  state: GoalPlayerState,
): 'satisfied' | 'missing' | 'unknown' {
  if (node.kind === 'requirement' && node.requiredLevel !== null) {
    const level = state.entries[`town:${townSlugFromRequirement(node.slug)}:level`]?.value;
    if (typeof level !== 'number') return 'unknown';
    return level >= node.requiredLevel ? 'satisfied' : 'missing';
  }
  const id = node.kind === 'material' ? `item:${node.slug}` : `${node.kind}:${node.slug}`;
  if (node.kind === 'material' || node.kind === 'item') {
    const inventory = state.inventory?.[node.slug];
    if (inventory) {
      if (inventory.ownership === 'not_owned') return 'missing';
      if (inventory.ownership === 'unknown' || inventory.quantityState === 'unknown')
        return 'unknown';
      return (inventory.quantity ?? 0) > 0 ? 'satisfied' : 'missing';
    }
  }
  const value = state.entries[id];
  if (!value || value.state !== 'confirmed') return 'unknown';
  return value.value === true ? 'satisfied' : 'missing';
}

function townLevelSatisfied(goal: GoalDefinition, state: GoalProgressEntry | undefined): boolean {
  const required =
    goal.targetLevel ?? (Number(goal.label.match(/(?:level|nivel)\s*(\d+)/i)?.[1]) || null);
  const current = typeof state?.value === 'number' ? state.value : Number(state?.value);
  return required !== null && Number.isFinite(current) && current >= required;
}

function progressId(type: GoalType, slug: string): string {
  if (type === 'acquire-pokemon') return `pokemon:${slug}`;
  if (type === 'reach-town-level') return `town:${slug}:level`;
  if (type === 'build-automation') return `automation:${slug}`;
  if (type === 'complete-quest') return `quest:${slug}`;
  if (type === 'complete-treasure-map') return `treasure_map:${slug}`;
  if (type === 'get-collectible') return `collectible:${slug}`;
  if (type === 'learn-ditto-move') return `ditto_move:${slug}`;
  return `item:${slug}`;
}

function catalogNode(node: GraphEntityRef): GoalCatalogNode {
  const requiredLevel =
    node.kind === 'requirement'
      ? Number(node.name.match(/(?:level|lv\.)\s*(\d+)/i)?.[1]) || null
      : null;
  return {
    id: entityId(node),
    kind: node.kind,
    slug: node.slug,
    label: node.name,
    href: hrefFor(node.kind, node.slug),
    requiredLevel,
  };
}

function entityId(node: Pick<GraphEntityRef, 'kind' | 'slug'>): string {
  return `${node.kind}:${node.slug}`;
}

function hrefFor(kind: GraphEntityKind, slug: string): string {
  if (kind === 'pokemon') return `/pokemon/${slug}`;
  if (kind === 'recipe') return `/recipes/${slug}`;
  if (kind === 'town' || kind === 'requirement') return `/towns/${townSlugFromRequirement(slug)}`;
  if (kind === 'automation') return `/automation#${slug}`;
  if (kind === 'quest') return `/requests/${slug}`;
  if (kind === 'treasure_map') return `/treasure-maps/${slug}`;
  if (kind === 'collectible') return `/collectibles/${slug}`;
  if (kind === 'ditto_move') return `/ditto-moves/${slug}`;
  if (kind === 'specialty') return `/buscar?q=${encodeURIComponent(`${slug} specialty`)}`;
  return `/items/${slug}`;
}

function townSlugFromRequirement(slug: string): string {
  return slug.replace(/-level-\d+$/, '');
}

function leafUnknown(
  unknown: readonly GoalCatalogNode[],
  edges: readonly GoalCatalogEdge[],
): GoalCatalogNode | null {
  return (
    unknown.find(
      (node) =>
        !edges.some((edge) => edge.from === node.id && edge.predicate !== 'recipe_produces_item'),
    ) ?? null
  );
}

function uniqueSources(values: readonly SourceEvidence[]): SourceEvidence[] {
  return [...new Map(values.map((value) => [`${value.url}:${value.snapshot}`, value])).values()];
}

function unknownGoal(goal: GoalDefinition): GoalEvaluation {
  const kind: GraphEntityKind =
    goal.type === 'acquire-pokemon'
      ? 'pokemon'
      : goal.type === 'complete-quest'
        ? 'quest'
        : goal.type === 'complete-treasure-map'
          ? 'treasure_map'
          : goal.type === 'get-collectible'
            ? 'collectible'
            : goal.type === 'learn-ditto-move'
              ? 'ditto_move'
              : 'item';
  const target: GoalCatalogNode = {
    id: `unknown:${goal.slug}`,
    kind,
    slug: goal.slug,
    label: goal.label,
    href: hrefFor(kind, goal.slug),
    requiredLevel: goal.targetLevel ?? null,
  };
  return {
    goalId: goal.id,
    target,
    status: 'unknown',
    satisfied: [],
    missing: [],
    unknown: [target],
    blockers: [],
    dependencyGraph: { nodes: [target], edges: [] },
    nextStep: null,
    alternatives: [],
    evidence: [],
    confidence: 'unknown',
    confidenceReasons: ['No existe una entidad canónica resoluble para este objetivo.'],
    unknowns: [
      'Objetivo no catalogado.',
      'No hay suficiente evidencia para recomendar un siguiente paso fiable.',
    ],
  };
}
