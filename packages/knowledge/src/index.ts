import type {
  AutomationSystem,
  GameDataRepository,
  RoleSlug,
  SourceEvidence,
} from '@pokopia/game-data';

export type GraphEntityKind =
  | 'pokemon'
  | 'role'
  | 'habitat'
  | 'item'
  | 'recipe'
  | 'material'
  | 'town'
  | 'location'
  | 'facility'
  | 'resource'
  | 'automation'
  | 'quest'
  | 'treasure_map'
  | 'collectible'
  | 'ditto_move'
  | 'specialty'
  | 'infrastructure'
  | 'effect'
  | 'requirement';

export type RelationshipPredicate =
  | 'pokemon_performs_role'
  | 'pokemon_prefers_habitat'
  | 'pokemon_found_at'
  | 'recipe_produces_item'
  | 'recipe_requires_item'
  | 'recipe_requires_material'
  | 'town_unlocks_recipe'
  | 'town_unlocks_item'
  | 'town_lists_exclusive_pokemon'
  | 'town_has_resource'
  | 'town_has_facility'
  | 'automation_requires_item'
  | 'automation_compatible_with_town'
  | 'automation_requires_infrastructure'
  | 'automation_accepts_input'
  | 'automation_produces_output'
  | 'item_participates_in_automation'
  | 'entity_requires_unlock_level'
  | 'treasure_map_requires_item'
  | 'treasure_map_requires_specialty'
  | 'treasure_map_rewards_item'
  | 'treasure_map_unlocks_recipe'
  | 'ditto_move_learned_from_pokemon'
  | 'alternative_to';

export type RelationshipClass = 'direct_fact' | 'derived_fact' | 'inference' | 'recommendation';
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';
export type EvidenceCoverage = 'complete' | 'partial' | 'unknown';

export interface GraphEntityRef {
  readonly kind: GraphEntityKind;
  readonly slug: string;
  readonly name: string;
}

export interface RelationshipEvidence {
  readonly statement: string;
  readonly source: SourceEvidence;
}

export interface KnowledgeRelationship {
  readonly id: string;
  readonly from: GraphEntityRef;
  readonly predicate: RelationshipPredicate;
  readonly to: GraphEntityRef;
  readonly relationshipClass: RelationshipClass;
  readonly confidence: ConfidenceLevel;
  readonly evidenceCoverage: EvidenceCoverage;
  readonly evidence: readonly RelationshipEvidence[];
  readonly gameVersion: string | null;
  readonly versionScope: 'specific' | 'unversioned_system' | 'unknown';
  readonly derivationMethod: string | null;
}

export interface GraphTraversal {
  readonly root: GraphEntityRef;
  readonly nodes: readonly GraphEntityRef[];
  readonly relationships: readonly KnowledgeRelationship[];
  readonly cycles: readonly string[];
  readonly truncated: boolean;
}

export interface SemanticRelationshipQuality {
  readonly rawDocumentRelationships: number;
  readonly rawTypes: Readonly<Record<string, number>>;
  readonly rawSelfLinks: number;
  readonly rawOrphans: number;
  readonly rawAmbiguousLinks: number;
  readonly semanticRelationships: number;
  readonly semanticPredicates: Readonly<Record<string, number>>;
  readonly relationshipClasses: Readonly<Record<RelationshipClass, number>>;
}

export type OrphanClassification =
  | 'LEGITIMATELY_ISOLATED'
  | 'MISSING_RELATION_PARSER'
  | 'MISSING_RELATION_TYPE'
  | 'INSUFFICIENT_DATA'
  | 'POSSIBLE_DATA_BUG';

export interface ClassifiedOrphan {
  readonly entity: GraphEntityRef;
  readonly classification: OrphanClassification;
  readonly rationale: string;
  readonly source: SourceEvidence | null;
}

export interface KnowledgeGraph {
  resolve(kind: GraphEntityKind, slug: string): GraphEntityRef | null;
  getRelations(entity: GraphEntityRef): readonly KnowledgeRelationship[];
  getRequirements(entity: GraphEntityRef): readonly KnowledgeRelationship[];
  getDependencies(entity: GraphEntityRef, maxDepth?: number): GraphTraversal;
  getAlternatives(entity: GraphEntityRef): readonly KnowledgeRelationship[];
  getSynergies(entity: GraphEntityRef): readonly KnowledgeRelationship[];
  getRelevantTowns(entity: GraphEntityRef): readonly GraphEntityRef[];
  getRelevantPokemon(entity: GraphEntityRef): readonly GraphEntityRef[];
  getEffects(entity: GraphEntityRef): readonly GraphEntityRef[];
  getEvidence(entity: GraphEntityRef): readonly RelationshipEvidence[];
  classifyOrphans(): readonly ClassifiedOrphan[];
  quality(): SemanticRelationshipQuality;
}

const REQUIREMENT_PREDICATES = new Set<RelationshipPredicate>([
  'recipe_requires_item',
  'recipe_requires_material',
  'automation_requires_item',
  'automation_requires_infrastructure',
  'entity_requires_unlock_level',
  'treasure_map_requires_item',
  'treasure_map_requires_specialty',
]);

const DEPENDENCY_PREDICATES = new Set<RelationshipPredicate>([
  ...REQUIREMENT_PREDICATES,
  'town_unlocks_recipe',
  'town_unlocks_item',
  'item_participates_in_automation',
]);

export function createKnowledgeGraph(repository: GameDataRepository): KnowledgeGraph {
  return new GameKnowledgeGraph(repository);
}

class GameKnowledgeGraph implements KnowledgeGraph {
  private readonly nodes = new Map<string, GraphEntityRef>();
  private readonly relationships = new Map<string, KnowledgeRelationship>();
  private readonly outgoing = new Map<string, KnowledgeRelationship[]>();
  private readonly incoming = new Map<string, KnowledgeRelationship[]>();
  private readonly repository: GameDataRepository;

  constructor(repository: GameDataRepository) {
    this.repository = repository;
    this.build();
  }

  resolve(kind: GraphEntityKind, slug: string): GraphEntityRef | null {
    return this.nodes.get(entityKey({ kind, slug })) ?? null;
  }

  getRelations(entity: GraphEntityRef): readonly KnowledgeRelationship[] {
    const key = entityKey(entity);
    return uniqueRelationships([
      ...(this.outgoing.get(key) ?? []),
      ...(this.incoming.get(key) ?? []),
    ]);
  }

  getRequirements(entity: GraphEntityRef): readonly KnowledgeRelationship[] {
    return (this.outgoing.get(entityKey(entity)) ?? []).filter((relationship) =>
      REQUIREMENT_PREDICATES.has(relationship.predicate),
    );
  }

  getDependencies(entity: GraphEntityRef, maxDepth = 8): GraphTraversal {
    const boundedDepth = Math.min(32, Math.max(0, Math.floor(maxDepth)));
    const maximumNodes = 5_000;
    const maximumRelationships = 10_000;
    const nodes = new Map<string, GraphEntityRef>([[entityKey(entity), entity]]);
    const relationships = new Map<string, KnowledgeRelationship>();
    const cycles = new Set<string>();
    let truncated = false;
    const walk = (current: GraphEntityRef, depth: number, lineage: readonly string[]) => {
      if (depth >= boundedDepth) return;
      const forward = (this.outgoing.get(entityKey(current)) ?? []).filter((relationship) =>
        DEPENDENCY_PREDICATES.has(relationship.predicate),
      );
      const producingRecipes =
        current.kind === 'item'
          ? (this.incoming.get(entityKey(current)) ?? []).filter(
              (relationship) => relationship.predicate === 'recipe_produces_item',
            )
          : [];
      for (const relationship of [...forward, ...producingRecipes]) {
        if (nodes.size >= maximumNodes || relationships.size >= maximumRelationships) {
          truncated = true;
          return;
        }
        relationships.set(relationship.id, relationship);
        const target = producingRecipes.includes(relationship)
          ? relationship.from
          : relationship.to;
        const targetKey = entityKey(target);
        nodes.set(targetKey, target);
        if (lineage.includes(targetKey)) {
          cycles.add([...lineage, targetKey].join(' → '));
          continue;
        }
        walk(target, depth + 1, [...lineage, targetKey]);
      }
    };
    walk(entity, 0, [entityKey(entity)]);
    return {
      root: entity,
      nodes: [...nodes.values()],
      relationships: [...relationships.values()],
      cycles: [...cycles],
      truncated,
    };
  }

  getAlternatives(entity: GraphEntityRef): readonly KnowledgeRelationship[] {
    if (entity.kind === 'pokemon') return this.pokemonAlternatives(entity);
    if (entity.kind === 'item') return this.itemAlternatives(entity);
    if (entity.kind === 'automation') return this.automationAlternatives(entity);
    return [];
  }

  getSynergies(): readonly KnowledgeRelationship[] {
    // The current snapshot has no reviewed synergy predicate. Returning no relation is safer than
    // converting co-occurrence or shared links into gameplay synergy.
    return [];
  }

  getRelevantTowns(entity: GraphEntityRef): readonly GraphEntityRef[] {
    return uniqueEntities(
      this.getRelations(entity)
        .filter(
          (relationship) => relationship.from.kind === 'town' || relationship.to.kind === 'town',
        )
        .map((relationship) =>
          relationship.from.kind === 'town' ? relationship.from : relationship.to,
        ),
    );
  }

  getRelevantPokemon(entity: GraphEntityRef): readonly GraphEntityRef[] {
    return uniqueEntities(
      this.getRelations(entity)
        .filter(
          (relationship) =>
            relationship.from.kind === 'pokemon' || relationship.to.kind === 'pokemon',
        )
        .map((relationship) =>
          relationship.from.kind === 'pokemon' ? relationship.from : relationship.to,
        ),
    );
  }

  getEffects(entity: GraphEntityRef): readonly GraphEntityRef[] {
    return uniqueEntities(
      (this.outgoing.get(entityKey(entity)) ?? [])
        .filter((relationship) => relationship.to.kind === 'effect')
        .map((relationship) => relationship.to),
    );
  }

  getEvidence(entity: GraphEntityRef): readonly RelationshipEvidence[] {
    return [
      ...new Map(
        this.getRelations(entity)
          .flatMap((relationship) => relationship.evidence)
          .map((evidence) => [`${evidence.source.url}:${evidence.statement}`, evidence]),
      ).values(),
    ];
  }

  classifyOrphans(): readonly ClassifiedOrphan[] {
    return [...this.nodes.values()]
      .filter((entity) => this.getRelations(entity).length === 0)
      .map((entity): ClassifiedOrphan => {
        if (entity.kind === 'pokemon') {
          const pokemon = this.repository
            .listPokemon(10_000)
            .find((entry) => entry.slug === entity.slug);
          if (pokemon?.specialty || pokemon?.habitat)
            return {
              entity,
              classification: 'POSSIBLE_DATA_BUG',
              rationale:
                'La ficha contiene specialty o hábitat pero no produjo una relación semántica.',
              source: pokemon.source,
            };
          return {
            entity,
            classification: 'INSUFFICIENT_DATA',
            rationale:
              'No hay specialty, hábitat, localización ni relación estructurada suficiente.',
            source: pokemon?.source ?? null,
          };
        }
        if (entity.kind === 'item') {
          const summary = this.repository
            .listItems(10_000)
            .find((entry) => entry.slug === entity.slug);
          if (summary?.craftable === true)
            return {
              entity,
              classification: 'MISSING_RELATION_PARSER',
              rationale:
                'El objeto figura como craftable pero no enlaza con una receta estructurada.',
              source: summary.source,
            };
          if (summary?.automationRelevance === 'direct')
            return {
              entity,
              classification: 'MISSING_RELATION_TYPE',
              rationale:
                'La ficha declara relevancia directa de automatización sin predicado tipado.',
              source: summary.source,
            };
          if (!summary?.description && !summary?.locations)
            return {
              entity,
              classification: 'INSUFFICIENT_DATA',
              rationale: 'La ficha carece de descripción y localización estructuradas.',
              source: summary?.source ?? null,
            };
          return {
            entity,
            classification: 'LEGITIMATELY_ISOLATED',
            rationale:
              'Objeto catalogado sin requisito, output, automatización o relación gameplay documentada.',
            source: summary.source,
          };
        }
        return {
          entity,
          classification: 'POSSIBLE_DATA_BUG',
          rationale: `Una entidad ${entity.kind} principal no debería quedar aislada tras construir el grafo.`,
          source: null,
        };
      })
      .sort(
        (left, right) =>
          left.classification.localeCompare(right.classification) ||
          left.entity.name.localeCompare(right.entity.name),
      );
  }

  quality(): SemanticRelationshipQuality {
    const raw = this.repository.relationshipAudit();
    const semanticPredicates = countBy(
      [...this.relationships.values()].map((relationship) => relationship.predicate),
    );
    const relationshipClasses = countBy(
      [...this.relationships.values()].map((relationship) => relationship.relationshipClass),
    ) as Readonly<Record<RelationshipClass, number>>;
    return {
      rawDocumentRelationships: raw.total,
      rawTypes: raw.types,
      rawSelfLinks: raw.selfLinks,
      rawOrphans: raw.orphanSources + raw.orphanTargets,
      rawAmbiguousLinks: raw.ambiguousDocumentLinks,
      semanticRelationships: this.relationships.size,
      semanticPredicates,
      relationshipClasses,
    };
  }

  private build() {
    const pokemon = this.repository.listPokemon(10_000);
    const items = this.repository.listItems(10_000);
    const recipes = this.repository.listRecipes(10_000);
    const towns = this.repository.listTowns();
    const automation = this.repository.listAutomationSystems();
    const quests = this.repository.listQuests();
    const treasureMaps = this.repository.listTreasureMaps();
    const collectibles = this.repository.listCollectibles();
    const dittoMoves = this.repository.listDittoMoves();
    const recipeSlugs = new Set(recipes.map((recipe) => recipe.slug));
    const pokemonByName = new Map(pokemon.map((entry) => [normalize(entry.name), entry]));
    const townsByName = new Map(towns.map((entry) => [normalize(entry.name), entry]));

    for (const entry of pokemon) {
      const pokemonNode = this.node('pokemon', entry.slug, entry.name);
      for (const assignment of entry.roles) {
        const role = this.node('role', assignment.role, roleLabel(assignment.role));
        this.add({
          from: pokemonNode,
          predicate: 'pokemon_performs_role',
          to: role,
          relationshipClass: 'derived_fact',
          confidence: confidenceFromNumber(assignment.confidence),
          evidenceCoverage: 'partial',
          evidence: [{ statement: assignment.evidence, source: assignment.source }],
          derivationMethod: assignment.derivationMethod,
        });
      }
      if (entry.habitat) {
        this.add({
          from: pokemonNode,
          predicate: 'pokemon_prefers_habitat',
          to: this.node('habitat', slugify(entry.habitat), entry.habitat),
          relationshipClass: 'direct_fact',
          confidence: 'medium',
          evidenceCoverage: 'complete',
          evidence: [
            { statement: `Structured ideal habitat: ${entry.habitat}`, source: entry.source },
          ],
          derivationMethod: null,
        });
      }
      const detail = this.repository.getPokemon(entry.slug);
      for (const location of detail?.locations ?? []) {
        this.add({
          from: pokemonNode,
          predicate: 'pokemon_found_at',
          to: this.node('location', slugify(location), location),
          relationshipClass: 'direct_fact',
          confidence: 'medium',
          evidenceCoverage: 'partial',
          evidence: [{ statement: `Location link: ${location}`, source: entry.source }],
          derivationMethod: null,
        });
      }
    }

    for (const item of items) this.node('item', item.slug, item.name);

    for (const recipe of recipes) {
      const recipeNode = this.node('recipe', recipe.slug, recipe.name);
      const itemNode = this.node('item', recipe.slug, recipe.name);
      this.add({
        from: recipeNode,
        predicate: 'recipe_produces_item',
        to: itemNode,
        relationshipClass: 'direct_fact',
        confidence: 'medium',
        evidenceCoverage: 'complete',
        evidence: [{ statement: `Recipe output: ${recipe.name}`, source: recipe.source }],
        derivationMethod: null,
      });
      for (const ingredient of recipe.ingredients) {
        const craftableIngredient = recipeSlugs.has(ingredient.slug);
        this.add({
          from: recipeNode,
          predicate: craftableIngredient ? 'recipe_requires_item' : 'recipe_requires_material',
          to: this.node(
            craftableIngredient ? 'item' : 'material',
            ingredient.slug,
            ingredient.name,
          ),
          relationshipClass: 'direct_fact',
          confidence: ingredient.quantity === null ? 'low' : 'medium',
          evidenceCoverage: ingredient.quantity === null ? 'partial' : 'complete',
          evidence: [
            {
              statement: `${ingredient.name} × ${ingredient.quantity ?? 'unknown quantity'}`,
              source: recipe.source,
            },
          ],
          derivationMethod: null,
        });
      }
      this.addUnlockRelationships(recipeNode, recipe.unlock, recipe.source, townsByName);
    }

    for (const townSummary of towns) {
      const town = this.repository.getTown(townSummary.slug);
      if (!town) continue;
      const townNode = this.node('town', town.slug, town.name);
      for (const name of town.exclusivePokemon) {
        const found = pokemonByName.get(normalize(name));
        if (!found) continue;
        this.add({
          from: townNode,
          predicate: 'town_lists_exclusive_pokemon',
          to: this.node('pokemon', found.slug, found.name),
          relationshipClass: 'direct_fact',
          confidence: 'medium',
          evidenceCoverage: 'complete',
          evidence: [{ statement: `Listed in Exclusive Pokémon: ${name}`, source: town.source }],
          derivationMethod: null,
        });
      }
      for (const resource of town.resources) {
        this.add({
          from: townNode,
          predicate: 'town_has_resource',
          to: this.node('resource', slugify(resource), resource),
          relationshipClass: 'direct_fact',
          confidence: 'medium',
          evidenceCoverage: 'complete',
          evidence: [{ statement: `Resource table: ${resource}`, source: town.source }],
          derivationMethod: null,
        });
      }
      for (const facility of town.facilities) {
        this.add({
          from: townNode,
          predicate: 'town_has_facility',
          to: this.node('facility', slugify(facility), facility),
          relationshipClass: 'direct_fact',
          confidence: 'medium',
          evidenceCoverage: 'complete',
          evidence: [{ statement: `Facility table: ${facility}`, source: town.source }],
          derivationMethod: null,
        });
      }
      for (const unlock of town.unlocks) {
        this.add({
          from: townNode,
          predicate: unlock.kind === 'recipe' ? 'town_unlocks_recipe' : 'town_unlocks_item',
          to: this.node(unlock.kind, slugify(unlock.name), unlock.name),
          relationshipClass: 'direct_fact',
          confidence: 'medium',
          evidenceCoverage: 'complete',
          evidence: [
            { statement: `Environment Level ${unlock.level}: ${unlock.name}`, source: town.source },
          ],
          derivationMethod: null,
        });
      }
    }

    for (const system of automation) this.addAutomation(system, townsByName);

    for (const quest of quests) this.node('quest', quest.slug, quest.name);

    for (const map of treasureMaps) {
      const mapNode = this.node('treasure_map', map.slug, map.name);
      for (const requirement of map.requirements)
        this.add({
          from: mapNode,
          predicate:
            requirement.kind === 'item'
              ? 'treasure_map_requires_item'
              : 'treasure_map_requires_specialty',
          to: this.node(requirement.kind, requirement.slug, requirement.name),
          relationshipClass: 'direct_fact',
          confidence: 'high',
          evidenceCoverage: 'complete',
          evidence: [
            {
              statement: `Treasure Map common requirement: ${requirement.name}`,
              source: map.source,
            },
          ],
          derivationMethod: null,
        });
      this.add({
        from: mapNode,
        predicate: 'treasure_map_rewards_item',
        to: this.node('item', map.reward.slug, map.reward.name),
        relationshipClass: 'direct_fact',
        confidence: 'high',
        evidenceCoverage: 'complete',
        evidence: [{ statement: map.location, source: map.source }],
        derivationMethod: null,
      });
      if (map.recipeUnlock)
        this.add({
          from: mapNode,
          predicate: 'treasure_map_unlocks_recipe',
          to: this.node('recipe', map.recipeUnlock.slug, map.recipeUnlock.name),
          relationshipClass: 'direct_fact',
          confidence: 'high',
          evidenceCoverage: 'complete',
          evidence: [
            {
              statement:
                'After first obtaining the treasure, its recipe appears in daily shop specials.',
              source: map.source,
            },
          ],
          derivationMethod: null,
        });
    }

    for (const collectible of collectibles)
      this.node('collectible', collectible.slug, collectible.name);

    for (const move of dittoMoves) {
      const moveNode = this.node('ditto_move', move.slug, move.name);
      for (const pokemonName of move.learnedFromPokemon) {
        const pokemon = pokemonByName.get(normalize(pokemonName));
        if (!pokemon) continue;
        this.add({
          from: moveNode,
          predicate: 'ditto_move_learned_from_pokemon',
          to: this.node('pokemon', pokemon.slug, pokemon.name),
          relationshipClass: 'direct_fact',
          confidence: 'high',
          evidenceCoverage: 'complete',
          evidence: [{ statement: move.unlock, source: move.source }],
          derivationMethod: null,
        });
      }
    }
  }

  private addAutomation(
    system: AutomationSystem,
    townsByName: ReadonlyMap<string, { slug: string; name: string }>,
  ) {
    const automation = this.node('automation', system.slug, system.name);
    const item = this.node('item', system.slug, system.name);
    this.add({
      from: item,
      predicate: 'item_participates_in_automation',
      to: automation,
      relationshipClass: 'derived_fact',
      confidence: 'medium',
      evidenceCoverage: 'partial',
      evidence: [{ statement: system.what, source: system.source }],
      derivationMethod: 'automation_behavior_v2',
    });
    for (const requirement of system.requirements) {
      this.add({
        from: automation,
        predicate: 'automation_requires_item',
        to: this.node('material', requirement.slug, requirement.name),
        relationshipClass: 'direct_fact',
        confidence: requirement.quantity === null ? 'low' : 'medium',
        evidenceCoverage: requirement.quantity === null ? 'partial' : 'complete',
        evidence: [
          {
            statement: `${requirement.name} × ${requirement.quantity ?? 'unknown quantity'}`,
            source: system.source,
          },
        ],
        derivationMethod: null,
      });
    }
    for (const infrastructure of system.infrastructure ?? [])
      this.addMechanic(
        automation,
        'automation_requires_infrastructure',
        'infrastructure',
        infrastructure,
        system,
      );
    for (const input of system.operationalInputs ?? [])
      this.addMechanic(automation, 'automation_accepts_input', 'resource', input, system);
    for (const output of system.operationalOutputs ?? [])
      this.addMechanic(automation, 'automation_produces_output', 'effect', output, system);
    for (const townName of system.compatibleTowns) {
      const town = townsByName.get(normalize(townName));
      if (!town) continue;
      this.add({
        from: automation,
        predicate: 'automation_compatible_with_town',
        to: this.node('town', town.slug, town.name),
        relationshipClass: 'derived_fact',
        confidence: 'low',
        evidenceCoverage: 'partial',
        evidence: [
          {
            statement: `Town inferred from unlock or item location: ${townName}`,
            source: system.source,
          },
        ],
        derivationMethod: 'unlock_or_location_town_v1',
      });
    }
    this.addUnlockRelationships(automation, system.unlock, system.source, townsByName);
  }

  private addMechanic(
    from: GraphEntityRef,
    predicate: RelationshipPredicate,
    kind: GraphEntityKind,
    value: string,
    system: AutomationSystem,
  ) {
    this.add({
      from,
      predicate,
      to: this.node(kind, slugify(value), value),
      relationshipClass: 'derived_fact',
      confidence: 'medium',
      evidenceCoverage: 'partial',
      evidence: [{ statement: system.what, source: system.source }],
      derivationMethod: 'automation_description_v2',
    });
  }

  private addUnlockRelationships(
    entity: GraphEntityRef,
    unlock: string | null,
    source: SourceEvidence,
    townsByName: ReadonlyMap<string, { slug: string; name: string }>,
  ) {
    if (!unlock) return;
    const match = unlock.match(/Shop(?:\s*\(as bundle\))?\s*-\s*(.+?)\s+Lv\.\s*(\d+)/i);
    if (!match?.[1] || !match[2]) return;
    const town = townsByName.get(normalize(match[1]));
    if (town) {
      this.add({
        from: this.node('town', town.slug, town.name),
        predicate: entity.kind === 'recipe' ? 'town_unlocks_recipe' : 'town_unlocks_item',
        to: entity,
        relationshipClass: 'derived_fact',
        confidence: 'medium',
        evidenceCoverage: 'complete',
        evidence: [{ statement: unlock, source }],
        derivationMethod: 'shop_unlock_parser_v1',
      });
    }
    this.add({
      from: entity,
      predicate: 'entity_requires_unlock_level',
      to: this.node(
        'requirement',
        `${town?.slug ?? slugify(match[1])}-level-${match[2]}`,
        `${match[1]} · Level ${match[2]}`,
      ),
      relationshipClass: 'derived_fact',
      confidence: 'medium',
      evidenceCoverage: 'complete',
      evidence: [{ statement: unlock, source }],
      derivationMethod: 'shop_unlock_parser_v1',
    });
  }

  private pokemonAlternatives(entity: GraphEntityRef): readonly KnowledgeRelationship[] {
    const sourceRoles = new Set(
      (this.outgoing.get(entityKey(entity)) ?? [])
        .filter((relationship) => relationship.predicate === 'pokemon_performs_role')
        .map((relationship) => relationship.to.slug),
    );
    if (!sourceRoles.size) return [];
    return [...this.nodes.values()]
      .filter((candidate) => candidate.kind === 'pokemon' && candidate.slug !== entity.slug)
      .map((candidate) => {
        const candidateRoles = (this.outgoing.get(entityKey(candidate)) ?? [])
          .filter((relationship) => relationship.predicate === 'pokemon_performs_role')
          .map((relationship) => relationship.to.slug);
        const overlap = candidateRoles.filter((role) => sourceRoles.has(role));
        return { candidate, overlap };
      })
      .filter(({ overlap }) => overlap.length > 0)
      .sort(
        (left, right) =>
          right.overlap.length - left.overlap.length ||
          left.candidate.name.localeCompare(right.candidate.name),
      )
      .slice(0, 8)
      .map(({ candidate, overlap }) =>
        recommendationRelationship(entity, candidate, `Roles compartidos: ${overlap.join(', ')}`),
      );
  }

  private itemAlternatives(entity: GraphEntityRef): readonly KnowledgeRelationship[] {
    const source = this.repository.getItem(entity.slug);
    if (!source?.storage) return [];
    const candidates: KnowledgeRelationship[] = [];
    for (const item of this.repository.listItems(10_000)) {
      if (item.slug === entity.slug || item.isContainer !== true) continue;
      const detail = this.repository.getItem(item.slug);
      if (!detail?.storage) continue;
      candidates.push(
        recommendationRelationship(
          entity,
          this.node('item', item.slug, item.name),
          detail.storage.type === source.storage.type
            ? `Mismo tipo de almacenamiento: ${detail.storage.type}`
            : `Alternativa de almacenamiento ${detail.storage.type}`,
        ),
      );
      if (candidates.length >= 8) break;
    }
    return candidates;
  }

  private automationAlternatives(entity: GraphEntityRef): readonly KnowledgeRelationship[] {
    const outputs = new Set(
      (this.outgoing.get(entityKey(entity)) ?? [])
        .filter((relationship) => relationship.predicate === 'automation_produces_output')
        .map((relationship) => relationship.to.slug),
    );
    if (!outputs.size) return [];
    return [...this.nodes.values()]
      .filter((candidate) => candidate.kind === 'automation' && candidate.slug !== entity.slug)
      .filter((candidate) =>
        (this.outgoing.get(entityKey(candidate)) ?? []).some(
          (relationship) =>
            relationship.predicate === 'automation_produces_output' &&
            outputs.has(relationship.to.slug),
        ),
      )
      .slice(0, 8)
      .map((candidate) =>
        recommendationRelationship(entity, candidate, 'Comparte un output operativo documentado.'),
      );
  }

  private node(kind: GraphEntityKind, slug: string, name: string): GraphEntityRef {
    const entity = { kind, slug: slugify(slug), name } as const;
    const key = entityKey(entity);
    const existing = this.nodes.get(key);
    if (existing) return existing;
    this.nodes.set(key, entity);
    return entity;
  }

  private add(
    input: Omit<KnowledgeRelationship, 'id' | 'gameVersion' | 'versionScope'> & {
      readonly gameVersion?: string | null;
      readonly versionScope?: KnowledgeRelationship['versionScope'];
    },
  ) {
    const id = `${entityKey(input.from)}:${input.predicate}:${entityKey(input.to)}`;
    const existing = this.relationships.get(id);
    if (existing) {
      const merged: KnowledgeRelationship = {
        ...existing,
        evidence: uniqueEvidence([...existing.evidence, ...input.evidence]),
        confidence: strongerConfidence(existing.confidence, input.confidence),
        evidenceCoverage:
          existing.evidenceCoverage === 'complete' || input.evidenceCoverage === 'complete'
            ? 'complete'
            : existing.evidenceCoverage === 'partial' || input.evidenceCoverage === 'partial'
              ? 'partial'
              : 'unknown',
      };
      this.relationships.set(id, merged);
      this.outgoing.set(
        entityKey(input.from),
        (this.outgoing.get(entityKey(input.from)) ?? []).map((entry) =>
          entry.id === id ? merged : entry,
        ),
      );
      this.incoming.set(
        entityKey(input.to),
        (this.incoming.get(entityKey(input.to)) ?? []).map((entry) =>
          entry.id === id ? merged : entry,
        ),
      );
      return;
    }
    const relationship: KnowledgeRelationship = {
      ...input,
      id,
      gameVersion: input.gameVersion ?? null,
      versionScope: input.versionScope ?? (input.gameVersion ? 'specific' : 'unknown'),
    };
    this.relationships.set(id, relationship);
    const outgoing = this.outgoing.get(entityKey(input.from)) ?? [];
    outgoing.push(relationship);
    this.outgoing.set(entityKey(input.from), outgoing);
    const incoming = this.incoming.get(entityKey(input.to)) ?? [];
    incoming.push(relationship);
    this.incoming.set(entityKey(input.to), incoming);
  }
}

function recommendationRelationship(
  from: GraphEntityRef,
  to: GraphEntityRef,
  statement: string,
): KnowledgeRelationship {
  return {
    id: `${entityKey(from)}:alternative_to:${entityKey(to)}`,
    from,
    predicate: 'alternative_to',
    to,
    relationshipClass: 'recommendation',
    confidence: 'low',
    evidenceCoverage: 'partial',
    evidence: [],
    gameVersion: null,
    versionScope: 'unknown',
    derivationMethod: statement,
  };
}

function confidenceFromNumber(value: number): ConfidenceLevel {
  if (value >= 0.9) return 'high';
  if (value >= 0.75) return 'medium';
  return value > 0 ? 'low' : 'unknown';
}

function entityKey(entity: Pick<GraphEntityRef, 'kind' | 'slug'>): string {
  return `${entity.kind}:${slugify(entity.slug)}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalize(value: string): string {
  return slugify(value).replaceAll('-', ' ');
}

function roleLabel(role: RoleSlug): string {
  return role.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function uniqueEntities(values: readonly GraphEntityRef[]): GraphEntityRef[] {
  return [...new Map(values.map((value) => [entityKey(value), value])).values()];
}

function uniqueRelationships(values: readonly KnowledgeRelationship[]): KnowledgeRelationship[] {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

function uniqueEvidence(values: readonly RelationshipEvidence[]): RelationshipEvidence[] {
  return [
    ...new Map(values.map((value) => [`${value.source.url}:${value.statement}`, value])).values(),
  ];
}

function strongerConfidence(left: ConfidenceLevel, right: ConfidenceLevel): ConfidenceLevel {
  const order: readonly ConfidenceLevel[] = ['unknown', 'low', 'medium', 'high'];
  return order[Math.max(order.indexOf(left), order.indexOf(right))] ?? left;
}

function countBy<T extends string>(values: readonly T[]): Readonly<Record<T, number>> {
  const counts = {} as Record<T, number>;
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}
