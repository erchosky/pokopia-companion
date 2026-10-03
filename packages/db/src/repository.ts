import type {
  CanonicalEntity,
  EntityKind,
  EntityRepository,
  ReadContext,
  SearchHit,
  SearchQuery,
  SearchRepository,
  UUID,
} from '@pokopia/domain';
import type { SqlExecutor } from './sql.js';

interface EntityRow extends Record<string, unknown> {
  id: UUID;
  game_id: UUID;
  kind: EntityKind;
  slug: string;
  display_name: string;
  summary: string | null;
  introduced_version_id: UUID | null;
  removed_version_id: UUID | null;
}

function mapEntity(row: EntityRow): CanonicalEntity {
  return {
    id: row.id,
    gameId: row.game_id,
    kind: row.kind,
    slug: row.slug,
    displayName: row.display_name,
    summary: row.summary,
    introducedVersionId: row.introduced_version_id,
    removedVersionId: row.removed_version_id,
  };
}

const entityColumns = `
  e.id, e.game_id, e.kind, e.slug, e.display_name, e.summary,
  e.introduced_version_id, e.removed_version_id`;

function effectiveClause(versionParameter: number): string {
  return `(
    $${versionParameter}::uuid is null or (
      (e.introduced_version_id is null or introduced.ordinal <= target.ordinal) and
      (e.removed_version_id is null or removed.ordinal > target.ordinal)
    )
  )`;
}

export class PostgresEntityRepository implements EntityRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async getById(id: UUID, context: ReadContext): Promise<CanonicalEntity | null> {
    const result = await this.sql.query<EntityRow>(
      `
      select ${entityColumns}
      from public.entities e
      left join public.game_versions introduced on introduced.id = e.introduced_version_id
      left join public.game_versions removed on removed.id = e.removed_version_id
      left join public.game_versions target on target.id = $3
      where e.id = $1 and e.game_id = $2 and ${effectiveClause(3)}
      limit 1`,
      [id, context.gameId, context.asOfVersionId ?? null],
    );
    const row = result.rows[0];
    return row ? mapEntity(row) : null;
  }

  public async getBySlug(slug: string, context: ReadContext): Promise<CanonicalEntity | null> {
    const result = await this.sql.query<EntityRow>(
      `
      select ${entityColumns}
      from public.entities e
      left join public.game_versions introduced on introduced.id = e.introduced_version_id
      left join public.game_versions removed on removed.id = e.removed_version_id
      left join public.game_versions target on target.id = $3
      where e.slug = $1 and e.game_id = $2 and ${effectiveClause(3)}
      order by e.kind
      limit 1`,
      [slug, context.gameId, context.asOfVersionId ?? null],
    );
    const row = result.rows[0];
    return row ? mapEntity(row) : null;
  }

  public async listByKind(
    kind: EntityKind,
    context: ReadContext,
  ): Promise<readonly CanonicalEntity[]> {
    const result = await this.sql.query<EntityRow>(
      `
      select ${entityColumns}
      from public.entities e
      left join public.game_versions introduced on introduced.id = e.introduced_version_id
      left join public.game_versions removed on removed.id = e.removed_version_id
      left join public.game_versions target on target.id = $3
      where e.kind = $1 and e.game_id = $2 and ${effectiveClause(3)}
      order by e.display_name, e.id`,
      [kind, context.gameId, context.asOfVersionId ?? null],
    );
    return result.rows.map(mapEntity);
  }
}

interface SearchRow extends EntityRow {
  rank: number | string;
  matched_text: string;
}

export class PostgresSearchRepository implements SearchRepository {
  public constructor(private readonly sql: SqlExecutor) {}

  public async search(query: SearchQuery, context: ReadContext) {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const result = await this.sql.query<SearchRow>(
      `
      select ${entityColumns},
        ts_rank_cd(s.document, websearch_to_tsquery('simple', $1)) as rank,
        s.title as matched_text
      from public.search_entries s
      join public.entities e on e.id = s.entity_id
      left join public.game_versions introduced on introduced.id = e.introduced_version_id
      left join public.game_versions removed on removed.id = e.removed_version_id
      left join public.game_versions target on target.id = $4
      where e.game_id = $2
        and ($3::public.entity_kind[] is null or e.kind = any($3))
        and s.document @@ websearch_to_tsquery('simple', $1)
        and ${effectiveClause(4)}
      order by rank desc, e.display_name, e.id
      limit $5`,
      [query.text, context.gameId, query.kinds ?? null, context.asOfVersionId ?? null, limit],
    );
    const items: SearchHit[] = result.rows.map((row) => ({
      entity: mapEntity(row),
      rank: Number(row.rank),
      matchedText: row.matched_text,
    }));
    return { items, nextCursor: null };
  }
}
