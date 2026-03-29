/** Số dòng tối đa cho phép import từ file Excel */
export const MAX_EXCEL_ROWS = 5000;

/** Số dòng tối thiểu cho template (đảm bảo dropdown hoạt động) */
export const MIN_TEMPLATE_ROWS = 50;

/** Giới hạn ký tự cho Excel inline data validation */
export const EXCEL_INLINE_VALIDATION_MAX_LENGTH = 250;

/** Số quyết định tối đa lấy cho dropdown trong template */
export const MAX_DECISION_DROPDOWN = 200;

/** Timeout mặc định cho transaction import (ms) */
export const IMPORT_TRANSACTION_TIMEOUT = 30000;

/** Danh sách cấp bậc quân sự */
export const CAP_BAC_OPTIONS = [
  'Binh nhì',
  'Binh nhất',
  'Hạ sĩ',
  'Trung sĩ',
  'Thượng sĩ',
  'Thiếu úy',
  'Trung úy',
  'Thượng úy',
  'Đại úy',
  'Thiếu tá',
  'Trung tá',
  'Thượng tá',
  'Đại tá',
  'Thiếu tướng',
  'Trung tướng',
  'Thượng tướng',
  'Đại tướng',
] as const;

/** Chuỗi cấp bậc phân cách bằng dấu phẩy (dùng cho Excel dropdown) */
export const CAP_BAC_OPTIONS_STRING = CAP_BAC_OPTIONS.join(',');
