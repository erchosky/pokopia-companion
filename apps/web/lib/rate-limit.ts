import {
  createRateLimiterFromEnvironment,
  MemoryRateLimitStore,
  type RateLimiter,
} from '@pokopia/security';

const globalState = globalThis as typeof globalThis & {
  __pokopiaWebRateLimitStore?: MemoryRateLimitStore;
  __pokopiaWebRateLimiter?: RateLimiter;
};

export function webRateLimiter(): RateLimiter {
  if (!globalState.__pokopiaWebRateLimiter) {
    globalState.__pokopiaWebRateLimitStore ??= new MemoryRateLimitStore();
    globalState.__pokopiaWebRateLimiter = createRateLimiterFromEnvironment(
      process.env,
      globalState.__pokopiaWebRateLimitStore,
    );
  }
  return globalState.__pokopiaWebRateLimiter;
}
