import { describe, expect, it } from 'vitest';
import { validateHostedEnvironment, validateProductionEnvironment } from './environment.js';

describe('production environment validation', () => {
  const valid = {
    POKOPIA_ADMIN_AUTH_MODE: 'supabase',
    POKOPIA_ADMIN_USER_IDS: '9b2b6f30-8c37-4ad5-91d6-d0db9b4730e9',
    NEXT_PUBLIC_SUPABASE_URL: 'https://staging-pokopia.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_only_value',
    SUPABASE_SECRET_KEY: 'sb_secret_staging_server_only_value',
    POKOPIA_PUBLIC_ORIGIN: 'https://admin-staging.example.test',
    POKOPIA_RATE_LIMIT_BACKEND: 'postgres',
    POKOPIA_RATE_LIMIT_DATABASE_URL: 'postgresql://rate-user@localhost/pokopia',
    POKOPIA_RATE_LIMIT_KEY_SECRET: 'r'.repeat(32),
    POKOPIA_DATA_BACKEND: 'postgres',
    POKOPIA_DATABASE_URL: 'postgresql://app-user@localhost/pokopia',
    VERCEL: '1',
  } as const;

  it('accepts a complete production server environment', () => {
    expect(validateProductionEnvironment(valid)).toEqual({ valid: true, errors: [] });
  });

  it('applies the same fail-closed contract to staging', () => {
    expect(validateHostedEnvironment(valid, 'staging')).toEqual({ valid: true, errors: [] });
  });

  it('rejects local storage, weak auth and unresolved proxy identity', () => {
    const result = validateProductionEnvironment({
      ...valid,
      POKOPIA_ADMIN_AUTH_MODE: 'local-password',
      POKOPIA_ADMIN_USER_IDS: 'client-selected-role',
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SECRET_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      POKOPIA_RATE_LIMIT_BACKEND: 'memory',
      POKOPIA_DATA_BACKEND: 'sqlite',
      VERCEL: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('POKOPIA_ADMIN_AUTH_MODE'),
        expect.stringContaining('HTTPS'),
        expect.stringContaining('POKOPIA_RATE_LIMIT_BACKEND'),
        expect.stringContaining('trusted proxy'),
      ]),
    );
  });
});
