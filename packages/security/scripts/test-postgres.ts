import { PostgresRateLimitStore, RateLimiter, type RateLimitPolicy } from '../src/rate-limit.js';

const databaseUrl = process.env.POKOPIA_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('POKOPIA_TEST_DATABASE_URL is required');

const store = PostgresRateLimitStore.connect({ connectionString: databaseUrl, max: 8 });
const limiter = new RateLimiter(store, 'local-postgres-concurrency-test-secret');
const policy: RateLimitPolicy = {
  id: 'postgres-concurrency',
  limit: 5,
  windowMs: 60_000,
  failClosed: true,
};

try {
  const decisions = await Promise.all(
    Array.from({ length: 30 }, () => limiter.consume(policy, 'same-subject', 1_000_000)),
  );
  if (decisions.filter((decision) => decision.allowed).length !== 5)
    throw new Error(`Atomic allowance failed: ${JSON.stringify(decisions)}`);
  process.stdout.write('pokopia_postgres_rate_limit_ok\n');
} finally {
  await store.close();
}
