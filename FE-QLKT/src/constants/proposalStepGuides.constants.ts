/**
 * Standardized guidance text for the proposal/bulk-award wizard steps.
 * Centralizing the recurring lines keeps wording identical across every award type;
 * type-specific lines stay inline in each Step component.
 */

/**
 * Builds a wizard step heading with a consistent "Bước N: <action> - <label>" format.
 * @param step - Step number shown to the user
 * @param action - Action verb phrase (e.g. "Lựa chọn quân nhân")
 * @param label - Optional award-type label appended after a hyphen
 * @returns The formatted heading string
 */
export const stepGuideTitle = (step: number, action: string, label?: string): string =>
  label ? `Bước ${step}: ${action} - ${label}` : `Bước ${step}: ${action}`;

export const GUIDE_LINES = {
  pickYear: 'Chọn năm đề xuất để hệ thống xét điều kiện theo đúng kỳ xét.',
  pickYearMonth: 'Chọn năm và tháng đề xuất để hệ thống xét điều kiện theo đúng kỳ xét.',
  selectEligible: 'Lựa chọn quân nhân đủ điều kiện từ danh sách.',
  checkWarning: 'Kiểm tra cảnh báo điều kiện trước khi xác nhận lựa chọn.',
  allHaveTitle: 'Đảm bảo tất cả quân nhân đã có danh hiệu trước khi chuyển bước.',
  allUnitsHaveTitle: 'Đảm bảo tất cả đơn vị đã có danh hiệu trước khi chuyển bước.',
  nextToTitles: 'Hoàn tất lựa chọn, nhấn "Tiếp tục" để sang bước thiết lập danh hiệu.',
  nextToInfoNckh: 'Hoàn tất lựa chọn, nhấn "Tiếp tục" để sang bước thiết lập thông tin thành tích.',
  nextToAttach: 'Hoàn tất khai báo, nhấn "Tiếp tục" để sang bước đính kèm tệp.',
} as const;
