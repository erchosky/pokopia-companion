export type EntityKind =
  | 'pokemon'
  | 'item'
  | 'recipe'
  | 'town'
  | 'ability'
  | 'automation'
  | 'quest'
  | 'treasure_map'
  | 'collectible'
  | 'ditto_move'
  | 'location'
  | 'page';

export type ContentScope = 'base_game' | 'expansion' | 'unknown';
export type ClassificationStatus = 'verified' | 'candidate' | 'unknown';

export interface ContentClassification {
  readonly scope: ContentScope;
  readonly status: ClassificationStatus;
  readonly reason: string;
  readonly source: SourceEvidence;
}

export interface ContentFilter {
  readonly scope?: ContentScope | 'all';
}

export type RoleSlug =
  | 'construction'
  | 'farming'
  | 'watering'
  | 'harvesting'
  | 'electricity'
  | 'power'
  | 'production'
  | 'resource-generation'
  | 'mining'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'cooking'
  | 'food'
  | 'storage'
  | 'logistics'
  | 'transport'
  | 'exploration'
  | 'town-progression'
  | 'automation'
  | 'decoration'
  | 'building'
  | 'utility'
  | 'specialist';

export interface SourceEvidence {
  readonly url: string;
  readonly title: string;
  readonly snapshot: string;
  readonly verificationStatus: 'unverified' | 'confirmed' | 'unknown';
}

export interface RoleAssignment {
  readonly role: RoleSlug;
  readonly evidence: string;
  readonly confidence: number;
  readonly derivationMethod: 'specialty_mapping_v1';
  readonly gameVersion: string | null;
  readonly source: SourceEvidence;
}

export interface PokemonSummary {
  readonly kind: 'pokemon';
  readonly slug: string;
  readonly name: string;
  readonly number: number | null;
  readonly specialty: string | null;
  readonly habitat: string | null;
  readonly roles: readonly RoleAssignment[];
  readonly source: SourceEvidence;
}

export interface PokemonDetail extends PokemonSummary {
  readonly classification: string | null;
  readonly height: string | null;
  readonly weight: string | null;
  readonly favorites: readonly string[];
  readonly canDive: boolean | null;
  readonly locations: readonly string[];
  readonly habitatTypes: readonly string[];
  readonly rawFacts: readonly { key: string; value: string }[];
}

export interface ItemSummary {
  readonly kind: 'item';
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly locations: string | null;
  readonly category: string | null;
  readonly craftable: boolean | null;
  readonly isFurniture: boolean | null;
  readonly isContainer: boolean | null;
  readonly dlc: boolean | null;
  readonly automationRelevance: 'direct' | 'related' | 'unknown';
  readonly source: SourceEvidence;
}

export interface StorageProfile {
  readonly type: 'shared' | 'local' | 'unknown';
  readonly capacity: number | null;
  readonly evidence: string | null;
}

export interface ItemDetail extends ItemSummary {
  readonly requirements: string | null;
  readonly tradeValue: string | null;
  readonly printCost: string | null;
  readonly favoriteCategories: readonly string[];
  readonly paintable: boolean | null;
  readonly locationEntries: readonly string[];
  readonly recipe: RecipeSummary | null;
  readonly storage: StorageProfile | null;
  readonly useCases: readonly string[];
}

export interface RecipeIngredient {
  readonly name: string;
  readonly slug: string;
  readonly quantity: number | null;
}

export interface RecipeSummary {
  readonly kind: 'recipe';
  readonly slug: string;
  readonly name: string;
  readonly unlock: string | null;
  readonly ingredients: readonly RecipeIngredient[];
  readonly outputQuantity: number | null;
  readonly outputQuantityStatus:
    'source_backed' | 'accepted_measurement' | 'derived_default' | 'unknown';
  readonly station: string | null;
  readonly source: SourceEvidence;
}

export interface QuantitativeParameter {
  readonly id: string;
  readonly subjectKind: 'automation_system' | 'game_rule' | 'world_mechanic' | 'storage_system';
  readonly subjectSlug: string;
  readonly predicate: string;
  readonly value: number;
  readonly unit:
    'power_unit' | 'block' | 'connection' | 'item' | 'pokemon' | 'hour' | 'day' | 'tile';
  readonly qualifier: string | null;
  readonly derivation: 'source_fact' | 'mathematical_derived';
  readonly parentAssertionIds: readonly string[];
  readonly locator: string;
  readonly evidenceText: string;
  readonly parserConfidence: number;
  readonly evidenceConfidence: number;
  readonly sourceVerificationStatus: 'unverified' | 'confirmed';
  readonly assertionStatus: 'accepted' | 'candidate' | 'disputed';
  readonly contentScope: ContentScope;
  readonly gameVersion: string | null;
  readonly source: SourceEvidence;
}

export interface TownUnlock {
  readonly name: string;
  readonly level: number;
  readonly kind: 'recipe' | 'item';
}

export interface TownSummary {
  readonly kind: 'town';
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly maxEnvironmentLevel: number | null;
  readonly source: SourceEvidence;
}

export interface TownDetail extends TownSummary {
  readonly exclusivePokemon: readonly string[];
  readonly resources: readonly string[];
  readonly plantsAndBlocks: readonly string[];
  readonly facilities: readonly string[];
  readonly treasure: readonly string[];
  readonly unlocks: readonly TownUnlock[];
}

export interface AutomationSystem {
  readonly kind: 'automation';
  readonly slug: string;
  readonly name: string;
  readonly what: string;
  readonly why: string;
  readonly requirements: readonly RecipeIngredient[];
  readonly pokemon: readonly string[] | null;
  readonly infrastructure: readonly string[] | null;
  readonly operationalInputs: readonly string[] | null;
  readonly operationalOutputs: readonly string[] | null;
  readonly unlock: string | null;
  readonly compatibleTowns: readonly string[];
  readonly limitations: readonly string[];
  readonly knownState: 'source_backed' | 'derived';
  readonly contentScope: ContentScope;
  readonly gameVersion: string | null;
  readonly quantitative: readonly QuantitativeParameter[];
  readonly source: SourceEvidence;
}

export interface QuestStep {
  readonly order: number;
  readonly description: string;
  readonly requirement: string | null;
}

export interface QuestSummary {
  readonly kind: 'quest';
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly QuestStep[];
  readonly repeatable: boolean | null;
  readonly rewards: readonly string[];
  readonly unlocks: readonly string[];
  readonly classification: ContentClassification;
  readonly source: SourceEvidence;
}

export type QuestDetail = QuestSummary;

export interface TreasureMapSummary {
  readonly kind: 'treasure_map';
  readonly slug: string;
  readonly name: string;
  readonly number: number;
  readonly area: string;
  readonly location: string;
  readonly requirements: readonly { name: string; slug: string; kind: 'item' | 'specialty' }[];
  readonly reward: { name: string; slug: string };
  readonly recipeUnlock: { name: string; slug: string } | null;
  readonly qualityWarnings: readonly string[];
  readonly classification: ContentClassification;
  readonly source: SourceEvidence;
}

export type TreasureMapDetail = TreasureMapSummary;

export interface CollectibleSummary {
  readonly kind: 'collectible';
  readonly collectibleType: 'music_cd';
  readonly slug: string;
  readonly name: string;
  readonly catalogNumber: number;
  readonly description: string;
  readonly locations: string;
  readonly originGame: string;
  readonly classification: ContentClassification;
  readonly source: SourceEvidence;
}

export type CollectibleDetail = CollectibleSummary;

export interface DittoMoveSummary {
  readonly kind: 'ditto_move';
  readonly slug: string;
  readonly name: string;
  readonly moveClass: 'primary' | 'secondary';
  readonly effect: string;
  readonly unlock: string;
  readonly learnedFromPokemon: readonly string[];
  readonly mealBoost: { meal: string; effect: string } | null;
  readonly classification: ContentClassification;
  readonly source: SourceEvidence;
}

export type DittoMoveDetail = DittoMoveSummary;

export interface CoverageEntry {
  readonly domain: string;
  readonly totalSource: number;
  readonly totalCanonicalized: number;
  readonly totalUnresolved: number;
  readonly coveragePercent: number | null;
  readonly basis: string;
}

export interface SearchRecord {
  readonly kind: EntityKind;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly url: string;
  readonly rank: number;
}

export interface DataHealth {
  readonly databasePath: string;
  readonly schema: 'legacy-snapshot' | 'canonical' | 'postgres-canonical' | 'unavailable';
  readonly snapshot: string;
  readonly pages: number;
  readonly facts: number;
  readonly relationships: number;
  readonly entities: Readonly<Record<string, number>>;
  readonly warnings: readonly string[];
}

export interface DocumentRelationshipAudit {
  readonly total: number;
  readonly types: Readonly<Record<string, number>>;
  readonly orphanSources: number;
  readonly orphanTargets: number;
  readonly selfLinks: number;
  readonly duplicateEdges: number;
  readonly semanticRelationships: number;
  readonly ambiguousDocumentLinks: number;
}

export interface GameDataRepository {
  health(): DataHealth;
  relationshipAudit(): DocumentRelationshipAudit;
  coverage(): readonly CoverageEntry[];
  listPokemon(limit?: number, offset?: number): readonly PokemonSummary[];
  getPokemon(slug: string): PokemonDetail | null;
  listItems(limit?: number, offset?: number): readonly ItemSummary[];
  getItem(slug: string): ItemDetail | null;
  listRecipes(limit?: number, offset?: number): readonly RecipeSummary[];
  getRecipe(slug: string): RecipeSummary | null;
  listTowns(): readonly TownSummary[];
  getTown(slug: string): TownDetail | null;
  listAutomationSystems(): readonly AutomationSystem[];
  listQuantitativeParameters(): readonly QuantitativeParameter[];
  listQuests(filter?: ContentFilter): readonly QuestSummary[];
  getQuest(slug: string): QuestDetail | null;
  listTreasureMaps(filter?: ContentFilter): readonly TreasureMapSummary[];
  getTreasureMap(slug: string): TreasureMapDetail | null;
  listCollectibles(filter?: ContentFilter): readonly CollectibleSummary[];
  getCollectible(slug: string): CollectibleDetail | null;
  listDittoMoves(filter?: ContentFilter): readonly DittoMoveSummary[];
  getDittoMove(slug: string): DittoMoveDetail | null;
  search(query: string, limit?: number): readonly SearchRecord[];
}
