import { describe, expect, it } from 'vitest';
import { signSession, verifySession } from './session';

describe('admin sessions', () => {
  const secret = 'test-session-secret-with-at-least-32-bytes';

  it('accepts a current token signed with the configured secret', async () => {
    const now = 1_000_000;
    const token = await signSession(now + 60_000, secret, now, 'fixed-nonce');
    await expect(verifySession(token, secret, now)).resolves.toBe(true);
  });

  it('rejects expired, malformed, overlong or tampered tokens', async () => {
    const now = 1_000_000;
    const expired = await signSession(now + 1, secret, now, 'expired-nonce');
    const current = await signSession(now + 60_000, secret, now, 'current-nonce');
    await expect(verifySession(expired, secret, now + 2)).resolves.toBe(false);
    await expect(verifySession(`${current}x`, secret, now)).resolves.toBe(false);
    await expect(
      verifySession(current, 'other-secret-that-is-at-least-32-bytes', now),
    ).resolves.toBe(false);
    await expect(verifySession('v1.nope.value.nonce.***', secret, now)).resolves.toBe(false);
    await expect(verifySession('x'.repeat(513), secret, now)).resolves.toBe(false);
  });

  it('does not issue an overlong or already-expired session', async () => {
    await expect(signSession(999, secret, 1_000)).rejects.toThrow(/expiry/);
    await expect(signSession(1_000 + 8 * 60 * 60 * 1_000 + 1, secret, 1_000)).rejects.toThrow(
      /expiry/,
    );
  });
});
