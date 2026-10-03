import {
  createRateLimiterFromEnvironment,
  MemoryRateLimitStore,
  RATE_LIMIT_POLICIES,
  type RateLimitDecision,
  type RateLimiter,
} from '@pokopia/security';

const globalState = globalThis as typeof globalThis & {
  __pokopiaAdminRateLimitStore?: MemoryRateLimitStore;
  __pokopiaAdminRateLimiter?: RateLimiter;
};

function limiter(): RateLimiter {
  if (!globalState.__pokopiaAdminRateLimiter) {
    globalState.__pokopiaAdminRateLimitStore ??= new MemoryRateLimitStore();
    globalState.__pokopiaAdminRateLimiter = createRateLimiterFromEnvironment(
      process.env,
      globalState.__pokopiaAdminRateLimitStore,
    );
  }
  return globalState.__pokopiaAdminRateLimiter;
}

export function loginAllowed(key: string, now = Date.now()): Promise<RateLimitDecision> {
  return limiter().consume(RATE_LIMIT_POLICIES.authentication, key, now);
}

export function clearLoginFailures(key: string): Promise<void> {
  return limiter().reset(RATE_LIMIT_POLICIES.authentication, key);
}
