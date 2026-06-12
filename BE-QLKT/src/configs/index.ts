/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ENV CONFIG — fail-fast khi thiếu biến quan trọng (ATTT)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  FAIL-FAST PATTERN:
 *  requireEnv throw NGAY khi server start nếu thiếu env critical. Lý do:
 *  - Server chạy với JWT_SECRET=undefined → jwt.sign throw mỗi request →
 *    100% user fail login → khó debug.
 *  - Fail-fast: crash ngay startup → CI/CD biết deploy thiếu config → fix.
 *
 *  CRITICAL ENVS (requireEnv):
 *  - JWT_SECRET:         sign/verify access token (must be strong random).
 *  - JWT_REFRESH_SECRET: sign/verify refresh token (KHÁC JWT_SECRET).
 *
 *  OPTIONAL ENVS với fallback:
 *  - NODE_ENV → 'development'
 *  - PORT → '4000'
 *  - CLIENT_URL → 'http://localhost:3000'
 *
 *  ⚠️ JWT_SECRET STRENGTH:
 *  Phải là chuỗi ngẫu nhiên ≥ 256 bit (≥ 32 byte). Sinh bằng:
 *      openssl rand -base64 32
 *  → "x9aB...=" dài 44 ký tự.
 *  KHÔNG dùng password thường (vd: "secret123") → dễ brute force.
 *  KHÔNG commit vào git → để trong .env (gitignored) + secret manager.
 *
 *  HAI SECRET KHÁC NHAU (defense in depth):
 *  - Compromise JWT_SECRET → attacker forge access token (30m expiry).
 *  - Compromise JWT_REFRESH_SECRET → attacker forge refresh token.
 *  - Cả 2 cùng compromise → full takeover.
 *  → Tách 2 secret giảm blast radius.
 *
 *  DEV_ZONE_PASSWORD:
 *  Mật khẩu vào /dev_zone admin tools (reset password, backup, ...).
 *  TUYỆT ĐỐI không leak — chỉ super-admin biết.
 * ════════════════════════════════════════════════════════════════════════════
 */

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

// A just-rotated token (now in prevRefreshToken) is still accepted within this window
// to absorb concurrent refreshes (multi-tab / socket+axios) without forcing a logout.
export const REFRESH_GRACE_MS = 15 * 1000;

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

/**
 * Warns at boot when a cross-site production deploy would silently drop the refresh cookie.
 * @returns Nothing
 */
export function warnInsecureCookieConfig(): void {
  if (NODE_ENV !== 'production') return;
  const { sameSite, secure } = refreshCookieBase();
  const apiHost = (() => {
    try {
      return new URL(CLIENT_URL).hostname;
    } catch {
      return '';
    }
  })();
  if (sameSite !== 'none' && apiHost && !apiHost.includes('localhost')) {
    console.warn(
      '[cookie] SameSite=%s in production: refresh cookie will NOT be sent on cross-site requests. ' +
        'If FE and API are on different sites, set COOKIE_SAMESITE=none + COOKIE_SECURE=true (HTTPS).',
      sameSite
    );
  }
  if (sameSite === 'none' && !secure) {
    console.warn('[cookie] SameSite=none requires Secure; set COOKIE_SECURE=true (HTTPS).');
  }
}
