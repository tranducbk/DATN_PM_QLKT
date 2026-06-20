/**
 * Non-award resource slugs — used as REST path segments, audit log `resource`
 * fields, and frontend system-log filters.
 *
 * Single source of truth for the core (non-award) resources, mirroring
 * `AWARD_SLUGS`. Rename a slug here and TypeScript flags every call site.
 */
export const RESOURCE_SLUGS = {
  ACCOUNTS: 'accounts',
  PERSONNEL: 'personnel',
  UNITS: 'units',
  POSITIONS: 'positions',
  POSITION_HISTORY: 'position-history',
  PROPOSALS: 'proposals',
  DECISIONS: 'decisions',
  PROFILES: 'profiles',
  AWARDS: 'awards',
  AUTH: 'auth',
  AWARD_BULK: 'award-bulk',
  SYSTEM_LOGS: 'system-logs',
  BACKUP: 'backup',
  DEV_ZONE: 'dev-zone',
} as const;
