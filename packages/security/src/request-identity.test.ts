import { describe, expect, it } from 'vitest';
import { clientIdentity } from './request-identity.js';

describe('request identity', () => {
  it('ignores spoofable forwarded headers unless a proxy contract is enabled', () => {
    const headers = new Headers({ 'x-forwarded-for': '198.51.100.10' });
    expect(clientIdentity(headers)).toBe('proxy:unresolved');
    expect(clientIdentity(headers, { trustProxyHeaders: true })).toBe('ip:198.51.100.10');
  });

  it('normalizes IPv4-mapped and bracketed IPv6 addresses', () => {
    expect(
      clientIdentity(new Headers({ 'x-real-ip': '::ffff:192.0.2.4' }), {
        trustProxyHeaders: true,
      }),
    ).toBe('ip:192.0.2.4');
    expect(
      clientIdentity(new Headers({ 'x-real-ip': '[2001:0db8::1]:443' }), {
        trustProxyHeaders: true,
      }),
    ).toBe('ip:2001:db8::1');
  });

  it('does not accept malformed or ambiguous header values as an address', () => {
    expect(
      clientIdentity(new Headers({ 'x-forwarded-for': 'attacker, also-not-an-ip' }), {
        trustProxyHeaders: true,
      }),
    ).toBe('proxy:unresolved');
  });
});
