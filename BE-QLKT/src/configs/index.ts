function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || '4000';

export const DATABASE_URL = process.env.DATABASE_URL;

export const JWT_SECRET = requireEnv('JWT_SECRET');
export const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET');

export const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;
export const DEV_ZONE_PASSWORD = process.env.DEV_ZONE_PASSWORD;


export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

export const REFRESH_TOKEN_TTL = '2d';
export const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

// Path '/api/auth' keeps the long-lived credential off regular API calls.
// Cross-site prod must set COOKIE_SAMESITE=none + COOKIE_SECURE=true (HTTPS).
function refreshCookieBase() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'lax',
    path: '/api/auth',
  } as const;
}

/** @returns set-cookie options for the refresh token (base attributes + 2-day maxAge). */
export function getRefreshCookieOptions() {
  return { ...refreshCookieBase(), maxAge: REFRESH_COOKIE_MAX_AGE_MS } as const;
}

/** @returns clear-cookie options: same base attributes, no maxAge, so the browser overwrites. */
export function getRefreshClearOptions() {
  return refreshCookieBase();
}
