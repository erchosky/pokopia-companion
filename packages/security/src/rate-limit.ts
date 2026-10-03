import { createHmac } from 'node:crypto';
import { Pool, type PoolConfig, type QueryResult } from 'pg';

export interface RateLimitPolicy {
  readonly id: string;
  readonly limit: number;
  readonly windowMs: number;
  readonly failClosed: boolean;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
  readonly reason: 'within-limit' | 'exceeded' | 'store-unavailable';
}

export interface RateLimitStore {
  consume(keyHash: string, policy: RateLimitPolicy, now: number): Promise<RateLimitDecision>;
  reset(keyHash: string): Promise<void>;
  close?(): Promise<void>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly sweepThreshold = 10_000) {}

  async consume(keyHash: string, policy: RateLimitPolicy, now: number): Promise<RateLimitDecision> {
    // Expired buckets were never removed, so every distinct client grew the map without bound.
    if (this.buckets.size >= this.sweepThreshold)
      for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
    const current = this.buckets.get(keyHash);
    const bucket =
      !current || current.resetAt <= now
        ? { count: 1, resetAt: now + policy.windowMs }
        : { count: current.count + 1, resetAt: current.resetAt };
    this.buckets.set(keyHash, bucket);
    const allowed = bucket.count <= policy.limit;
    return {
      allowed,
      remaining: Math.max(0, policy.limit - bucket.count),
      resetAt: bucket.resetAt,
      reason: allowed ? 'within-limit' : 'exceeded',
    };
  }

  async reset(keyHash: string): Promise<void> {
    this.buckets.delete(keyHash);
  }
}

interface Queryable {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  end?(): Promise<void>;
}

export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly database: Queryable) {}

  static connect(config: PoolConfig): PostgresRateLimitStore {
    return new PostgresRateLimitStore(new Pool(config));
  }

  async consume(keyHash: string, policy: RateLimitPolicy, now: number): Promise<RateLimitDecision> {
    const result = await this.database.query<{ request_count: number; reset_ms: string }>(
      `insert into app_private.rate_limit_buckets as bucket
        (key_hash, request_count, window_started_at, reset_at, updated_at)
       values ($1, 1, to_timestamp($2 / 1000.0), to_timestamp(($2 + $3) / 1000.0), now())
       on conflict (key_hash) do update set
         request_count = case
           when bucket.reset_at <= to_timestamp($2 / 1000.0) then 1
           else bucket.request_count + 1
         end,
         window_started_at = case
           when bucket.reset_at <= to_timestamp($2 / 1000.0) then to_timestamp($2 / 1000.0)
           else bucket.window_started_at
         end,
         reset_at = case
           when bucket.reset_at <= to_timestamp($2 / 1000.0)
             then to_timestamp(($2 + $3) / 1000.0)
           else bucket.reset_at
         end,
         updated_at = now()
       returning request_count,
         (extract(epoch from reset_at) * 1000)::bigint::text as reset_ms`,
      [keyHash, now, policy.windowMs],
    );
    const row = result.rows[0];
    if (!row) throw new Error('rate-limit-store-empty-result');
    const allowed = row.request_count <= policy.limit;
    return {
      allowed,
      remaining: Math.max(0, policy.limit - row.request_count),
      resetAt: Number(row.reset_ms),
      reason: allowed ? 'within-limit' : 'exceeded',
    };
  }

  async reset(keyHash: string): Promise<void> {
    await this.database.query('delete from app_private.rate_limit_buckets where key_hash = $1', [
      keyHash,
    ]);
  }

  async close(): Promise<void> {
    await this.database.end?.();
  }
}

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly keySecret: string,
  ) {}

  private key(policy: RateLimitPolicy, subject: string): string {
    return createHmac('sha256', this.keySecret).update(`${policy.id}\0${subject}`).digest('hex');
  }

  async consume(
    policy: RateLimitPolicy,
    subject: string,
    now = Date.now(),
  ): Promise<RateLimitDecision> {
    try {
      return await this.store.consume(this.key(policy, subject), policy, now);
    } catch {
      return {
        allowed: !policy.failClosed,
        remaining: 0,
        resetAt: now + policy.windowMs,
        reason: 'store-unavailable',
      };
    }
  }

  reset(policy: RateLimitPolicy, subject: string): Promise<void> {
    return this.store.reset(this.key(policy, subject));
  }
}

export const RATE_LIMIT_POLICIES = {
  publicRead: { id: 'public-read', limit: 240, windowMs: 60_000, failClosed: false },
  expensiveSearch: { id: 'expensive-search', limit: 40, windowMs: 60_000, failClosed: true },
  goalEvaluation: { id: 'goal-evaluation', limit: 30, windowMs: 60_000, failClosed: true },
  adminRead: { id: 'admin-read', limit: 120, windowMs: 60_000, failClosed: true },
  adminMutation: { id: 'admin-mutation', limit: 20, windowMs: 60_000, failClosed: true },
  authentication: { id: 'authentication', limit: 5, windowMs: 15 * 60_000, failClosed: true },
  dataPromotion: { id: 'data-promotion', limit: 10, windowMs: 60_000, failClosed: true },
} as const satisfies Readonly<Record<string, RateLimitPolicy>>;

export interface SecurityEnvironment {
  readonly NODE_ENV?: string;
  readonly POKOPIA_RATE_LIMIT_BACKEND?: string;
  readonly POKOPIA_RATE_LIMIT_DATABASE_URL?: string;
  readonly POKOPIA_RATE_LIMIT_KEY_SECRET?: string;
}

export function createRateLimiterFromEnvironment(
  environment: SecurityEnvironment,
  developmentStore = new MemoryRateLimitStore(),
): RateLimiter {
  const production = environment.NODE_ENV === 'production';
  const backend = environment.POKOPIA_RATE_LIMIT_BACKEND ?? (production ? '' : 'memory');
  const keySecret =
    environment.POKOPIA_RATE_LIMIT_KEY_SECRET ?? (production ? '' : 'local-test-key');
  if (production && keySecret.length < 32)
    throw new Error(
      'POKOPIA_RATE_LIMIT_KEY_SECRET must contain at least 32 characters in production.',
    );
  if (backend === 'memory') {
    if (production) throw new Error('Memory-only rate limiting is forbidden in production.');
    return new RateLimiter(developmentStore, keySecret);
  }
  if (backend !== 'postgres')
    throw new Error('POKOPIA_RATE_LIMIT_BACKEND must be memory or postgres.');
  if (!environment.POKOPIA_RATE_LIMIT_DATABASE_URL)
    throw new Error(
      'POKOPIA_RATE_LIMIT_DATABASE_URL is required for the postgres rate-limit backend.',
    );
  return new RateLimiter(
    PostgresRateLimitStore.connect({
      connectionString: environment.POKOPIA_RATE_LIMIT_DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 2_000,
      statement_timeout: 2_000,
      application_name: 'pokopia-rate-limit',
    }),
    keySecret,
  );
}
