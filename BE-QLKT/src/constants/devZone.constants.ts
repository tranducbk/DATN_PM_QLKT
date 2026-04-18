export const SETTING_DEFAULTS = {
  cron_enabled: 'true',
  cron_schedule: '0 1 1 * *',
  allow_annual: 'false',
  allow_unit: 'false',
  allow_hccsvv: 'false',
  allow_contribution: 'false',
  allow_commemoration: 'false',
  allow_militaryFlag: 'false',
  allow_scientific: 'false',
  allow_notify_import: 'false',
  allow_delete_logs: 'false',
  allow_view_errors_super_admin: 'false',
  allow_view_errors_admin: 'false',
  allow_view_errors_manager: 'false',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const AWARD_TYPES = [
  'annual',
  'unit',
  'hccsvv',
  'contribution',
  'commemoration',
  'militaryFlag',
  'scientific',
] as const;

export type AwardType = (typeof AWARD_TYPES)[number];

export const SYSTEM_FEATURES = ['notify_import', 'delete_logs', 'view_errors_super_admin', 'view_errors_admin', 'view_errors_manager'] as const;

export type SystemFeature = (typeof SYSTEM_FEATURES)[number];
