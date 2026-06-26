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

export type BackupFrequency = 'daily' | 'weekly' | 'monthly';

export interface BackupScheduleParts {
  frequency: BackupFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
}

export const DEFAULT_BACKUP_PARTS: BackupScheduleParts = {
  frequency: 'daily',
  hour: 2,
  minute: 0,
  dayOfWeek: 1,
  dayOfMonth: 1,
};

const inRange = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/**
 * Build a 5-field cron expression from friendly schedule parts.
 * @param parts - frequency + time + weekday/day-of-month
 * @returns cron expression (e.g. "0 2 * * *")
 */
export function buildBackupCron(parts: BackupScheduleParts): string {
  const { frequency, hour, minute, dayOfWeek, dayOfMonth } = parts;
  if (frequency === 'weekly') return `${minute} ${hour} * * ${dayOfWeek}`;
  if (frequency === 'monthly') return `${minute} ${hour} ${dayOfMonth} * *`;
  return `${minute} ${hour} * * *`;
}

/**
 * Parse a simple cron expression into schedule parts the visual builder can render.
 * Falls back to the default (daily 02:00) when the cron is not a plain daily/weekly/monthly time.
 * @param cron - cron expression from the backend
 * @returns schedule parts
 */
export function parseBackupCron(cron: string): BackupScheduleParts {
  const fields = cron?.trim().split(/\s+/);
  if (!fields || fields.length !== 5) return DEFAULT_BACKUP_PARTS;

  const [min, hr, dom, mon, dow] = fields;
  const minute = Number(min);
  const hour = Number(hr);
  if (!inRange(minute, 0, 59) || !inRange(hour, 0, 23) || mon !== '*') return DEFAULT_BACKUP_PARTS;

  if (dom === '*' && dow !== '*') {
    const dayOfWeek = Number(dow);
    if (!inRange(dayOfWeek, 0, 6)) return DEFAULT_BACKUP_PARTS;
    return { ...DEFAULT_BACKUP_PARTS, frequency: 'weekly', hour, minute, dayOfWeek };
  }
  if (dom !== '*' && dow === '*') {
    const dayOfMonth = Number(dom);
    if (!inRange(dayOfMonth, 1, 31)) return DEFAULT_BACKUP_PARTS;
    return { ...DEFAULT_BACKUP_PARTS, frequency: 'monthly', hour, minute, dayOfMonth };
  }
  if (dom === '*' && dow === '*') {
    return { ...DEFAULT_BACKUP_PARTS, frequency: 'daily', hour, minute };
  }
  return DEFAULT_BACKUP_PARTS;
}
