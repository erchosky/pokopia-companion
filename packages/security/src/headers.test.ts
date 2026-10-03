import { describe, expect, it } from 'vitest';
import { securityHeaders } from './headers.js';

describe('security headers', () => {
  it('ships framing, MIME, referrer, permissions and production transport controls', () => {
    const headers = Object.fromEntries(securityHeaders(true).map(({ key, value }) => [key, value]));
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Content-Security-Policy']).not.toContain("'unsafe-eval'");
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Strict-Transport-Security']).toContain('max-age=63072000');
  });

  it('permits the development runtime without advertising HSTS', () => {
    const headers = Object.fromEntries(
      securityHeaders(false).map(({ key, value }) => [key, value]),
    );
    expect(headers['Content-Security-Policy']).toContain("'unsafe-eval'");
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });
});
