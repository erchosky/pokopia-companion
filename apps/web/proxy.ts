import { NextResponse, type NextRequest } from 'next/server';
import { clientIdentity, RATE_LIMIT_POLICIES, securityLog } from '@pokopia/security';
import { webRateLimiter } from '@/lib/rate-limit';

export async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  const query = request.nextUrl.searchParams.get('q') ?? '';
  if (request.nextUrl.pathname !== '/buscar' || query.length < 2) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }
  const subject = clientIdentity(request.headers, {
    platform: process.env.VERCEL === '1' ? 'vercel' : 'generic',
    trustProxyHeaders: process.env.POKOPIA_TRUST_PROXY_HEADERS === 'true',
  });
  const decision = await webRateLimiter().consume(RATE_LIMIT_POLICIES.expensiveSearch, subject);
  if (decision.allowed) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }
  securityLog('warn', 'search.rate_limited', { requestId, subject, reason: decision.reason });
  return new NextResponse('Too many searches. Try again shortly.', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': String(Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1_000))),
      'Cache-Control': 'no-store',
      'x-request-id': requestId,
    },
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
