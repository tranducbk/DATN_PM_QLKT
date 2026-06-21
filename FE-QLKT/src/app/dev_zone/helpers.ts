import { DEV_SESSION_KEY, DEV_SESSION_DURATION } from '@/constants/devZone.constants';

export const DEFAULT_RETENTION_DAYS = 15;

export function saveSession(pwd: string) {
  sessionStorage.setItem(
    DEV_SESSION_KEY,
    JSON.stringify({ t: btoa(encodeURIComponent(pwd)), e: Date.now() + DEV_SESSION_DURATION })
  );
}

export function loadSession(): string | null {
  try {
    const raw = sessionStorage.getItem(DEV_SESSION_KEY);
    if (!raw) return null;
    const { t, e } = JSON.parse(raw);
    if (Date.now() > e) {
      sessionStorage.removeItem(DEV_SESSION_KEY);
      return null;
    }
    return decodeURIComponent(atob(t));
  } catch {
    sessionStorage.removeItem(DEV_SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(DEV_SESSION_KEY);
}
