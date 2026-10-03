import { verifySession } from './session';

export interface AdminAuthorizationInput {
  readonly mode?: 'local-password' | 'supabase' | undefined;
  readonly sessionCookie?: string | undefined;
  readonly sessionSecret?: string | undefined;
  readonly accessToken?: string | undefined;
  readonly supabaseUrl?: string | undefined;
  readonly publishableKey?: string | undefined;
  readonly serviceKey?: string | undefined;
  readonly adminUserIds?: string | undefined;
  readonly fetcher?: typeof fetch;
  readonly now?: number;
}

export interface AdminAuthorizationResult {
  readonly allowed: boolean;
  readonly actor: string | null;
  readonly mfa: 'aal2' | 'missing' | null;
  readonly reason:
    | 'allowed'
    | 'missing-session'
    | 'invalid-session'
    | 'not-allowlisted'
    | 'missing-mfa'
    | 'revoked'
    | 'provider-unavailable';
}

function denied(
  reason: Exclude<AdminAuthorizationResult['reason'], 'allowed'>,
): AdminAuthorizationResult {
  return { allowed: false, actor: null, mfa: null, reason };
}

function jwtClaims(token: string): { sub?: string; aal?: string; exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload || payload.length > 8_192) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function allowlist(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

async function authorizeSupabaseAdmin(
  input: AdminAuthorizationInput,
): Promise<AdminAuthorizationResult> {
  const { accessToken, supabaseUrl, publishableKey, serviceKey } = input;
  if (!accessToken) return denied('missing-session');
  if (!supabaseUrl || !publishableKey || !serviceKey) return denied('provider-unavailable');
  const claims = jwtClaims(accessToken);
  if (!claims || claims.exp === undefined || claims.exp * 1000 <= (input.now ?? Date.now()))
    return denied('invalid-session');
  const fetcher = input.fetcher ?? fetch;
  try {
    const userResponse = await fetcher(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: publishableKey, authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!userResponse.ok) return denied('invalid-session');
    const user = (await userResponse.json()) as { id?: unknown };
    if (typeof user.id !== 'string' || claims.sub !== user.id) return denied('invalid-session');
    if (!allowlist(input.adminUserIds).has(user.id)) return denied('not-allowlisted');
    if (claims.aal !== 'aal2') return denied('missing-mfa');

    // The privileged lookup makes deletion/ban revocation observable on every admin request.
    const adminResponse = await fetcher(
      `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
      {
        headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!adminResponse.ok) return denied('revoked');
    const providerUser = (await adminResponse.json()) as { banned_until?: unknown };
    if (
      typeof providerUser.banned_until === 'string' &&
      Number.isFinite(Date.parse(providerUser.banned_until)) &&
      Date.parse(providerUser.banned_until) > (input.now ?? Date.now())
    )
      return denied('revoked');
    return { allowed: true, actor: user.id, mfa: 'aal2', reason: 'allowed' };
  } catch {
    return denied('provider-unavailable');
  }
}

/** Client roles and arbitrary request headers are deliberately not part of this contract. */
export async function authorizeAdmin(
  input: AdminAuthorizationInput,
): Promise<AdminAuthorizationResult> {
  if (input.mode === 'supabase') return authorizeSupabaseAdmin(input);
  const allowed = await verifySession(input.sessionCookie, input.sessionSecret, input.now);
  return allowed
    ? { allowed: true, actor: 'local-admin', mfa: null, reason: 'allowed' }
    : denied(input.sessionCookie ? 'invalid-session' : 'missing-session');
}

export function sameOriginRequest(
  headers: Pick<Headers, 'get'>,
  requireOrigin: boolean,
  trustForwardedHost = false,
): boolean {
  const origin = headers.get('origin');
  const host = (trustForwardedHost ? headers.get('x-forwarded-host') : null) ?? headers.get('host');
  if (!origin || !host) return !requireOrigin;
  try {
    return new URL(origin).host === host.split(',')[0]?.trim();
  } catch {
    return false;
  }
}
