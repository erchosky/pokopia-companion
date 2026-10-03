import type {
  AutomationSystem,
  GameDataRepository,
  ItemDetail,
  PokemonSummary,
  RoleSlug,
  TownDetail,
} from '@pokopia/game-data';
import type { ConfidenceLevel, KnowledgeGraph } from '@pokopia/knowledge';
import { rankPokemon, rolesForContext, type RankedPokemon } from '@pokopia/scoring';
import {
  evaluateAutomation,
  type AutomationEvaluation,
  type InventoryItemState,
  type TruthState,
} from '@pokopia/rules';

export type TownPreset =
  | 'Balanced'
  | 'Maximum Automation'
  | 'Maximum Production'
  | 'Progression'
  | 'Compact'
  | 'Endgame'
  | 'Beautiful + Functional';

export type HealthState = 'complete' | 'partial' | 'missing' | 'unknown';
export type TownHealthDimension =
  | 'Role Coverage'
  | 'Automation Coverage'
  | 'Infrastructure'
  | 'Production'
  | 'Logistics'
  | 'Progression'
  | 'Knowledge Confidence';

export interface TownHealthSignal {
  readonly dimension: TownHealthDimension;
  readonly state: HealthState;
  readonly summary: string;
  readonly evidence: string;
}

export interface TownImprovement {
  readonly title: string;
  readonly why: string;
  readonly benefit: string;
  readonly tradeoff: string;
  readonly confidence: ConfidenceLevel;
  readonly evidence: string;
}

export type ResidentCategory =
  | 'essential'
  | 'recommended'
  | 'situational'
  | 'mobile_specialist'
  | 'decoration_social'
  | 'redundant';

export interface ResidentAssessment {
  readonly pokemon: TownPokemonCandidate;
  readonly category: ResidentCategory;
  readonly coveredRoles: readonly RoleSlug[];
  readonly uniqueRoles: readonly RoleSlug[];
  readonly reason: string;
}

export interface ResidentReplacement {
  readonly replace: TownPokemonCandidate | null;
  readonly with: TownPokemonCandidate;
  readonly why: string;
  readonly benefit: string;
  readonly tradeoff: string;
  readonly confidence: ConfidenceLevel;
  readonly evidence: string;
}

export interface TownAnalysis {
  readonly town: TownDetail;
  readonly preset: TownPreset;
  readonly requiredRoles: readonly RoleSlug[];
  readonly roleReasons: Readonly<Record<string, string>>;
  readonly coveredRoles: readonly RoleSlug[];
  readonly missingRoles: readonly RoleSlug[];
  readonly duplicateRoles: readonly { role: RoleSlug; count: number }[];
  readonly health: readonly TownHealthSignal[];
  readonly residents: readonly ResidentAssessment[];
  readonly replacements: readonly ResidentReplacement[];
  readonly topImprovements: readonly TownImprovement[];
  readonly candidateMode: TownCandidateMode;
  readonly ownershipCompleteness: 'complete' | 'partial' | 'unknown';
  readonly idealRecommendations: readonly ResidentReplacement[];
  readonly ownedRecommendations: readonly ResidentReplacement[];
  readonly knownCollectionRecommendations: readonly ResidentReplacement[];
  readonly constraints: readonly TownConstraint[];
}

export type TownCandidateMode = 'ideal' | 'owned_only' | 'known_collection';
export type OwnershipState = 'owned' | 'not_owned' | 'unknown';

export interface TownConstraint {
  readonly key: 'resident_limit' | 'collection_completeness';
  readonly status: 'known' | 'unknown';
  readonly value: number | null;
  readonly explanation: string;
}

export interface TownAnalysisInput {
  readonly town: TownDetail;
  readonly pokemon: readonly TownPokemonCandidate[];
  readonly residentSlugs: readonly string[];
  readonly candidateSlugs?: readonly string[];
  readonly preset: TownPreset;
  readonly compatibleAutomation: readonly AutomationSystem[];
  readonly builtAutomationSlugs?: readonly string[];
  readonly userLevel?: number | null;
  readonly candidateMode?: TownCandidateMode;
  readonly ownership?: Readonly<Record<string, OwnershipState>>;
}

export interface TownPokemonCandidate {
  readonly slug: string;
  readonly name: string;
  readonly roles: readonly {
    readonly role: RoleSlug;
    readonly evidence: string;
  }[];
}

export interface AutomationPlan {
  readonly system: AutomationSystem;
  readonly town: AutomationTownTarget;
  readonly satisfied: readonly string[];
  readonly missing: readonly string[];
  readonly unknowns: readonly string[];
  readonly recommendedSequence: readonly string[];
  readonly alternatives: readonly string[];
  readonly canBuild: 'yes' | 'no' | 'unknown';
  readonly buildReadiness: AutomationEvaluation['build'];
  readonly operationalReadiness: AutomationEvaluation['operational'];
  readonly evaluation: AutomationEvaluation;
}

export type AutomationTownTarget = Pick<TownDetail, 'slug' | 'name'>;

export interface ComparisonAxis {
  readonly label: string;
  readonly left: string;
  readonly right: string;
  readonly confidence: ConfidenceLevel;
  readonly evidence: string;
}

export interface ItemComparison {
  readonly left: ItemDetail;
  readonly right: ItemDetail;
  readonly context: string;
  readonly axes: readonly ComparisonAxis[];
  readonly recommendation: string | null;
  readonly rationale: string;
  readonly confidence: ConfidenceLevel;
  readonly unknowns: readonly string[];
}

export interface NextAction {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly href: string;
  readonly impact: 'high' | 'medium' | 'low';
  readonly effort: 'small' | 'medium' | 'unknown';
  readonly confidence: ConfidenceLevel;
  readonly goalRelevant: boolean;
}

export const TOWN_PRESET_ROLES: Readonly<Record<TownPreset, readonly RoleSlug[]>> = {
  Balanced: ['construction', 'watering', 'resource-generation', 'storage', 'transport'],
  'Maximum Automation': [
    'automation',
    'electricity',
    'power',
    'production',
    'storage',
    'logistics',
  ],
  'Maximum Production': [
    'production',
    'resource-generation',
    'harvesting',
    'wood',
    'stone',
    'metal',
  ],
  Progression: ['construction', 'resource-generation', 'exploration', 'transport'],
  Compact: ['construction', 'watering', 'resource-generation', 'storage'],
  Endgame: ['automation', 'production', 'logistics', 'transport', 'specialist'],
  'Beautiful + Functional': ['decoration', 'construction', 'watering', 'storage'],
};

export function analyzeTown(input: TownAnalysisInput): TownAnalysis {
  const residents = input.residentSlugs
    .map((slug) => input.pokemon.find((entry) => entry.slug === slug))
    .filter((entry): entry is TownPokemonCandidate => Boolean(entry));
  const required = deriveTownRoles(input.town, input.preset);
  const roleReasons = Object.fromEntries(required.map(({ role, reason }) => [role, reason]));
  const requiredRoles = required.map(({ role }) => role);
  const roleCounts = countRoles(residents, requiredRoles);
  const coveredRoles = requiredRoles.filter((role) => (roleCounts.get(role) ?? 0) > 0);
  const missingRoles = requiredRoles.filter((role) => !coveredRoles.includes(role));
  const duplicateRoles = [...roleCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([role, count]) => ({ role, count }));
  const residentAssessments = assessResidents(residents, requiredRoles);
  const allCandidates = input.pokemon.filter((entry) => !input.residentSlugs.includes(entry.slug));
  const legacyOwned = new Set(input.candidateSlugs ?? []);
  const ownershipOf = (slug: string): OwnershipState =>
    input.ownership?.[slug] ?? (legacyOwned.has(slug) ? 'owned' : 'unknown');
  const idealRecommendations = recommendResidents(
    allCandidates,
    residents,
    residentAssessments,
    missingRoles,
  );
  const ownedRecommendations = recommendResidents(
    allCandidates.filter((entry) => ownershipOf(entry.slug) === 'owned'),
    residents,
    residentAssessments,
    missingRoles,
  );
  const knownCollectionRecommendations = recommendResidents(
    allCandidates.filter((entry) => ownershipOf(entry.slug) !== 'not_owned'),
    residents,
    residentAssessments,
    missingRoles,
  );
  const candidateMode: TownCandidateMode =
    input.candidateMode ?? (input.candidateSlugs?.length ? 'owned_only' : 'ideal');
  const replacements =
    candidateMode === 'owned_only'
      ? ownedRecommendations
      : candidateMode === 'known_collection'
        ? knownCollectionRecommendations
        : idealRecommendations;
  const ownershipValues = Object.values(input.ownership ?? {});
  const ownershipCompleteness = input.ownership
    ? ownershipValues.some((state) => state === 'unknown') ||
      ownershipValues.length < input.pokemon.length
      ? 'partial'
      : 'complete'
    : input.candidateSlugs?.length
      ? 'partial'
      : 'unknown';
  const health = townHealth(input, coveredRoles, requiredRoles, residents);
  return {
    town: input.town,
    preset: input.preset,
    requiredRoles,
    roleReasons,
    coveredRoles,
    missingRoles,
    duplicateRoles,
    health,
    residents: residentAssessments,
    replacements,
    topImprovements: topTownImprovements(input, missingRoles, replacements, health),
    candidateMode,
    ownershipCompleteness,
    idealRecommendations,
    ownedRecommendations,
    knownCollectionRecommendations,
    constraints: [
      {
        key: 'resident_limit',
        status: 'unknown',
        value: null,
        explanation: 'La fuente canónica no documenta un límite de residentes fiable.',
      },
      {
        key: 'collection_completeness',
        status: ownershipCompleteness === 'complete' ? 'known' : 'unknown',
        value: ownershipCompleteness === 'complete' ? ownershipValues.length : null,
        explanation:
          ownershipCompleteness === 'complete'
            ? 'Todos los candidatos tienen un estado explícito.'
            : 'Owned, not owned y unknown se mantienen separados; unknown no significa no poseído.',
      },
    ],
  };
}

export function rankPokemonV2(
  pokemon: readonly PokemonSummary[],
  context: string,
  currentTeam: readonly PokemonSummary[] = [],
): readonly RankedPokemon[] {
  return rankPokemon(pokemon, context, undefined, currentTeam);
}

export function planAutomation(
  system: AutomationSystem,
  town: AutomationTownTarget,
  state: {
    readonly ownedItemSlugs: readonly string[];
    readonly residentRoles: readonly RoleSlug[];
    readonly townLevel: number | null;
    readonly inventory?: Readonly<Record<string, InventoryItemState>>;
    readonly infrastructure?: Readonly<Record<string, TruthState>>;
    readonly built?: TruthState;
  },
): AutomationPlan {
  const legacyInventory = Object.fromEntries(
    state.ownedItemSlugs.map((slug) => [slug, { ownership: 'yes' as const, quantity: null }]),
  );
  const evaluation = evaluateAutomation(system, town, {
    inventory: state.inventory ?? legacyInventory,
    residentRoles: state.residentRoles,
    townLevel: state.townLevel,
    infrastructure: state.infrastructure ?? {},
    built: state.built ?? 'unknown',
  });
  const satisfied = evaluation.build.satisfied.map((entry) => entry.label);
  const missing = evaluation.build.missing.map((entry) => entry.label);
  const unknowns = unique([
    ...evaluation.build.unknown.map((entry) => entry.reason),
    ...evaluation.operational.unknown.map((entry) => entry.reason),
    ...system.limitations,
    ...(system.pokemon === null
      ? ['La fuente no establece que un Pokémon sea obligatorio; no se inventa ese requisito.']
      : []),
    evaluation.throughput.reason,
  ]);
  const requiredLevel = Number(system.unlock?.match(/Lv\.\s*(\d+)/i)?.[1]) || null;
  const recommendedSequence = [
    ...(requiredLevel ? [`Alcanza Environment Level ${requiredLevel}`] : []),
    ...missing
      .filter((entry) => !entry.includes('Environment Level'))
      .map((entry) => `Consigue ${entry}`),
    `Construye ${system.name}`,
    'Verifica inputs, output y radio mediante una prueba controlada',
  ];
  return {
    system,
    town,
    satisfied,
    missing,
    unknowns: unique(unknowns),
    recommendedSequence: unique(recommendedSequence),
    alternatives: [],
    canBuild: evaluation.build.state,
    buildReadiness: evaluation.build,
    operationalReadiness: evaluation.operational,
    evaluation,
  };
}

export function compareItems(
  repository: GameDataRepository,
  leftSlug: string,
  rightSlug: string,
  context: string,
): ItemComparison | null {
  const left = repository.getItem(leftSlug);
  const right = repository.getItem(rightSlug);
  if (!left || !right) return null;
  const value = (item: ItemDetail, field: 'unlock' | 'capacity' | 'storage' | 'craft') => {
    if (field === 'unlock') return item.recipe?.unlock ?? 'Unknown';
    if (field === 'capacity')
      return item.storage?.capacity === null || !item.storage
        ? 'Unknown'
        : String(item.storage.capacity);
    if (field === 'storage') return item.storage?.type ?? 'Unknown';
    return item.recipe
      ? item.recipe.ingredients
          .map((ingredient) => `${ingredient.name} × ${ingredient.quantity ?? '?'}`)
          .join(', ')
      : 'Unknown';
  };
  const axes: ComparisonAxis[] = [
    axis('Storage model', value(left, 'storage'), value(right, 'storage'), left, right),
    axis('Capacity', value(left, 'capacity'), value(right, 'capacity'), left, right),
    axis('Unlock', value(left, 'unlock'), value(right, 'unlock'), left, right),
    axis('Craft requirements', value(left, 'craft'), value(right, 'craft'), left, right),
  ];
  const normalized = context.toLocaleLowerCase('en');
  const leftShared = left.storage?.type === 'shared';
  const rightShared = right.storage?.type === 'shared';
  const wantsLogistics = /automation|logistics|shared|general/.test(normalized);
  const recommendation =
    wantsLogistics && leftShared !== rightShared ? (leftShared ? left.name : right.name) : null;
  return {
    left,
    right,
    context,
    axes,
    recommendation,
    rationale: recommendation
      ? `${recommendation} aporta acceso compartido confirmado por su descripción; la capacidad sigue desconocida.`
      : 'No hay evidencia suficiente para declarar una opción superior en este contexto.',
    confidence: recommendation ? 'medium' : 'unknown',
    unknowns: unique([
      ...(left.storage?.capacity === null ? [`Capacidad de ${left.name}`] : []),
      ...(right.storage?.capacity === null ? [`Capacidad de ${right.name}`] : []),
      'Throughput y coste espacial comparativo',
    ]),
  };
}

export function nextActions(input: {
  readonly goals: readonly { id: string; slug: string; label: string; type: string }[];
  readonly confirmedIds: readonly string[];
  readonly towns: readonly {
    slug: string;
    name: string;
    currentLevel: number | null;
    maxLevel: number | null;
  }[];
  readonly automation: readonly AutomationSystem[];
}): readonly NextAction[] {
  const confirmed = new Set(input.confirmedIds);
  const actions: NextAction[] = [];
  for (const goal of input.goals) {
    if (confirmed.has(goalProgressId(goal.type, goal.slug)))
      actions.push({
        id: `complete:${goal.id}`,
        title: `Completa: ${goal.label}`,
        reason: 'El estado confirmado ya satisface este objetivo.',
        href: '/my-pokopia',
        impact: 'high',
        effort: 'small',
        confidence: 'high',
        goalRelevant: true,
      });
    else
      actions.push({
        id: `continue:${goal.id}`,
        title: goal.label,
        reason: 'Es uno de tus objetivos activos y todavía no figura como completado.',
        href: goalHref(goal.type, goal.slug),
        impact: 'high',
        effort: 'unknown',
        confidence: 'medium',
        goalRelevant: true,
      });
  }
  for (const town of input.towns) {
    if (town.currentLevel !== null && town.maxLevel && town.currentLevel < town.maxLevel)
      actions.push({
        id: `town:${town.slug}:next`,
        title: `${town.name}: alcanza nivel ${town.currentLevel + 1}`,
        reason: 'Es el siguiente nivel secuencial seguro a partir de tu progreso confirmado.',
        href: `/towns/${town.slug}`,
        impact: 'medium',
        effort: 'unknown',
        confidence: 'high',
        goalRelevant: false,
      });
  }
  if (!actions.length)
    actions.push({
      id: 'insufficient-evidence',
      title: 'No hay suficiente evidencia para recomendar un siguiente paso fiable',
      reason: 'Confirma el nivel de un pueblo o añade un objetivo para activar una recomendación.',
      href: '/towns',
      impact: 'low',
      effort: 'unknown',
      confidence: 'unknown',
      goalRelevant: false,
    });
  return actions.sort(actionOrder).slice(0, 4);
}

export function graphEvidenceSummary(
  graph: KnowledgeGraph,
  kind: 'pokemon' | 'item',
  slug: string,
) {
  const entity = graph.resolve(kind, slug);
  if (!entity) return null;
  return {
    relations: graph.getRelations(entity),
    alternatives: graph.getAlternatives(entity),
    towns: graph.getRelevantTowns(entity),
    evidence: graph.getEvidence(entity),
  };
}

function deriveTownRoles(town: TownDetail, preset: TownPreset) {
  const reasons = new Map<RoleSlug, string>();
  for (const role of TOWN_PRESET_ROLES[preset]) reasons.set(role, `Requerido por preset ${preset}`);
  if (town.plantsAndBlocks.length)
    for (const role of ['watering', 'farming'] as const)
      reasons.set(role, 'La zona contiene plantas o bloques cultivables documentados');
  if (town.resources.length)
    reasons.set('resource-generation', 'La zona contiene recursos documentados');
  if (town.facilities.some((facility) => /storage|box|chest/i.test(facility)))
    reasons.set('storage', 'La infraestructura listada incluye almacenamiento');
  if (town.facilities.some((facility) => /power|generator|utility pole|switch/i.test(facility)))
    reasons.set('electricity', 'La infraestructura listada incluye componentes eléctricos');
  return [...reasons].map(([role, reason]) => ({ role, reason }));
}

function assessResidents(
  residents: readonly TownPokemonCandidate[],
  requiredRoles: readonly RoleSlug[],
): ResidentAssessment[] {
  const counts = countRoles(residents, requiredRoles);
  return residents.map((pokemon) => {
    const coveredRoles = pokemon.roles
      .map((assignment) => assignment.role)
      .filter((role) => requiredRoles.includes(role));
    const uniqueRoles = coveredRoles.filter((role) => counts.get(role) === 1);
    const allRoles = pokemon.roles.map((assignment) => assignment.role);
    const category: ResidentCategory = uniqueRoles.length
      ? 'essential'
      : coveredRoles.length && coveredRoles.every((role) => (counts.get(role) ?? 0) > 1)
        ? 'redundant'
        : allRoles.some((role) => role === 'transport' || role === 'exploration')
          ? 'mobile_specialist'
          : allRoles.every((role) => role === 'decoration' || role === 'specialist')
            ? 'decoration_social'
            : coveredRoles.length
              ? 'recommended'
              : 'situational';
    return {
      pokemon,
      category,
      coveredRoles,
      uniqueRoles,
      reason: uniqueRoles.length
        ? `Es el único residente que cubre ${uniqueRoles.join(', ')}.`
        : coveredRoles.length
          ? `Cubre ${coveredRoles.join(', ')}, pero esos roles se solapan.`
          : 'No cubre un rol requerido por el preset actual.',
    };
  });
}

function recommendResidents(
  candidates: readonly TownPokemonCandidate[],
  residents: readonly TownPokemonCandidate[],
  assessments: readonly ResidentAssessment[],
  missingRoles: readonly RoleSlug[],
): ResidentReplacement[] {
  if (!missingRoles.length) return [];
  const redundant = assessments.filter((assessment) => assessment.category === 'redundant');
  return candidates
    .map((candidate) => {
      const gains = unique(
        candidate.roles
          .map((assignment) => assignment.role)
          .filter((role) => missingRoles.includes(role)),
      );
      return { candidate, gains };
    })
    .filter(({ gains }) => gains.length)
    .sort(
      (left, right) =>
        right.gains.length - left.gains.length ||
        left.candidate.name.localeCompare(right.candidate.name),
    )
    .slice(0, 3)
    .map(({ candidate, gains }, index) => {
      const replace = redundant[index]?.pokemon ?? redundant[0]?.pokemon ?? null;
      return {
        replace,
        with: candidate,
        why: replace
          ? `${replace.name} no aporta cobertura única y ${candidate.name} cubre ${gains.join(', ')}.`
          : `${candidate.name} cubre roles que faltan: ${gains.join(', ')}.`,
        benefit: `+${gains.length} rol${gains.length === 1 ? '' : 'es'} sin cubrir.`,
        tradeoff: replace
          ? `Se pierden las specialties de ${replace.name}; revisa su utilidad situacional.`
          : 'Añadir un residente puede consumir espacio; el límite de residentes no está modelado.',
        confidence: 'medium' as const,
        evidence: candidate.roles
          .filter((assignment) => gains.includes(assignment.role))
          .map((assignment) => assignment.evidence)
          .join(' · '),
      };
    });
}

function townHealth(
  input: TownAnalysisInput,
  coveredRoles: readonly RoleSlug[],
  requiredRoles: readonly RoleSlug[],
  residents: readonly TownPokemonCandidate[],
): TownHealthSignal[] {
  const built = new Set(input.builtAutomationSlugs ?? []);
  const roleState = requiredRoles.length
    ? coveredRoles.length === requiredRoles.length
      ? 'complete'
      : coveredRoles.length
        ? 'partial'
        : residents.length
          ? 'missing'
          : 'unknown'
    : 'unknown';
  const compatible = input.compatibleAutomation;
  const builtCompatible = compatible.filter((system) => built.has(system.slug));
  return [
    {
      dimension: 'Role Coverage',
      state: roleState,
      summary: `${coveredRoles.length} de ${requiredRoles.length} roles requeridos cubiertos`,
      evidence: 'Roles derivados de specialties y residentes confirmados por el usuario.',
    },
    {
      dimension: 'Automation Coverage',
      state: compatible.length ? (builtCompatible.length ? 'partial' : 'missing') : 'unknown',
      summary: compatible.length
        ? `${compatible.length} oportunidades con compatibilidad derivada; ${builtCompatible.length} marcadas Built`
        : 'No hay compatibilidad documentada suficiente',
      evidence: 'Compatibilidad derivada únicamente de unlock o localización de la ficha.',
    },
    {
      dimension: 'Infrastructure',
      state: input.town.facilities.length ? 'partial' : 'unknown',
      summary: input.town.facilities.length
        ? `${input.town.facilities.length} elementos de infraestructura listados`
        : 'Sin inventario de infraestructura en la fuente',
      evidence: 'La fuente lista elementos, pero no un denominador de infraestructura óptima.',
    },
    dimensionFromRoles(
      'Production',
      ['production', 'resource-generation', 'harvesting'],
      residents,
    ),
    dimensionFromRoles('Logistics', ['storage', 'logistics', 'transport'], residents),
    {
      dimension: 'Progression',
      state:
        input.userLevel === null || input.userLevel === undefined
          ? 'unknown'
          : input.town.maxEnvironmentLevel && input.userLevel >= input.town.maxEnvironmentLevel
            ? 'complete'
            : input.userLevel > 0
              ? 'partial'
              : 'missing',
      summary:
        input.userLevel === null || input.userLevel === undefined
          ? 'Nivel del usuario sin confirmar'
          : `Environment Level ${input.userLevel} de ${input.town.maxEnvironmentLevel ?? 'unknown'}`,
      evidence: 'El nivel actual sólo procede de My Pokopia.',
    },
    {
      dimension: 'Knowledge Confidence',
      state: 'partial',
      summary: 'Tablas estructuradas disponibles; gameplay comparativo sin verificar',
      evidence: `${input.town.source.snapshot} · ${input.town.source.verificationStatus}`,
    },
  ];
}

function dimensionFromRoles(
  dimension: Extract<TownHealthDimension, 'Production' | 'Logistics'>,
  roles: readonly RoleSlug[],
  residents: readonly TownPokemonCandidate[],
): TownHealthSignal {
  const covered = unique(
    residents
      .flatMap((pokemon) => pokemon.roles.map((assignment) => assignment.role))
      .filter((role) => roles.includes(role)),
  );
  return {
    dimension,
    state: residents.length ? (covered.length ? 'partial' : 'missing') : 'unknown',
    summary: covered.length ? `Roles presentes: ${covered.join(', ')}` : 'Sin roles confirmados',
    evidence:
      'No existe denominador de rendimiento; el estado nunca se eleva a complete automáticamente.',
  };
}

function topTownImprovements(
  input: TownAnalysisInput,
  missingRoles: readonly RoleSlug[],
  replacements: readonly ResidentReplacement[],
  health: readonly TownHealthSignal[],
): TownImprovement[] {
  const improvements: TownImprovement[] = replacements.map((replacement) => ({
    title: replacement.replace
      ? `Valora sustituir ${replacement.replace.name} por ${replacement.with.name}`
      : `Añade ${replacement.with.name}`,
    why: replacement.why,
    benefit: replacement.benefit,
    tradeoff: replacement.tradeoff,
    confidence: replacement.confidence,
    evidence: replacement.evidence,
  }));
  if (missingRoles.length && !replacements.length)
    improvements.push({
      title: `Busca cobertura para ${missingRoles[0]}`,
      why: 'El rol está requerido por el preset y no aparece en los residentes confirmados.',
      benefit: 'Cierra un gap de composición.',
      tradeoff: 'No hay un candidato con evidencia suficiente en el pool disponible.',
      confidence: 'medium',
      evidence: `Preset ${input.preset}`,
    });
  if (health.find((entry) => entry.dimension === 'Progression')?.state === 'unknown')
    improvements.push({
      title: 'Confirma tu Environment Level',
      why: 'Sin nivel no se pueden ordenar desbloqueos ni dependencias.',
      benefit: 'Activa siguientes pasos fiables.',
      tradeoff: 'Requiere una única entrada manual.',
      confidence: 'high',
      evidence: 'My Pokopia no contiene un nivel confirmado para esta zona.',
    });
  return improvements.slice(0, 3);
}

function countRoles(
  pokemon: readonly TownPokemonCandidate[],
  accepted: readonly RoleSlug[],
): Map<RoleSlug, number> {
  const counts = new Map<RoleSlug, number>();
  for (const entry of pokemon)
    for (const role of unique(entry.roles.map((assignment) => assignment.role)))
      if (accepted.includes(role)) counts.set(role, (counts.get(role) ?? 0) + 1);
  return counts;
}

function axis(
  label: string,
  left: string,
  right: string,
  leftItem: ItemDetail,
  rightItem: ItemDetail,
): ComparisonAxis {
  const known = left !== 'Unknown' && right !== 'Unknown';
  return {
    label,
    left,
    right,
    confidence: known ? 'medium' : 'unknown',
    evidence: known
      ? `${leftItem.source.url} · ${rightItem.source.url}`
      : 'Al menos una ficha no proporciona este valor.',
  };
}

function actionOrder(left: NextAction, right: NextAction): number {
  const impact = { high: 3, medium: 2, low: 1 } as const;
  const effort = { small: 2, medium: 1, unknown: 0 } as const;
  return (
    Number(right.goalRelevant) - Number(left.goalRelevant) ||
    impact[right.impact] - impact[left.impact] ||
    effort[right.effort] - effort[left.effort] ||
    left.title.localeCompare(right.title)
  );
}

function goalHref(type: string, slug: string): string {
  if (type === 'acquire-pokemon') return `/pokemon/${slug}`;
  if (type === 'reach-town-level') return `/towns/${slug}`;
  if (type === 'build-automation') return `/automation#${slug}`;
  if (type === 'craft-item') return `/recipes/${slug}`;
  if (type === 'complete-quest') return `/requests/${slug}`;
  if (type === 'complete-treasure-map') return `/treasure-maps/${slug}`;
  if (type === 'get-collectible') return `/collectibles/${slug}`;
  if (type === 'learn-ditto-move') return `/ditto-moves/${slug}`;
  return `/items/${slug}`;
}

function goalProgressId(type: string, slug: string): string {
  if (type === 'acquire-pokemon') return `pokemon:${slug}`;
  if (type === 'reach-town-level') return `town:${slug}:level`;
  if (type === 'build-automation') return `automation:${slug}`;
  if (type === 'complete-quest') return `quest:${slug}`;
  if (type === 'complete-treasure-map') return `treasure_map:${slug}`;
  if (type === 'get-collectible') return `collectible:${slug}`;
  if (type === 'learn-ditto-move') return `ditto_move:${slug}`;
  return `item:${slug}`;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function requestedRoles(context: string): readonly RoleSlug[] {
  return rolesForContext(context);
}
