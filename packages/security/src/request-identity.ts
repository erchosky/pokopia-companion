import { isIP } from 'node:net';

export interface ClientIdentityOptions {
  readonly platform?: 'vercel' | 'generic';
  readonly trustProxyHeaders?: boolean;
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith('[')) {
    const closing = candidate.indexOf(']');
    if (closing < 0) return null;
    candidate = candidate.slice(1, closing);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(':'));
  }
  candidate = candidate.toLowerCase().replace(/^::ffff:/, '');
  if (!isIP(candidate)) return null;
  if (isIP(candidate) === 6) {
    try {
      candidate = new URL(`http://[${candidate}]`).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return null;
    }
  }
  return candidate;
}

function firstValid(value: string | null): string | null {
  if (!value) return null;
  for (const candidate of value.split(',')) {
    const normalized = normalizeIpCandidate(candidate);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Forwarded headers are ignored unless the deployment explicitly declares a trusted proxy. Vercel's
 * platform-specific header is considered only when the deployment is explicitly marked as Vercel.
 */
export function clientIdentity(
  headers: Pick<Headers, 'get'>,
  options: ClientIdentityOptions = {},
): string {
  const platformAddress =
    options.platform === 'vercel' ? firstValid(headers.get('x-vercel-forwarded-for')) : null;
  if (platformAddress) return `ip:${platformAddress}`;
  if (options.trustProxyHeaders) {
    const trusted = firstValid(headers.get('x-real-ip') ?? headers.get('x-forwarded-for'));
    if (trusted) return `ip:${trusted}`;
  }
  return 'proxy:unresolved';
}
