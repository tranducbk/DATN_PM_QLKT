/**
 * localStorage keys owned by the auth flow. Anything outside this list (notably `theme`)
 * is treated as a user preference that should survive logout / forced re-login.
 */
const AUTH_STORAGE_KEYS = [
  'accessToken',
  'refreshToken',
  'role',
  'username',
  'userId',
  'quan_nhan_id',
  'ho_ten',
  'don_vi_id',
] as const;

/**
 * Remove all auth-related keys without touching user preferences (theme, etc).
 * Use this instead of `localStorage.clear()` on logout/session-expiry paths.
 */
export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}
