'use server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  clientIdentity,
  securityLog,
  validateHostedEnvironment,
  validateProductionEnvironment,
} from '@pokopia/security';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, signSession } from '@/lib/session';
import { sameOriginRequest } from '@/lib/authorization';
import { clearLoginFailures, loginAllowed } from '@/lib/login-throttle';
import {
  ACCESS_COOKIE_NAME,
  hostedCookieOptions,
  PENDING_ACCESS_COOKIE_NAME,
  PENDING_REFRESH_COOKIE_NAME,
} from '@/lib/hosted-auth';

const PENDING_SESSION_MS = 5 * 60 * 1_000;

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

function allowedAdmin(userId: string): boolean {
  return (process.env.POKOPIA_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .includes(userId);
}

async function hostedLogin(formData: FormData, clientKey: string): Promise<never> {
  const target = process.env.POKOPIA_DEPLOYMENT_TARGET === 'production' ? 'production' : 'staging';
  const environment = validateHostedEnvironment(process.env, target);
  const client = supabaseClient();
  if (!environment.valid || !client) {
    securityLog('error', 'admin.environment.invalid', { errors: environment.errors });
    redirect('/login?error=setup');
  }
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') redirect('/login?error=invalid');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user || !allowedAdmin(data.user.id)) {
    securityLog('warn', 'admin.login.denied', { clientKey });
    redirect('/login?error=invalid');
  }
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  const factor = factors?.totp.find((candidate) => candidate.status === 'verified');
  if (factorsError || !factor) {
    securityLog('warn', 'admin.login.mfa_not_enrolled', { clientKey, actor: data.user.id });
    redirect('/login?error=mfa-required');
  }
  const store = await cookies();
  const pendingExpiry = new Date(Date.now() + PENDING_SESSION_MS);
  store.set(
    PENDING_ACCESS_COOKIE_NAME,
    data.session.access_token,
    hostedCookieOptions(pendingExpiry),
  );
  store.set(
    PENDING_REFRESH_COOKIE_NAME,
    data.session.refresh_token,
    hostedCookieOptions(pendingExpiry),
  );
  await clearLoginFailures(clientKey);
  securityLog('info', 'admin.login.primary_factor_succeeded', {
    clientKey,
    actor: data.user.id,
  });
  redirect('/login?step=mfa');
}

function passwordsMatch(supplied: string, expected: string): boolean {
  const suppliedDigest = createHash('sha256').update(supplied).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(suppliedDigest, expectedDigest);
}

function requestClientKey(headerStore: Pick<Headers, 'get'>): string {
  return clientIdentity(headerStore, {
    platform: process.env.VERCEL === '1' ? 'vercel' : 'generic',
    trustProxyHeaders: process.env.POKOPIA_TRUST_PROXY_HEADERS === 'true',
  });
}

export async function login(formData: FormData) {
  const expected = process.env.POKOPIA_ADMIN_PASSWORD;
  const secret = process.env.POKOPIA_ADMIN_SESSION_SECRET;
  const supplied = formData.get('password');
  const headerStore = await headers();
  const clientKey = requestClientKey(headerStore);
  if (
    !sameOriginRequest(
      headerStore,
      process.env.NODE_ENV === 'production',
      process.env.VERCEL === '1' || process.env.POKOPIA_TRUST_PROXY_HEADERS === 'true',
    )
  ) {
    securityLog('warn', 'admin.login.cross_origin_denied', { clientKey });
    redirect('/login?error=invalid');
  }
  const limit = await loginAllowed(clientKey);
  if (!limit.allowed) {
    securityLog('warn', 'admin.login.rate_limited', { clientKey, reason: limit.reason });
    redirect('/login?error=invalid');
  }
  if (process.env.POKOPIA_ADMIN_AUTH_MODE === 'supabase') return hostedLogin(formData, clientKey);
  if (process.env.NODE_ENV === 'production') {
    const environment = validateProductionEnvironment(process.env);
    if (!environment.valid) {
      securityLog('error', 'admin.environment.invalid', { errors: environment.errors });
      redirect('/login?error=setup');
    }
  }
  // signSession rejects short secrets; fail closed to the setup message instead of a 500.
  if (!expected || !secret || secret.length < 32) redirect('/login?error=setup');
  if (typeof supplied !== 'string' || !passwordsMatch(supplied, expected)) {
    securityLog('warn', 'admin.login.denied', { clientKey });
    redirect('/login?error=invalid');
  }
  await clearLoginFailures(clientKey);
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const store = await cookies();
  store.set(COOKIE_NAME, await signSession(expires, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(expires),
    path: '/',
  });
  securityLog('info', 'admin.login.succeeded', { clientKey, expiresAt: expires });
  redirect('/health');
}

export async function verifyMfa(formData: FormData): Promise<never> {
  if (process.env.POKOPIA_ADMIN_AUTH_MODE !== 'supabase') redirect('/login?error=setup');
  const code = formData.get('code');
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) redirect('/login?step=mfa&error=invalid');
  // The TOTP step shares the login throttle so the pending session cannot brute-force codes.
  const clientKey = requestClientKey(await headers());
  const limit = await loginAllowed(clientKey);
  if (!limit.allowed) {
    securityLog('warn', 'admin.mfa.rate_limited', { clientKey, reason: limit.reason });
    redirect('/login?step=mfa&error=invalid');
  }
  const store = await cookies();
  const accessToken = store.get(PENDING_ACCESS_COOKIE_NAME)?.value;
  const refreshToken = store.get(PENDING_REFRESH_COOKIE_NAME)?.value;
  const client = supabaseClient();
  if (!accessToken || !refreshToken || !client) redirect('/login?error=invalid');
  const { error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) redirect('/login?error=invalid');
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors();
  const factor = factors?.totp.find((candidate) => candidate.status === 'verified');
  if (factorsError || !factor) redirect('/login?error=mfa-required');
  const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error || !data.user || !allowedAdmin(data.user.id)) {
    securityLog('warn', 'admin.mfa.denied', { clientKey });
    redirect('/login?step=mfa&error=invalid');
  }
  await clearLoginFailures(clientKey);
  const expiry = new Date(Date.now() + Math.min(data.expires_in * 1_000, 60 * 60 * 1_000));
  store.set(ACCESS_COOKIE_NAME, data.access_token, hostedCookieOptions(expiry));
  store.delete(PENDING_ACCESS_COOKIE_NAME);
  store.delete(PENDING_REFRESH_COOKIE_NAME);
  securityLog('info', 'admin.login.mfa_succeeded', { actor: data.user.id });
  redirect('/health');
}
