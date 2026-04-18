export const MAX_EXCEL_ROWS = 5000;
export const MIN_TEMPLATE_ROWS = 50;

export const EXCEL_INLINE_VALIDATION_MAX_LENGTH = 250;

export const MAX_DECISION_DROPDOWN = 200;

export const IMPORT_TRANSACTION_TIMEOUT = 30000;

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

export const CAP_BAC_OPTIONS_STRING = CAP_BAC_OPTIONS.join(',');
