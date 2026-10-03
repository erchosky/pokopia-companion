import { describe, expect, it } from 'vitest';
import { clearLoginFailures, loginAllowed } from './login-throttle';

describe('admin login throttle', () => {
  it('blocks the sixth attempt inside the window and expires safely', async () => {
    const key = `fixture-${Math.random()}`;
    for (let index = 0; index < 5; index += 1)
      expect((await loginAllowed(key, 1_000)).allowed).toBe(true);
    expect((await loginAllowed(key, 2_000)).allowed).toBe(false);
    expect((await loginAllowed(key, 1_000 + 15 * 60 * 1_000)).allowed).toBe(true);
  });

  it('clears failures after successful authentication', async () => {
    const key = `fixture-${Math.random()}`;
    await loginAllowed(key, 1_000);
    await clearLoginFailures(key);
    expect((await loginAllowed(key, 2_000)).allowed).toBe(true);
  });
});
