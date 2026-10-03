import type { SecurityEnvironment } from './rate-limit.js';

export interface PokopiaEnvironment extends SecurityEnvironment {
  readonly POKOPIA_DEPLOYMENT_TARGET?: string;
  readonly POKOPIA_PUBLIC_ORIGIN?: string;
  readonly POKOPIA_ADMIN_AUTH_MODE?: string;
  readonly POKOPIA_ADMIN_USER_IDS?: string;
  readonly POKOPIA_ADMIN_PASSWORD?: string;
  readonly POKOPIA_ADMIN_SESSION_SECRET?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_SECRET_KEY?: string;
  readonly POKOPIA_DATA_BACKEND?: string;
  readonly POKOPIA_DATABASE_URL?: string;
  readonly DATABASE_URL?: string;
  readonly POKOPIA_TRUST_PROXY_HEADERS?: string;
  readonly VERCEL?: string;
}

export interface EnvironmentValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const PLACEHOLDER = /^(?:password|postgres|secret|changeme|replace-me|example|test)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateHostedEnvironment(
  environment: PokopiaEnvironment,
  target: 'staging' | 'production',
  scope: 'web' | 'admin' | 'all' = 'all',
): EnvironmentValidation {
  const errors: string[] = [];
  const rateSecret = environment.POKOPIA_RATE_LIMIT_KEY_SECRET ?? '';
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const serviceKey = environment.SUPABASE_SECRET_KEY ?? '';
  const adminIds = (environment.POKOPIA_ADMIN_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (scope !== 'web') {
    if (environment.POKOPIA_ADMIN_AUTH_MODE !== 'supabase')
      errors.push(`POKOPIA_ADMIN_AUTH_MODE must be supabase for ${target}.`);
    if (!isHttpsUrl(environment.NEXT_PUBLIC_SUPABASE_URL ?? ''))
      errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.');
    if (publishableKey.length < 20 || PLACEHOLDER.test(publishableKey))
      errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required and cannot be a placeholder.');
    if (serviceKey.length < 20 || PLACEHOLDER.test(serviceKey) || serviceKey === publishableKey)
      errors.push('SUPABASE_SECRET_KEY is required, server-only and must be distinct.');
    if (adminIds.length === 0 || adminIds.some((id) => !UUID.test(id)))
      errors.push('POKOPIA_ADMIN_USER_IDS must contain one or more valid Supabase user UUIDs.');
  }
  if (!isHttpsUrl(environment.POKOPIA_PUBLIC_ORIGIN ?? ''))
    errors.push('POKOPIA_PUBLIC_ORIGIN must be an explicit HTTPS origin.');
  if (environment.POKOPIA_RATE_LIMIT_BACKEND !== 'postgres')
    errors.push(`POKOPIA_RATE_LIMIT_BACKEND must be postgres for ${target}.`);
  if (!environment.POKOPIA_RATE_LIMIT_DATABASE_URL)
    errors.push(`POKOPIA_RATE_LIMIT_DATABASE_URL is required for ${target}.`);
  if (rateSecret.length < 32 || PLACEHOLDER.test(rateSecret))
    errors.push('POKOPIA_RATE_LIMIT_KEY_SECRET must contain at least 32 characters.');
  if (environment.POKOPIA_DATA_BACKEND !== 'postgres')
    errors.push(`POKOPIA_DATA_BACKEND must be postgres for ${target}.`);
  if (!environment.POKOPIA_DATABASE_URL && !environment.DATABASE_URL)
    errors.push(`POKOPIA_DATABASE_URL or DATABASE_URL is required for ${target}.`);
  if (environment.VERCEL !== '1' && environment.POKOPIA_TRUST_PROXY_HEADERS !== 'true')
    errors.push(`A trusted proxy identity contract is required for ${target}.`);
  if (
    scope !== 'web' &&
    (environment.POKOPIA_ADMIN_PASSWORD || environment.POKOPIA_ADMIN_SESSION_SECRET)
  )
    errors.push(`Local shared-password admin credentials are forbidden for ${target}.`);
  return { valid: errors.length === 0, errors };
}

export function validateProductionEnvironment(
  environment: PokopiaEnvironment,
): EnvironmentValidation {
  return validateHostedEnvironment(environment, 'production');
}
