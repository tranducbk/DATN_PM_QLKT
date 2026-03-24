/**
 * Constants cho Dev Zone — cấu hình hệ thống
 */

/** Giá trị mặc định seed vào bảng system_settings khi DB mới tạo */
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
  allow_delete_logs: 'false',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Danh sách các loại khen thưởng hỗ trợ toggle import */
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

/** Tính năng hệ thống (không phải award type) */
export const SYSTEM_FEATURES = ['delete_logs'] as const;

export type SystemFeature = (typeof SYSTEM_FEATURES)[number];
