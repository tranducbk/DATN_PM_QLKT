/**
 * Constants cho Dev Zone
 */

export const DEV_ZONE_API = '/api/dev-zone';

export const DEV_SESSION_KEY = 'dev_zone_session';
export const DEV_SESSION_DURATION = 15 * 60 * 1000; // 15 phút

/** Preset lịch chạy cron job */
export const CRON_PRESETS = [
  { label: 'Mỗi 5 phút', value: '*/5 * * * *' },
  { label: 'Mỗi 30 phút', value: '*/30 * * * *' },
  { label: 'Mỗi 1 giờ', value: '0 * * * *' },
  { label: 'Mỗi 6 giờ', value: '0 */6 * * *' },
  { label: 'Mỗi ngày lúc 01:00', value: '0 1 * * *' },
  { label: 'Mỗi tuần (Thứ 2 lúc 01:00)', value: '0 1 * * 1' },
  { label: 'Ngày 1 hàng tháng lúc 01:00', value: '0 1 1 * *' },
  { label: 'Tùy chỉnh', value: 'custom' },
] as const;

/** Danh sách loại khen thưởng cho toggle bật/tắt */
export const AWARD_TYPE_OPTIONS = [
  { key: 'annual', label: 'Cá nhân hằng năm', description: 'Import, file mẫu, thêm đồng loạt' },
  { key: 'unit', label: 'Đơn vị hằng năm', description: 'Import, file mẫu, thêm đồng loạt' },
  { key: 'hccsvv', label: 'HC Chiến sĩ Vẻ vang', description: 'Import, file mẫu, thêm đồng loạt' },
  {
    key: 'contribution',
    label: 'HC Bảo vệ Tổ quốc',
    description: 'Import, file mẫu, thêm đồng loạt',
  },
  {
    key: 'commemoration',
    label: 'Kỷ niệm chương VSNXD QĐNDVN',
    description: 'Import, file mẫu, thêm đồng loạt',
  },
  {
    key: 'militaryFlag',
    label: 'HC Quân kỳ Quyết thắng',
    description: 'Import, file mẫu, thêm đồng loạt',
  },
  {
    key: 'scientific',
    label: 'Thành tích khoa học',
    description: 'Import, file mẫu, thêm đồng loạt',
  },
] as const;

/** Tính năng hệ thống (không phải award type) */
export const SYSTEM_FEATURE_OPTIONS = [
  {
    key: 'notify_import',
    label: 'Thông báo khi import khen thưởng',
    description: 'Gửi thông báo cho chỉ huy đơn vị khi import/thêm khen thưởng cho đơn vị đó',
  },
  {
    key: 'delete_logs',
    label: 'Xoá nhật ký hệ thống',
    description: 'Cho phép ADMIN, SUPER_ADMIN xoá nhật ký hệ thống',
  },
  {
    key: 'view_errors_super_admin',
    label: 'Xem lỗi hệ thống — Super Admin',
    description: 'Cho phép SUPER_ADMIN xem log lỗi trong nhật ký hệ thống',
  },
  {
    key: 'view_errors_admin',
    label: 'Xem lỗi hệ thống — Admin',
    description: 'Cho phép ADMIN xem log lỗi trong nhật ký hệ thống',
  },
  {
    key: 'view_errors_manager',
    label: 'Xem lỗi hệ thống — Manager',
    description: 'Cho phép MANAGER xem log lỗi trong nhật ký hệ thống',
  },
] as const;

/** Cron schedule mặc định */
export const DEFAULT_CRON_SCHEDULE = '0 1 1 * *';
