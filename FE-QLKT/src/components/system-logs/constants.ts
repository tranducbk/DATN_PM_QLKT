/** Mapping action code → label tiếng Việt (dùng cho cả filter và table) */
export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Tạo',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
  APPROVE: 'Phê duyệt',
  REJECT: 'Từ chối',
  LOGIN: 'Đăng nhập',
  LOGOUT: 'Đăng xuất',
  RESET_PASSWORD: 'Đặt lại mật khẩu',
  CHANGE_PASSWORD: 'Đổi mật khẩu',
  IMPORT: 'Nhập dữ liệu',
  IMPORT_PREVIEW: 'Tải lên xem trước',
  EXPORT: 'Xuất dữ liệu',
  BULK: 'Thêm đồng loạt',
  BULK_CREATE: 'Thêm đồng loạt',
  RECALCULATE: 'Tính toán lại',
  BACKUP: 'Sao lưu',
};

export { ROLE_LABELS } from '@/constants/roles.constants';

/** Lấy label tiếng Việt cho action, fallback format đẹp nếu chưa có trong map */
export function getActionLabel(action: string): string {
  if (!action) return '-';
  const upper = action.toUpperCase();
  if (ACTION_LABELS[upper]) return ACTION_LABELS[upper];
  const base = upper.split('_')[0];
  if (ACTION_LABELS[base]) return ACTION_LABELS[base];
  return action
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
