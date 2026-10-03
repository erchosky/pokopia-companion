export const ACCESS_COOKIE_NAME = 'pokopia_admin_access';
export const PENDING_ACCESS_COOKIE_NAME = 'pokopia_admin_pending_access';
export const PENDING_REFRESH_COOKIE_NAME = 'pokopia_admin_pending_refresh';

export function hostedCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    expires,
    path: '/',
  };
}
