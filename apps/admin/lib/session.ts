const encoder = new TextEncoder();
export const COOKIE_NAME = 'pokopia_admin';
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60_000;

export async function signSession(
  expiresAt: number,
  secret: string,
  issuedAt = Date.now(),
  nonce = crypto.randomUUID(),
): Promise<string> {
  if (secret.length < 32)
    throw new Error('Admin session secret must contain at least 32 characters.');
  if (expiresAt <= issuedAt || expiresAt - issuedAt > MAX_SESSION_MS)
    throw new Error('Admin session expiry is outside the allowed lifetime.');
  const payload = `v1.${issuedAt}.${expiresAt}.${nonce}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${Buffer.from(signature).toString('base64url')}`;
}

export async function verifySession(
  value: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!value || !secret || secret.length < 32 || value.length > 512) return false;
  try {
    const parts = value.split('.');
    if (parts.length !== 5) return false;
    const [version, issuedRaw, expiresRaw, nonce, signature] = parts;
    if (!version || !issuedRaw || !expiresRaw || !nonce || !signature) return false;
    const issuedAt = Number(issuedRaw);
    const expiresAt = Number(expiresRaw);
    if (
      version !== 'v1' ||
      nonce.length > 80 ||
      !Number.isSafeInteger(issuedAt) ||
      !Number.isSafeInteger(expiresAt) ||
      issuedAt > now + CLOCK_SKEW_MS ||
      expiresAt <= now ||
      expiresAt - issuedAt > MAX_SESSION_MS
    )
      return false;
    const payload = `${version}.${issuedRaw}.${expiresRaw}.${nonce}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      'HMAC',
      key,
      Buffer.from(signature, 'base64url'),
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
}
