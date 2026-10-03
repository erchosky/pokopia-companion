export type KnowledgeState = 'user_confirmed' | 'inferred' | 'unknown';
export type TruthState = 'yes' | 'no' | 'unknown';
export type ContentScope = 'base_game' | 'expansion' | 'unknown';
export type RuleFamily =
  | 'requirement'
  | 'transformation'
  | 'availability'
  | 'compatibility'
  | 'progression'
  | 'measurement';

export interface RuleEvidenceRef {
  readonly url: string;
  readonly snapshot: string;
  readonly verificationStatus: 'unverified' | 'confirmed' | 'unknown';
}

export interface GameRule {
  readonly id: string;
  readonly version: number;
  readonly family: RuleFamily;
  readonly subject: { readonly kind: string; readonly slug: string };
  readonly predicates: readonly RulePredicate[];
  readonly effects: readonly RuleEffect[];
  readonly provenance: {
    readonly derivation: 'source_fact' | 'accepted_measurement' | 'engine_rule';
    readonly evidence: readonly RuleEvidenceRef[];
  };
  readonly confidence: 'high' | 'medium' | 'low' | 'unknown';
  readonly contentScope: ContentScope;
  readonly gameVersion: string | null;
  readonly enabled: boolean;
  readonly deprecated: boolean;
}

export interface RulePredicate {
  readonly kind:
    | 'item_quantity'
    | 'item_ownership'
    | 'town_level'
    | 'unlock'
    | 'infrastructure'
    | 'pokemon_role'
    | 'town_compatibility';
  readonly subject: string;
  readonly quantity?: number | null;
  readonly value?: string | number | null;
}

export interface RuleEffect {
  readonly kind: 'produces' | 'unlocks' | 'enables' | 'satisfies' | 'transforms';
  readonly subject: string;
  readonly quantity?: number | null;
}

export interface EvaluationTrace {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly label: string;
  readonly result: TruthState;
  readonly reason: string;
  readonly inputs: Readonly<Record<string, string | number | boolean | null>>;
  readonly evidence: readonly RuleEvidenceRef[];
  readonly children: readonly EvaluationTrace[];
}

export interface RequirementNode {
  readonly id: string;
  readonly label: string;
  readonly dependencies: readonly string[];
}

export interface RequirementResult {
  readonly id: string;
  readonly label: string;
  readonly state: KnowledgeState;
  readonly missing: readonly string[];
}

export function evaluateRequirements(
  nodes: readonly RequirementNode[],
  states: Readonly<Record<string, KnowledgeState>>,
): readonly RequirementResult[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    state: states[node.id] ?? 'unknown',
    missing: node.dependencies.filter(
      (id) => (states[id] ?? 'unknown') === 'unknown' || !byId.has(id),
    ),
  }));
}

export function topologicalOrder(nodes: readonly RequirementNode[]): readonly string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: string[] = [];
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Dependency cycle detected at ${id}`);
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? [])
      if (byId.has(dependency)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    ordered.push(id);
  };
  for (const node of nodes) visit(node.id);
  return ordered;
}

export interface CraftIngredient {
  readonly name: string;
  readonly slug: string;
  readonly quantity: number | null;
}

export interface CraftRecipe {
  readonly id?: string;
  readonly slug: string;
  readonly name: string;
  readonly outputQuantity: number | null;
  readonly outputQuantityStatus?:
    'source_backed' | 'accepted_measurement' | 'derived_default' | 'unknown';
  readonly ingredients: readonly CraftIngredient[];
  readonly contentScope?: ContentScope;
  readonly gameVersion?: string | null;
  readonly source?: RuleEvidenceRef;
}

export interface InventoryItemState {
  readonly ownership: TruthState;
  readonly quantity: number | null;
}

export interface CraftTotal {
  readonly name: string;
  readonly slug: string;
  readonly quantity: number;
}

export interface CraftRequirementEvaluation {
  readonly name: string;
  readonly slug: string;
  readonly required: number | null;
  readonly available: number | null;
  readonly used: number;
  readonly missing: number | null;
  readonly state: TruthState;
  readonly kind: 'base' | 'intermediate';
}

export interface CraftAlternative {
  readonly recipeId: string;
  readonly name: string;
  readonly ingredientCount: number;
  readonly contentScope: ContentScope;
}

export interface CraftPlan {
  readonly targetSlug: string;
  readonly requestedCopies: number;
  readonly status: 'ready' | 'blocked' | 'unknown' | 'choice_required';
  readonly crafts: number | null;
  readonly directIngredients: readonly CraftTotal[];
  readonly baseMaterials: readonly CraftTotal[];
  readonly craftedDependencies: readonly CraftTotal[];
  readonly surplus: readonly CraftTotal[];
  readonly requirements: readonly CraftRequirementEvaluation[];
  readonly unknownQuantities: readonly string[];
  readonly unknownInventory: readonly string[];
  readonly alternatives: readonly CraftAlternative[];
  readonly trace: EvaluationTrace;
}

export interface CraftPlanOptions {
  readonly inventory?: Readonly<Record<string, InventoryItemState>>;
  readonly recipeSelections?: Readonly<Record<string, string>>;
}

export class CraftingCycleError extends Error {
  constructor(readonly cycle: readonly string[]) {
    super(`Crafting cycle detected: ${cycle.join(' -> ')}`);
    this.name = 'CraftingCycleError';
  }
}

const MAX_CRAFT_QUANTITY = 1_000_000_000;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_CRAFT_QUANTITY)
    throw new Error(
      `${name} must be a safe positive integer no greater than ${MAX_CRAFT_QUANTITY}`,
    );
}

function isKnownOutput(recipe: CraftRecipe): boolean {
  return (
    recipe.outputQuantity !== null &&
    Number.isSafeInteger(recipe.outputQuantity) &&
    recipe.outputQuantity > 0 &&
    recipe.outputQuantityStatus !== 'derived_default' &&
    recipe.outputQuantityStatus !== 'unknown'
  );
}

export function calculateCraftPlan(
  recipes: readonly CraftRecipe[],
  targetSlug: string,
  requestedCopies: number,
  options: CraftPlanOptions = {},
): CraftPlan {
  assertPositiveInteger(requestedCopies, 'requestedCopies');
  const byOutput = new Map<string, CraftRecipe[]>();
  for (const recipe of recipes) {
    const current = byOutput.get(recipe.slug) ?? [];
    current.push(recipe);
    byOutput.set(recipe.slug, current);
  }
  if (!byOutput.has(targetSlug)) throw new Error(`Recipe not found: ${targetSlug}`);

  const direct = new Map<string, CraftTotal>();
  const base = new Map<string, CraftTotal>();
  const dependencies = new Map<string, CraftTotal>();
  const surplus = new Map<string, CraftTotal>();
  const requirements = new Map<string, CraftRequirementEvaluation>();
  const unknownQuantity = new Set<string>();
  const unknownInventory = new Set<string>();
  const alternatives: CraftAlternative[] = [];
  const traces: EvaluationTrace[] = [];
  const remaining = new Map<string, number>();
  for (const [slug, state] of Object.entries(options.inventory ?? {})) {
    if (state.quantity !== null && Number.isSafeInteger(state.quantity) && state.quantity >= 0)
      remaining.set(slug, state.quantity);
  }

  const add = (map: Map<string, CraftTotal>, ingredient: CraftIngredient, quantity: number) => {
    if (quantity === 0) return;
    const current = map.get(ingredient.slug);
    const next = (current?.quantity ?? 0) + quantity;
    if (!Number.isSafeInteger(next) || next > MAX_CRAFT_QUANTITY)
      throw new Error(`Craft quantity exceeds safe limit for ${ingredient.slug}`);
    map.set(ingredient.slug, { slug: ingredient.slug, name: ingredient.name, quantity: next });
  };

  const chooseRecipe = (slug: string): CraftRecipe | null => {
    const candidates = byOutput.get(slug) ?? [];
    if (candidates.length <= 1) return candidates[0] ?? null;
    const selected = options.recipeSelections?.[slug];
    const match = selected
      ? candidates.find(
          (candidate, index) => (candidate.id ?? `${candidate.slug}:${index}`) === selected,
        )
      : undefined;
    if (match) return match;
    for (const [index, candidate] of candidates.entries())
      alternatives.push({
        recipeId: candidate.id ?? `${candidate.slug}:${index}`,
        name: candidate.name,
        ingredientCount: candidate.ingredients.length,
        contentScope: candidate.contentScope ?? 'unknown',
      });
    return null;
  };

  const consume = (
    ingredient: CraftIngredient,
    required: number,
    kind: 'base' | 'intermediate',
  ) => {
    const state = options.inventory?.[ingredient.slug];
    const available = remaining.get(ingredient.slug);
    if (!state || state.ownership === 'unknown' || state.quantity === null) {
      unknownInventory.add(ingredient.name);
      requirements.set(ingredient.slug, {
        name: ingredient.name,
        slug: ingredient.slug,
        required,
        available: null,
        used: 0,
        missing: null,
        state: 'unknown',
        kind,
      });
      return required;
    }
    const usable = Math.min(required, available ?? 0);
    remaining.set(ingredient.slug, Math.max(0, (available ?? 0) - usable));
    const missing = required - usable;
    requirements.set(ingredient.slug, {
      name: ingredient.name,
      slug: ingredient.slug,
      required,
      available: state.quantity,
      used: usable,
      missing,
      state: missing === 0 ? 'yes' : 'no',
      kind,
    });
    return missing;
  };

  const expand = (
    slug: string,
    name: string,
    amount: number,
    stack: readonly string[],
    isTarget = false,
  ): number | null => {
    if (stack.includes(slug)) throw new CraftingCycleError([...stack, slug]);
    const recipe = chooseRecipe(slug);
    if (!recipe) {
      if ((byOutput.get(slug)?.length ?? 0) > 1) return null;
      const ingredient = { slug, name, quantity: amount };
      const missing = isTarget ? amount : consume(ingredient, amount, 'base');
      add(base, ingredient, missing);
      return 0;
    }

    const need = isTarget
      ? amount
      : consume({ slug, name, quantity: amount }, amount, 'intermediate');
    if (need === 0) return 0;
    const knownOutput = isKnownOutput(recipe);
    if (!knownOutput && need > 1) {
      unknownQuantity.add(`${recipe.name}: cantidad de salida por fabricación`);
      for (const ingredient of recipe.ingredients) {
        unknownQuantity.add(`${ingredient.name}: total depende del batch de ${recipe.name}`);
        if ((byOutput.get(ingredient.slug)?.length ?? 0) > 0)
          expand(ingredient.slug, ingredient.name, 1, [...stack, slug]);
      }
      return null;
    }
    const output = knownOutput ? (recipe.outputQuantity as number) : 1;
    const crafts = Math.ceil(need / output);
    if (!knownOutput) unknownQuantity.add(`${recipe.name}: excedente de salida desconocido`);
    if (!isTarget) add(dependencies, { slug, name, quantity: need }, need);
    const extra = knownOutput ? crafts * output - need : 0;
    if (extra > 0) {
      add(surplus, { slug, name, quantity: extra }, extra);
      remaining.set(slug, (remaining.get(slug) ?? 0) + extra);
    }
    for (const ingredient of recipe.ingredients) {
      if (ingredient.quantity === null) {
        unknownQuantity.add(`${ingredient.name}: cantidad de ingrediente`);
        continue;
      }
      assertPositiveInteger(ingredient.quantity, `ingredient quantity for ${ingredient.slug}`);
      const required = ingredient.quantity * crafts;
      if (!Number.isSafeInteger(required) || required > MAX_CRAFT_QUANTITY)
        throw new Error(`Craft quantity exceeds safe limit for ${ingredient.slug}`);
      if (isTarget) add(direct, ingredient, required);
      expand(ingredient.slug, ingredient.name, required, [...stack, slug]);
    }
    if (!isTarget) {
      const evaluation = requirements.get(slug);
      if (evaluation)
        requirements.set(slug, { ...evaluation, missing: 0, state: 'yes', kind: 'intermediate' });
    }
    traces.push({
      id: `craft:${slug}:${stack.length}`,
      ruleId: `crafting.transformation.${slug}`,
      ruleVersion: 2,
      label: `Fabricar ${name}`,
      result: unknownQuantity.size ? 'unknown' : 'yes',
      reason: knownOutput
        ? `${crafts} fabricación(es) con batch respaldado.`
        : 'Una fabricación estructural; el batch exacto no está respaldado.',
      inputs: { requested: amount, crafts, outputQuantity: recipe.outputQuantity },
      evidence: recipe.source ? [recipe.source] : [],
      children: [],
    });
    return crafts;
  };

  const target = chooseRecipe(targetSlug);
  if (!target) {
    if ((byOutput.get(targetSlug)?.length ?? 0) <= 1)
      throw new Error(`Recipe not found: ${targetSlug}`);
  }
  const crafts = target ? expand(targetSlug, target.name, requestedCopies, [], true) : null;
  const anyNo = [...requirements.values()].some(
    (entry) => entry.kind === 'base' && entry.state === 'no',
  );
  const hasChoice = alternatives.length > 0;
  const hasUnknown = unknownQuantity.size > 0 || unknownInventory.size > 0;
  const status = hasChoice
    ? 'choice_required'
    : anyNo
      ? 'blocked'
      : hasUnknown
        ? 'unknown'
        : 'ready';
  const rootResult: TruthState =
    status === 'ready' ? 'yes' : status === 'blocked' ? 'no' : 'unknown';
  const sorted = (values: Iterable<CraftTotal>) =>
    [...values].sort((a, b) => a.name.localeCompare(b.name));
  return {
    targetSlug,
    requestedCopies,
    status,
    crafts,
    directIngredients: sorted(direct.values()),
    baseMaterials: sorted(base.values()),
    craftedDependencies: sorted(dependencies.values()),
    surplus: sorted(surplus.values()),
    requirements: [...requirements.values()].sort((a, b) => a.name.localeCompare(b.name)),
    unknownQuantities: [...unknownQuantity].sort(),
    unknownInventory: [...unknownInventory].sort(),
    alternatives,
    trace: {
      id: `craft-plan:${targetSlug}`,
      ruleId: 'crafting.plan.v2',
      ruleVersion: 2,
      label: `Plan para ${target?.name ?? targetSlug}`,
      result: rootResult,
      reason:
        status === 'ready'
          ? 'Inventario y cantidades suficientes.'
          : status === 'blocked'
            ? 'Faltan materiales confirmados.'
            : status === 'choice_required'
              ? 'Hay varias recetas y se necesita una elección explícita.'
              : 'Faltan cantidades o estados de inventario confirmados.',
      inputs: { targetSlug, requestedCopies },
      evidence: target?.source ? [target.source] : [],
      children: traces,
    },
  };
}

export interface CraftGraphNode {
  readonly slug: string;
  readonly name: string;
  readonly recipeAlternatives: number;
  readonly quantitative: boolean;
}

export interface CraftGraphEdge {
  readonly from: string;
  readonly to: string;
  readonly quantity: number | null;
}

export interface CraftGraph {
  readonly nodes: readonly CraftGraphNode[];
  readonly edges: readonly CraftGraphEdge[];
  readonly producesByIngredient: Readonly<Record<string, readonly string[]>>;
}

export function buildCraftGraph(recipes: readonly CraftRecipe[]): CraftGraph {
  const bySlug = new Map<string, CraftRecipe[]>();
  for (const recipe of recipes)
    bySlug.set(recipe.slug, [...(bySlug.get(recipe.slug) ?? []), recipe]);
  const nodes = [...bySlug.entries()].map(([slug, choices]) => ({
    slug,
    name: choices[0]?.name ?? slug,
    recipeAlternatives: choices.length,
    quantitative: choices.every(isKnownOutput),
  }));
  const edges = recipes.flatMap((recipe) =>
    recipe.ingredients.map((ingredient) => ({
      from: recipe.slug,
      to: ingredient.slug,
      quantity: ingredient.quantity,
    })),
  );
  const inverse: Record<string, string[]> = {};
  for (const edge of edges)
    inverse[edge.to] = [...new Set([...(inverse[edge.to] ?? []), edge.from])];
  return { nodes, edges, producesByIngredient: inverse };
}

export function rulesFromRecipes(recipes: readonly CraftRecipe[]): readonly GameRule[] {
  return recipes.map((recipe, index) => ({
    id: `recipe.${recipe.id ?? `${recipe.slug}.${index}`}`,
    version: 2,
    family: 'transformation',
    subject: { kind: 'recipe', slug: recipe.slug },
    predicates: recipe.ingredients.map((ingredient) => ({
      kind: 'item_quantity' as const,
      subject: ingredient.slug,
      quantity: ingredient.quantity,
    })),
    effects: [
      {
        kind: 'produces',
        subject: recipe.slug,
        quantity: isKnownOutput(recipe) ? recipe.outputQuantity : null,
      },
    ],
    provenance: {
      derivation: 'source_fact',
      evidence: recipe.source ? [recipe.source] : [],
    },
    confidence: recipe.source?.verificationStatus === 'confirmed' ? 'high' : 'medium',
    contentScope: recipe.contentScope ?? 'unknown',
    gameVersion: recipe.gameVersion ?? null,
    enabled: true,
    deprecated: false,
  }));
}

export interface PlayerWorldSnapshot {
  readonly inventory: Readonly<Record<string, InventoryItemState>>;
  readonly townLevels: Readonly<Record<string, number | null>>;
  readonly infrastructure: Readonly<Record<string, Readonly<Record<string, TruthState>>>>;
  readonly builtSystems: readonly string[];
  readonly unlocks: Readonly<Record<string, TruthState>>;
}

export type SimulationAction =
  | { readonly kind: 'craft'; readonly recipeSlug: string; readonly quantity: number }
  | { readonly kind: 'build'; readonly systemSlug: string }
  | { readonly kind: 'unlock'; readonly unlockId: string }
  | { readonly kind: 'satisfy'; readonly predicateId: string };

export interface SimulationResult {
  readonly status: TruthState;
  readonly before: PlayerWorldSnapshot;
  readonly after: PlayerWorldSnapshot;
  readonly changed: readonly string[];
  readonly unknowns: readonly string[];
  readonly trace: EvaluationTrace;
}

function cloneSnapshot(snapshot: PlayerWorldSnapshot): PlayerWorldSnapshot {
  return {
    inventory: Object.fromEntries(
      Object.entries(snapshot.inventory).map(([key, value]) => [key, { ...value }]),
    ),
    townLevels: { ...snapshot.townLevels },
    infrastructure: Object.fromEntries(
      Object.entries(snapshot.infrastructure).map(([town, values]) => [town, { ...values }]),
    ),
    builtSystems: [...snapshot.builtSystems],
    unlocks: { ...snapshot.unlocks },
  };
}

export function simulateAction(
  snapshot: PlayerWorldSnapshot,
  action: SimulationAction,
  recipes: readonly CraftRecipe[],
): SimulationResult {
  const before = cloneSnapshot(snapshot);
  let after = cloneSnapshot(snapshot);
  const changed: string[] = [];
  const unknowns: string[] = [];
  let status: TruthState = 'unknown';
  if (action.kind === 'craft') {
    const plan = calculateCraftPlan(recipes, action.recipeSlug, action.quantity, {
      inventory: snapshot.inventory,
    });
    if (plan.status === 'ready' && plan.crafts !== null) {
      const inventory = { ...after.inventory };
      for (const requirement of plan.requirements) {
        if (requirement.used > 0) {
          inventory[requirement.slug] = {
            ownership: requirement.available! - requirement.used > 0 ? 'yes' : 'no',
            quantity: requirement.available! - requirement.used,
          };
          changed.push(`inventory:${requirement.slug}`);
        }
      }
      const recipe = recipes.find((candidate) => candidate.slug === action.recipeSlug);
      if (recipe && isKnownOutput(recipe)) {
        const produced = plan.crafts * (recipe.outputQuantity as number);
        const current = inventory[action.recipeSlug];
        inventory[action.recipeSlug] = {
          ownership: 'yes',
          quantity: (current?.quantity ?? 0) + produced,
        };
        changed.push(`inventory:${action.recipeSlug}`);
        after = { ...after, inventory };
        status = 'yes';
      } else unknowns.push('La cantidad de salida no permite aplicar una mutación exacta.');
    } else {
      status = plan.status === 'blocked' ? 'no' : 'unknown';
      unknowns.push(...plan.unknownQuantities, ...plan.unknownInventory);
    }
  } else if (action.kind === 'build') {
    after = { ...after, builtSystems: [...new Set([...after.builtSystems, action.systemSlug])] };
    changed.push(`built:${action.systemSlug}`);
    status = 'yes';
  } else if (action.kind === 'unlock') {
    after = { ...after, unlocks: { ...after.unlocks, [action.unlockId]: 'yes' } };
    changed.push(`unlock:${action.unlockId}`);
    status = 'yes';
  } else {
    after = { ...after, unlocks: { ...after.unlocks, [action.predicateId]: 'yes' } };
    changed.push(`predicate:${action.predicateId}`);
    status = 'yes';
  }
  return {
    status,
    before,
    after,
    changed,
    unknowns,
    trace: {
      id: `simulation:${action.kind}`,
      ruleId: 'simulation.v1',
      ruleVersion: 1,
      label: `Simular ${action.kind}`,
      result: status,
      reason:
        status === 'yes'
          ? 'La acción pudo aplicarse con valores exactos.'
          : status === 'no'
            ? 'La acción está bloqueada.'
            : 'La acción depende de datos desconocidos.',
      inputs: { action: action.kind },
      evidence: [],
      children: [],
    },
  };
}

export interface AutomationRuleSystem {
  readonly slug: string;
  readonly name: string;
  readonly requirements: readonly CraftIngredient[];
  readonly pokemon: readonly string[] | null;
  readonly infrastructure: readonly string[] | null;
  readonly operationalInputs: readonly string[] | null;
  readonly operationalOutputs: readonly string[] | null;
  readonly unlock: string | null;
  readonly compatibleTowns: readonly string[];
  readonly limitations: readonly string[];
  readonly contentScope?: ContentScope;
  readonly gameVersion?: string | null;
  readonly quantitative?: readonly SourceQuantitativeParameter[];
  readonly source?: RuleEvidenceRef;
}

export interface SourceQuantitativeParameter {
  readonly id: string;
  readonly predicate: string;
  readonly value: number;
  readonly unit: string;
  readonly qualifier: string | null;
  readonly derivation: 'source_fact' | 'mathematical_derived';
  readonly evidenceText: string;
  readonly assertionStatus: 'accepted' | 'candidate' | 'disputed';
  readonly source: RuleEvidenceRef;
}

export interface AutomationPlayerState {
  readonly inventory: Readonly<Record<string, InventoryItemState>>;
  readonly residentRoles: readonly string[];
  readonly townLevel: number | null;
  readonly infrastructure: Readonly<Record<string, TruthState>>;
  readonly built: TruthState;
  readonly unlocks?: Readonly<Record<string, TruthState>>;
}

export interface AutomationRequirementResult {
  readonly id: string;
  readonly label: string;
  readonly category:
    | 'build_material'
    | 'unlock'
    | 'town_compatibility'
    | 'infrastructure'
    | 'operational_input'
    | 'pokemon_role'
    | 'built_system';
  readonly state: TruthState;
  readonly requiredQuantity: number | null;
  readonly availableQuantity: number | null;
  readonly reason: string;
  readonly trace: EvaluationTrace;
}

export interface ReadinessResult {
  readonly state: TruthState;
  readonly requirements: readonly AutomationRequirementResult[];
  readonly satisfied: readonly AutomationRequirementResult[];
  readonly missing: readonly AutomationRequirementResult[];
  readonly unknown: readonly AutomationRequirementResult[];
  readonly trace: EvaluationTrace;
}

export interface MeasurementParameter {
  readonly metric: 'throughput' | 'duration' | 'range' | 'capacity' | 'consumption' | 'yield';
  readonly state: 'exact' | 'range' | 'unknown';
  readonly value: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
  readonly unit: string | null;
  readonly reviewState:
    'accepted' | 'proposed' | 'measured' | 'replicated' | 'disputed' | 'superseded';
  readonly evidence: readonly RuleEvidenceRef[];
  readonly qualifier?: string | null;
  readonly derivation?: 'source_fact' | 'accepted_measurement' | 'mathematical_derived';
  readonly evidenceText?: string;
  readonly sourceParameterId?: string;
}

function metricForPredicate(predicate: string): MeasurementParameter['metric'] | null {
  if (predicate.includes('duration')) return 'duration';
  if (predicate.includes('range')) return 'range';
  if (predicate.includes('capacity') || predicate.includes('limit')) return 'capacity';
  if (predicate === 'power_demand') return 'consumption';
  if (predicate === 'power_generation') return 'yield';
  return null;
}

export function measurementsFromAcceptedSource(
  system: AutomationRuleSystem,
): readonly MeasurementParameter[] {
  return (system.quantitative ?? []).flatMap((parameter) => {
    const metric = metricForPredicate(parameter.predicate);
    if (!metric || parameter.assertionStatus !== 'accepted') return [];
    return [
      {
        metric,
        state: 'exact' as const,
        value: parameter.value,
        minimum: parameter.value,
        maximum: parameter.value,
        unit: parameter.unit,
        reviewState: 'accepted' as const,
        evidence: [parameter.source],
        qualifier: parameter.qualifier,
        derivation:
          parameter.derivation === 'mathematical_derived'
            ? ('mathematical_derived' as const)
            : ('source_fact' as const),
        evidenceText: parameter.evidenceText,
        sourceParameterId: parameter.id,
      },
    ];
  });
}

export interface NormalizedRate {
  readonly observed: {
    readonly quantity: number;
    readonly unit: 'item';
    readonly duration: number;
    readonly durationUnit: 'second';
  };
  readonly normalized: {
    readonly value: number;
    readonly unit: 'item_per_minute';
    readonly derivation: 'mathematical_derived';
  };
}

export function normalizeItemRate(quantity: number, durationSeconds: number): NormalizedRate {
  if (!Number.isFinite(quantity) || quantity < 0)
    throw new Error('quantity must be a finite non-negative number');
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new Error('durationSeconds must be a finite positive number');
  return {
    observed: { quantity, unit: 'item', duration: durationSeconds, durationUnit: 'second' },
    normalized: {
      value: (quantity * 60) / durationSeconds,
      unit: 'item_per_minute',
      derivation: 'mathematical_derived',
    },
  };
}

export interface AutomationEvaluation {
  readonly systemSlug: string;
  readonly townSlug: string;
  readonly build: ReadinessResult;
  readonly operational: ReadinessResult;
  readonly materialOutputs: readonly string[];
  readonly effects: readonly string[];
  readonly limitations: readonly string[];
  readonly measurements: readonly MeasurementParameter[];
  readonly throughput: {
    readonly available: boolean;
    readonly reason: string;
    readonly parameter: MeasurementParameter | null;
  };
  readonly trace: EvaluationTrace;
}

function ruleEvidence(system: AutomationRuleSystem): readonly RuleEvidenceRef[] {
  return system.source ? [system.source] : [];
}

function requirementTrace(
  system: AutomationRuleSystem,
  id: string,
  label: string,
  result: TruthState,
  reason: string,
  inputs: Readonly<Record<string, string | number | boolean | null>>,
): EvaluationTrace {
  return {
    id: `${system.slug}:${id}`,
    ruleId: `automation.${id}.v2`,
    ruleVersion: 2,
    label,
    result,
    reason,
    inputs,
    evidence: ruleEvidence(system),
    children: [],
  };
}

function readiness(
  system: AutomationRuleSystem,
  kind: 'build' | 'operational',
  requirements: readonly AutomationRequirementResult[],
): ReadinessResult {
  const state: TruthState = requirements.some((entry) => entry.state === 'no')
    ? 'no'
    : requirements.some((entry) => entry.state === 'unknown')
      ? 'unknown'
      : 'yes';
  return {
    state,
    requirements,
    satisfied: requirements.filter((entry) => entry.state === 'yes'),
    missing: requirements.filter((entry) => entry.state === 'no'),
    unknown: requirements.filter((entry) => entry.state === 'unknown'),
    trace: {
      id: `${system.slug}:${kind}`,
      ruleId: `automation.${kind}-readiness.v2`,
      ruleVersion: 2,
      label: `${kind === 'build' ? 'Construcción' : 'Operación'} de ${system.name}`,
      result: state,
      reason:
        state === 'yes'
          ? 'Todos los requisitos están confirmados.'
          : state === 'no'
            ? 'Existe al menos un requisito confirmado como insuficiente.'
            : 'Existe al menos un requisito sin estado o cantidad confirmada.',
      inputs: { system: system.slug },
      evidence: ruleEvidence(system),
      children: requirements.map((entry) => entry.trace),
    },
  };
}

function stateForInfrastructure(
  infrastructure: Readonly<Record<string, TruthState>>,
  label: string,
): TruthState {
  const key = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-');
  return infrastructure[key] ?? infrastructure[label] ?? 'unknown';
}

export function evaluateAutomation(
  system: AutomationRuleSystem,
  town: { readonly slug: string; readonly name: string },
  player: AutomationPlayerState,
  measurements: readonly MeasurementParameter[] = [],
): AutomationEvaluation {
  const buildRequirements: AutomationRequirementResult[] = system.requirements.map(
    (requirement) => {
      const item = player.inventory[requirement.slug];
      const required = requirement.quantity;
      const state: TruthState =
        required === null || !item || item.ownership === 'unknown' || item.quantity === null
          ? 'unknown'
          : item.quantity >= required
            ? 'yes'
            : 'no';
      const reason =
        required === null
          ? 'La cantidad necesaria no está respaldada.'
          : !item || item.ownership === 'unknown' || item.quantity === null
            ? 'La cantidad disponible no está confirmada.'
            : item.quantity >= required
              ? `Hay ${item.quantity}; se requieren ${required}.`
              : `Hay ${item.quantity}; faltan ${required - item.quantity}.`;
      return {
        id: `material:${requirement.slug}`,
        label: requirement.name,
        category: 'build_material' as const,
        state,
        requiredQuantity: required,
        availableQuantity: item?.quantity ?? null,
        reason,
        trace: requirementTrace(
          system,
          `material.${requirement.slug}`,
          requirement.name,
          state,
          reason,
          {
            required,
            available: item?.quantity ?? null,
          },
        ),
      };
    },
  );

  const level = Number(system.unlock?.match(/Lv\.\s*(\d+)/i)?.[1]) || null;
  if (level !== null) {
    const state: TruthState =
      player.townLevel === null ? 'unknown' : player.townLevel >= level ? 'yes' : 'no';
    const reason =
      player.townLevel === null
        ? 'El nivel actual del pueblo no está confirmado.'
        : player.townLevel >= level
          ? `Nivel ${player.townLevel} satisface el nivel ${level}.`
          : `Nivel ${player.townLevel}; se requiere ${level}.`;
    buildRequirements.push({
      id: `town-level:${level}`,
      label: `${town.name} · Environment Level ${level}`,
      category: 'unlock',
      state,
      requiredQuantity: level,
      availableQuantity: player.townLevel,
      reason,
      trace: requirementTrace(system, 'town-level', `Environment Level ${level}`, state, reason, {
        required: level,
        current: player.townLevel,
      }),
    });
  } else if (system.unlock) {
    const unlockState = player.unlocks?.[system.unlock] ?? 'unknown';
    const reason =
      unlockState === 'yes'
        ? 'Desbloqueo confirmado por el jugador.'
        : unlockState === 'no'
          ? 'Desbloqueo confirmado como pendiente.'
          : 'La fuente describe un desbloqueo, pero el jugador no ha confirmado su estado.';
    buildRequirements.push({
      id: 'unlock',
      label: system.unlock,
      category: 'unlock',
      state: unlockState,
      requiredQuantity: null,
      availableQuantity: null,
      reason,
      trace: requirementTrace(system, 'unlock', system.unlock, unlockState, reason, {
        unlock: system.unlock,
      }),
    });
  }

  const compatibilityState: TruthState = system.compatibleTowns.includes(town.name)
    ? 'yes'
    : 'unknown';
  const compatibilityReason =
    compatibilityState === 'yes'
      ? 'La fuente/proyección enlaza este sistema con el pueblo.'
      : 'No existe evidencia negativa; la compatibilidad debe verificarse.';
  buildRequirements.push({
    id: 'town-compatibility',
    label: `Compatibilidad con ${town.name}`,
    category: 'town_compatibility',
    state: compatibilityState,
    requiredQuantity: null,
    availableQuantity: null,
    reason: compatibilityReason,
    trace: requirementTrace(
      system,
      'town-compatibility',
      `Compatibilidad con ${town.name}`,
      compatibilityState,
      compatibilityReason,
      { town: town.slug },
    ),
  });

  const operationalRequirements: AutomationRequirementResult[] = [
    {
      id: 'built-system',
      label: `${system.name} construido`,
      category: 'built_system',
      state: player.built,
      requiredQuantity: 1,
      availableQuantity: player.built === 'yes' ? 1 : player.built === 'no' ? 0 : null,
      reason:
        player.built === 'yes'
          ? 'Sistema marcado como construido.'
          : player.built === 'no'
            ? 'Sistema marcado como no construido.'
            : 'No se ha confirmado si el sistema está construido.',
      trace: requirementTrace(
        system,
        'built-system',
        `${system.name} construido`,
        player.built,
        player.built === 'yes'
          ? 'Sistema construido confirmado.'
          : player.built === 'no'
            ? 'Sistema no construido confirmado.'
            : 'Estado de construcción desconocido.',
        { built: player.built },
      ),
    },
  ];
  for (const infrastructure of system.infrastructure ?? []) {
    const state = stateForInfrastructure(player.infrastructure, infrastructure);
    const reason =
      state === 'yes'
        ? 'Infraestructura confirmada en el pueblo.'
        : state === 'no'
          ? 'Infraestructura confirmada como ausente.'
          : 'Estado de infraestructura no confirmado.';
    operationalRequirements.push({
      id: `infrastructure:${infrastructure}`,
      label: infrastructure,
      category: 'infrastructure',
      state,
      requiredQuantity: null,
      availableQuantity: null,
      reason,
      trace: requirementTrace(
        system,
        `infrastructure.${infrastructure}`,
        infrastructure,
        state,
        reason,
        {
          town: town.slug,
        },
      ),
    });
  }
  for (const input of system.operationalInputs ?? []) {
    const looksLikePower = /electric|power|energ/i.test(input);
    const state = looksLikePower ? stateForInfrastructure(player.infrastructure, input) : 'unknown';
    const reason = looksLikePower
      ? state === 'yes'
        ? 'Suministro confirmado.'
        : state === 'no'
          ? 'Suministro confirmado como ausente.'
          : 'Suministro no confirmado.'
      : 'El corpus nombra el input, pero no define un estado de inventario o consumo aceptado.';
    operationalRequirements.push({
      id: `input:${input}`,
      label: input,
      category: 'operational_input',
      state,
      requiredQuantity: null,
      availableQuantity: null,
      reason,
      trace: requirementTrace(system, `input.${input}`, input, state, reason, { input }),
    });
  }
  for (const role of system.pokemon ?? []) {
    const state: TruthState = player.residentRoles.includes(role) ? 'yes' : 'unknown';
    const reason =
      state === 'yes'
        ? 'Rol cubierto por un residente confirmado.'
        : 'No se confirma un residente con este rol; ausencia no implica incompatibilidad.';
    operationalRequirements.push({
      id: `pokemon-role:${role}`,
      label: role,
      category: 'pokemon_role',
      state,
      requiredQuantity: null,
      availableQuantity: null,
      reason,
      trace: requirementTrace(system, `pokemon-role.${role}`, role, state, reason, { role }),
    });
  }

  const accepted = [
    ...measurementsFromAcceptedSource(system),
    ...measurements.filter((measurement) => measurement.reviewState === 'accepted'),
  ];
  const throughput = accepted.find((measurement) => measurement.metric === 'throughput') ?? null;
  const build = readiness(system, 'build', buildRequirements);
  const operational = readiness(system, 'operational', operationalRequirements);
  return {
    systemSlug: system.slug,
    townSlug: town.slug,
    build,
    operational,
    materialOutputs: [],
    effects: system.operationalOutputs ?? [],
    limitations: system.limitations,
    measurements: accepted,
    throughput: {
      available: Boolean(throughput && throughput.state !== 'unknown'),
      reason: throughput
        ? 'Parámetro aceptado por el protocolo de medición.'
        : 'Throughput no disponible: no hay una medición aceptada.',
      parameter: throughput,
    },
    trace: {
      id: `automation:${system.slug}:${town.slug}`,
      ruleId: 'automation.evaluate.v2',
      ruleVersion: 2,
      label: `${system.name} en ${town.name}`,
      result:
        build.state === 'no' || operational.state === 'no'
          ? 'no'
          : build.state === 'unknown' || operational.state === 'unknown'
            ? 'unknown'
            : 'yes',
      reason: 'Construcción y operación se evalúan de forma independiente.',
      inputs: { system: system.slug, town: town.slug },
      evidence: ruleEvidence(system),
      children: [build.trace, operational.trace],
    },
  };
}

export function whatCanAutomate(
  systems: readonly AutomationRuleSystem[],
  town: { readonly slug: string; readonly name: string },
  playerFor: (system: AutomationRuleSystem) => AutomationPlayerState,
): {
  readonly ready: readonly AutomationEvaluation[];
  readonly blocked: readonly AutomationEvaluation[];
  readonly needsVerification: readonly AutomationEvaluation[];
} {
  const evaluations = systems.map((system) => evaluateAutomation(system, town, playerFor(system)));
  return {
    ready: evaluations.filter(
      (entry) => entry.build.state === 'yes' && entry.operational.state === 'yes',
    ),
    blocked: evaluations.filter(
      (entry) => entry.build.state === 'no' || entry.operational.state === 'no',
    ),
    needsVerification: evaluations.filter(
      (entry) =>
        entry.build.state !== 'no' &&
        entry.operational.state !== 'no' &&
        (entry.build.state === 'unknown' || entry.operational.state === 'unknown'),
    ),
  };
}

export function rulesFromAutomation(systems: readonly AutomationRuleSystem[]): readonly GameRule[] {
  return systems.flatMap((system) => {
    const evidence = ruleEvidence(system);
    const shared = {
      version: 2,
      subject: { kind: 'automation', slug: system.slug },
      provenance: { derivation: 'source_fact' as const, evidence },
      confidence: (system.source?.verificationStatus === 'confirmed' ? 'high' : 'medium') as
        'high' | 'medium',
      contentScope: system.contentScope ?? ('unknown' as const),
      gameVersion: system.gameVersion ?? null,
      enabled: true,
      deprecated: false,
    };
    return [
      {
        ...shared,
        id: `automation.${system.slug}.build`,
        family: 'requirement' as const,
        predicates: system.requirements.map((requirement) => ({
          kind: 'item_quantity' as const,
          subject: requirement.slug,
          quantity: requirement.quantity,
        })),
        effects: [{ kind: 'enables' as const, subject: `build:${system.slug}` }],
      },
      {
        ...shared,
        id: `automation.${system.slug}.operate`,
        family: 'availability' as const,
        predicates: [
          ...(system.infrastructure ?? []).map((subject) => ({
            kind: 'infrastructure' as const,
            subject,
          })),
          ...(system.operationalInputs ?? []).map((subject) => ({
            kind: 'infrastructure' as const,
            subject,
          })),
        ],
        effects: (system.operationalOutputs ?? []).map((subject) => ({
          kind: 'enables' as const,
          subject,
        })),
      },
    ];
  });
}

export interface InferredTownLevel {
  readonly id: string;
  readonly state: 'inferred';
  readonly inferredFrom: string;
  readonly rule: 'town_level_implies_lower_levels_v1';
  readonly timestamp: string;
}

export function inferLowerTownLevels(
  townSlug: string,
  confirmedLevel: number,
  timestamp = new Date().toISOString(),
): readonly InferredTownLevel[] {
  if (!Number.isInteger(confirmedLevel) || confirmedLevel < 0)
    throw new Error('confirmedLevel must be a non-negative integer');
  return Array.from({ length: Math.max(0, confirmedLevel - 1) }, (_, index) => ({
    id: `town-level:${townSlug}:${index + 1}`,
    state: 'inferred' as const,
    inferredFrom: `town:${townSlug}:level:${confirmedLevel}`,
    rule: 'town_level_implies_lower_levels_v1' as const,
    timestamp,
  }));
}
export * from './measurement-import';
