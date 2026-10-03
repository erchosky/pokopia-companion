import { describe, expect, it } from 'vitest';
import {
  createRateLimiterFromEnvironment,
  MemoryRateLimitStore,
  RateLimiter,
  type RateLimitPolicy,
  type RateLimitStore,
} from './rate-limit.js';

const policy: RateLimitPolicy = { id: 'test', limit: 2, windowMs: 1_000, failClosed: true };

describe('rate limiting', () => {
  it('shares an atomic bucket across simulated instances and resets at the boundary', async () => {
    const store = new MemoryRateLimitStore();
    const first = new RateLimiter(store, 'test-secret');
    const second = new RateLimiter(store, 'test-secret');
    expect((await first.consume(policy, 'ip:127.0.0.1', 100)).allowed).toBe(true);
    expect((await second.consume(policy, 'ip:127.0.0.1', 100)).allowed).toBe(true);
    expect((await first.consume(policy, 'ip:127.0.0.1', 100)).allowed).toBe(false);
    expect((await second.consume(policy, 'ip:127.0.0.1', 1_100)).allowed).toBe(true);
  });

  it('sweeps expired buckets instead of growing without bound', async () => {
    const store = new MemoryRateLimitStore(3);
    for (const key of ['a', 'b', 'c']) await store.consume(key, policy, 100);
    expect((store as unknown as { buckets: Map<string, unknown> }).buckets.size).toBe(3);
    await store.consume('d', policy, 2_000);
    expect([...(store as unknown as { buckets: Map<string, unknown> }).buckets.keys()]).toEqual([
      'd',
    ]);
    // Live buckets survive a sweep and keep counting.
    await store.consume('d', policy, 2_001);
    await store.consume('e', policy, 2_001);
    expect((await store.consume('d', policy, 2_002)).allowed).toBe(false);
  });

  it('handles concurrent bursts without exceeding the allowance', async () => {
    const limiter = new RateLimiter(new MemoryRateLimitStore(), 'test-secret');
    const decisions = await Promise.all(
      Array.from({ length: 20 }, () => limiter.consume(policy, 'user:one', 500)),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(2);
  });

  it('fails closed for protected surfaces when the store is unavailable', async () => {
    const unavailable: RateLimitStore = {
      consume: async () => {
        throw new Error('offline');
      },
      reset: async () => undefined,
    };
    const limiter = new RateLimiter(unavailable, 'test-secret');
    expect(await limiter.consume(policy, 'anonymous')).toEqual(
      expect.objectContaining({ allowed: false, reason: 'store-unavailable' }),
    );
    expect(await limiter.consume({ ...policy, failClosed: false }, 'anonymous')).toEqual(
      expect.objectContaining({ allowed: true, reason: 'store-unavailable' }),
    );
  });

  it('rejects memory-only and weak-key production configuration', () => {
    expect(() =>
      createRateLimiterFromEnvironment({
        NODE_ENV: 'production',
        POKOPIA_RATE_LIMIT_BACKEND: 'memory',
        POKOPIA_RATE_LIMIT_KEY_SECRET: 'x'.repeat(32),
      }),
    ).toThrow(/Memory-only/);
    expect(() =>
      createRateLimiterFromEnvironment({
        NODE_ENV: 'production',
        POKOPIA_RATE_LIMIT_BACKEND: 'postgres',
        POKOPIA_RATE_LIMIT_DATABASE_URL: 'postgresql://localhost/test',
        POKOPIA_RATE_LIMIT_KEY_SECRET: 'short',
      }),
    ).toThrow(/32 characters/);
  });
});
