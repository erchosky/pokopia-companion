import { NextResponse, type NextRequest } from 'next/server';
import { authorizeAdmin } from '@/lib/authorization';
import { COOKIE_NAME } from '@/lib/session';
import { ACCESS_COOKIE_NAME } from '@/lib/hosted-auth';
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = crypto.randomUUID();
  if (pathname === '/login' || pathname.startsWith('/_next')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('x-request-id', requestId);
    return response;
  }
  const authorization = await authorizeAdmin({
    mode: process.env.POKOPIA_ADMIN_AUTH_MODE === 'supabase' ? 'supabase' : 'local-password',
    sessionCookie: request.cookies.get(COOKIE_NAME)?.value,
    sessionSecret: process.env.POKOPIA_ADMIN_SESSION_SECRET,
    accessToken: request.cookies.get(ACCESS_COOKIE_NAME)?.value,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    serviceKey: process.env.SUPABASE_SECRET_KEY,
    adminUserIds: process.env.POKOPIA_ADMIN_USER_IDS,
  });
  if (authorization.allowed) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pokopia-admin-actor', authorization.actor ?? 'unknown');
    requestHeaders.set('x-request-id', requestId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Vary', 'Cookie, Authorization');
    response.headers.set('x-request-id', requestId);
    return response;
  }
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('x-request-id', requestId);
  return response;
}
export const config = { matcher: ['/((?!favicon.ico).*)'] };
