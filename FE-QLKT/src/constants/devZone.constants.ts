/**
 * Constants cho Dev Zone
 */

import { AWARD_TYPE_REGISTRY } from './awardTypeRegistry.constants';
import { PROPOSAL_TYPES } from './proposalTypes.constants';

export const DEV_ZONE_API = '/api/dev-zone';

export const DEV_SESSION_KEY = 'dev_zone_session';
export const DEV_SESSION_DURATION = 15 * 60 * 1000; // 15 minutes

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

const AWARD_TOGGLE_DESCRIPTION = 'Nhập dữ liệu, file mẫu, thêm đồng loạt';

/** Award enable/disable toggles. `key` feeds the `allow_<key>` flag; labels come from AWARD_TYPE_REGISTRY. */
export const AWARD_TYPE_OPTIONS = (
  [
    ['annual', PROPOSAL_TYPES.CA_NHAN_HANG_NAM],
    ['unit', PROPOSAL_TYPES.DON_VI_HANG_NAM],
    ['hccsvv', PROPOSAL_TYPES.NIEN_HAN],
    ['contribution', PROPOSAL_TYPES.CONG_HIEN],
    ['commemoration', PROPOSAL_TYPES.KNC_VSNXD_QDNDVN],
    ['militaryFlag', PROPOSAL_TYPES.HC_QKQT],
    ['scientific', PROPOSAL_TYPES.NCKH],
  ] as const
).map(([key, proposalType]) => ({
  key,
  label: AWARD_TYPE_REGISTRY[proposalType].label,
  description: AWARD_TOGGLE_DESCRIPTION,
}));

export const SYSTEM_FEATURE_OPTIONS = [
  {
    key: 'notify_import',
    label: 'Thông báo khi nhập khen thưởng',
    description: 'Gửi thông báo cho chỉ huy đơn vị khi nhập/thêm khen thưởng cho đơn vị đó',
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

/** Preset lịch backup tự động */
export const BACKUP_CRON_PRESETS = [
  { label: 'Mỗi ngày lúc 02:00', value: '0 2 * * *' },
  { label: 'Mỗi tuần (Thứ 2 lúc 02:00)', value: '0 2 * * 1' },
  { label: 'Ngày 1 hàng tháng lúc 02:00', value: '0 2 1 * *' },
  { label: 'Tùy chỉnh', value: 'custom' },
] as const;
