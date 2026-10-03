import type {
  Assertion,
  CanonicalEntity,
  Page,
  PokemonSummary,
  SearchHit,
  SearchQuery,
  TownSummary,
  UserProgress,
  UUID,
} from './model.js';

export interface ReadContext {
  readonly gameId: UUID;
  readonly asOfVersionId?: UUID;
}

export interface EntityRepository {
  getById(id: UUID, context: ReadContext): Promise<CanonicalEntity | null>;
  getBySlug(slug: string, context: ReadContext): Promise<CanonicalEntity | null>;
  listByKind(
    kind: CanonicalEntity['kind'],
    context: ReadContext,
  ): Promise<readonly CanonicalEntity[]>;
}

export interface PokemonRepository {
  getById(id: UUID, context: ReadContext): Promise<PokemonSummary | null>;
  getBySlug(slug: string, context: ReadContext): Promise<PokemonSummary | null>;
}

export interface TownRepository {
  getById(id: UUID, context: ReadContext): Promise<TownSummary | null>;
  getBySlug(slug: string, context: ReadContext): Promise<TownSummary | null>;
}

export interface KnowledgeRepository {
  getAssertions(subjectEntityId: UUID, context: ReadContext): Promise<readonly Assertion[]>;
  getAssertionHistory(subjectEntityId: UUID, predicate: string): Promise<readonly Assertion[]>;
}

export interface SearchRepository {
  search(query: SearchQuery, context: ReadContext): Promise<Page<SearchHit>>;
}

export interface UserStateRepository {
  getProgress(userId: UUID, entityId: UUID): Promise<UserProgress | null>;
  saveProgress(progress: UserProgress): Promise<void>;
}

export interface UnitOfWork {
  readonly entities: EntityRepository;
  readonly pokemon: PokemonRepository;
  readonly towns: TownRepository;
  readonly knowledge: KnowledgeRepository;
  readonly search: SearchRepository;
  readonly userState: UserStateRepository;
  transaction<T>(work: (repositories: UnitOfWork) => Promise<T>): Promise<T>;
}
