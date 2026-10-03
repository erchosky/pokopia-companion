import { describe, expect, it } from 'vitest';
import { authorizeAdmin, sameOriginRequest } from './authorization';
import { signSession } from './session';

describe('admin authorization boundary', () => {
  const secret = 'test-session-secret-with-at-least-32-bytes';

  it('denies anonymous, malformed, expired and wrong-secret sessions', async () => {
    const now = 5_000;
    const expired = await signSession(now + 1, secret, now, 'expired');
    await expect(authorizeAdmin({ sessionSecret: secret, now })).resolves.toMatchObject({
      allowed: false,
      actor: null,
    });
    await expect(
      authorizeAdmin({ sessionCookie: 'malformed', sessionSecret: secret, now }),
    ).resolves.toMatchObject({ allowed: false, actor: null });
    await expect(
      authorizeAdmin({ sessionCookie: expired, sessionSecret: secret, now: now + 2 }),
    ).resolves.toMatchObject({ allowed: false, actor: null });
    await expect(
      authorizeAdmin({ sessionCookie: expired, sessionSecret: 'x'.repeat(32), now }),
    ).resolves.toMatchObject({ allowed: false, actor: null });
  });

  it('allows only a valid server-signed session and has no client-role input', async () => {
    const now = 5_000;
    const token = await signSession(now + 60_000, secret, now, 'valid');
    await expect(
      authorizeAdmin({ sessionCookie: token, sessionSecret: secret, now }),
    ).resolves.toMatchObject({ allowed: true, actor: 'local-admin' });
  });

  it('requires verified provider identity, server allowlist, aal2 and active state', async () => {
    const userId = '9b2b6f30-8c37-4ad5-91d6-d0db9b4730e9';
    const token = (aal: 'aal1' | 'aal2') =>
      `header.${btoa(JSON.stringify({ sub: userId, aal, exp: 2_000 }))}.signature`;
    const activeFetcher = async (input: string | URL | Request) =>
      new Response(
        JSON.stringify(String(input).endsWith(`/users/${userId}`) ? {} : { id: userId }),
      );
    const base = {
      mode: 'supabase' as const,
      supabaseUrl: 'https://staging.supabase.co',
      publishableKey: 'sb_publishable_staging',
      serviceKey: 'sb_secret_staging',
      adminUserIds: userId,
      now: 1_000_000,
      fetcher: activeFetcher as typeof fetch,
    };

    await expect(authorizeAdmin(base)).resolves.toMatchObject({
      allowed: false,
      reason: 'missing-session',
    });
    const expired = `header.${btoa(JSON.stringify({ sub: userId, aal: 'aal2', exp: 999 }))}.signature`;
    await expect(authorizeAdmin({ ...base, accessToken: expired })).resolves.toMatchObject({
      allowed: false,
      reason: 'invalid-session',
    });
    await expect(authorizeAdmin({ ...base, accessToken: token('aal1') })).resolves.toMatchObject({
      allowed: false,
      reason: 'missing-mfa',
    });
    await expect(
      authorizeAdmin({ ...base, adminUserIds: '', accessToken: token('aal2') }),
    ).resolves.toMatchObject({ allowed: false, reason: 'not-allowlisted' });
    await expect(authorizeAdmin({ ...base, accessToken: token('aal2') })).resolves.toEqual({
      allowed: true,
      actor: userId,
      mfa: 'aal2',
      reason: 'allowed',
    });

    const revokedFetcher = async (input: string | URL | Request) =>
      String(input).endsWith(`/users/${userId}`)
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify({ id: userId }));
    await expect(
      authorizeAdmin({
        ...base,
        accessToken: token('aal2'),
        fetcher: revokedFetcher as typeof fetch,
      }),
    ).resolves.toMatchObject({ allowed: false, reason: 'revoked' });
  });

  it('rejects cross-origin mutations and malformed origins', () => {
    expect(
      sameOriginRequest(new Headers({ origin: 'https://admin.test', host: 'admin.test' }), true),
    ).toBe(true);
    expect(
      sameOriginRequest(new Headers({ origin: 'https://evil.test', host: 'admin.test' }), true),
    ).toBe(false);
    expect(sameOriginRequest(new Headers({ host: 'admin.test' }), true)).toBe(false);
    expect(
      sameOriginRequest(
        new Headers({
          origin: 'https://evil.test',
          host: 'admin.test',
          'x-forwarded-host': 'evil.test',
        }),
        true,
      ),
    ).toBe(false);
  });
});
