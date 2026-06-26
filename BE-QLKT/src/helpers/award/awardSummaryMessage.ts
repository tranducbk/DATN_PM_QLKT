import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AWARD SUMMARY MESSAGE — build message kết quả sau import/approve
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Sau khi approve/bulk create xong, FE hiển thị message dạng:
 *      "Đã thêm thành công 100 danh hiệu cho 50 quân nhân, 2 lỗi"
 *
 *  HÀM NÀY BUILD MESSAGE Ở BE thay vì FE vì:
 *  1. Logic message tiếng Việt phức tạp (số ít/số nhiều, có/không lỗi).
 *  2. Caller FE chỉ cần render thẳng → không reinvent logic ở 5 chỗ.
 *  3. Đảm bảo consistency: cùng 1 wording dùng cho tất cả entry point.
 *
 *  CÁC TRƯỜNG HỢP:
 *  ① importedCount > 0 && errorCount > 0 → "Đã thêm X, Y lỗi"
 *  ② importedCount > 0 && errorCount === 0 → "Đã thêm X"
 *  ③ importedCount === 0 && errorCount > 0 → "Có Y lỗi khi xử lý"
 *  ④ importedCount === 0 && errorCount === 0 → "Không có dữ liệu"
 *
 *  PHÂN BIỆT theo proposal type:
 *  - DON_VI_HANG_NAM → "X danh hiệu cho Y đơn vị"
 *  - Còn lại        → "X danh hiệu cho Y quân nhân"
 *  - NCKH           → "X thành tích cho Y quân nhân"
 *  - NIEN_HAN/...   → "X huân chương cho Y quân nhân"
 *
 *  Tách buildBulk... và buildApprove... vì:
 *  - Bulk có 1 import count.
 *  - Approve có 3 import count (danh_hieu + thanh_tich + nien_han) →
 *    cần biết loại nào active để format.
 *
 *  IMPORT STRING-BUILD vs FE TEMPLATE:
 *  Tại sao không gửi structured data { count, errors } cho FE format:
 *  - FE phải dispatch theo type → duplicate logic.
 *  - Khó test (test FE phải render component).
 *  - String message dễ assertion trong jest BE.
 * ════════════════════════════════════════════════════════════════════════════
 */

interface BuildBulkAwardSummaryParams {
  type: string;
  importedCount: number;
  errorCount: number;
  affectedPersonnelCount: number;
  affectedUnitCount: number;
}

interface BuildApproveSummaryParams {
  proposalType: string;
  importedDanhHieu: number;
  importedThanhTich: number;
  importedNienHan: number;
  errorCount: number;
  affectedPersonnelCount: number;
  affectedUnitCount: number;
}

/**
 * Builds user-facing summary text for bulk award creation.
 * @param params - Aggregated import counts and target scope
 * @returns Human-readable Vietnamese message
 */
export function buildBulkAwardSummaryMessage(params: BuildBulkAwardSummaryParams): string {
  const { type, importedCount, errorCount, affectedPersonnelCount, affectedUnitCount } = params;
  const successPrefix =
    type === PROPOSAL_TYPES.DON_VI_HANG_NAM
      ? `Đã thêm thành công ${importedCount} danh hiệu cho ${affectedUnitCount} đơn vị`
      : `Đã thêm thành công ${importedCount} danh hiệu cho ${affectedPersonnelCount} quân nhân`;

  if (importedCount > 0 && errorCount > 0) {
    return `${successPrefix}, ${errorCount} lỗi`;
  }

  if (importedCount > 0) {
    return successPrefix;
  }

  if (errorCount > 0) {
    return `Thêm khen thưởng thất bại: ${errorCount} lỗi`;
  }

  return 'Không có dữ liệu nào được thêm';
}

type ApproveSummarySpec = { count: number; noun: string; scope: number; scopeLabel: string };

/** Resolves the count/noun/scope tuple that varies per proposal type. */
function resolveApproveSummarySpec(params: BuildApproveSummaryParams): ApproveSummarySpec {
  const {
    proposalType,
    importedDanhHieu,
    importedThanhTich,
    importedNienHan,
    affectedPersonnelCount,
    affectedUnitCount,
  } = params;

  if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    return {
      count: importedDanhHieu,
      noun: 'danh hiệu',
      scope: affectedUnitCount,
      scopeLabel: 'đơn vị',
    };
  }
  if (proposalType === PROPOSAL_TYPES.NCKH) {
    return {
      count: importedThanhTich,
      noun: 'thành tích',
      scope: affectedPersonnelCount,
      scopeLabel: 'quân nhân',
    };
  }
  if (
    proposalType === PROPOSAL_TYPES.NIEN_HAN ||
    proposalType === PROPOSAL_TYPES.HC_QKQT ||
    proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
  ) {
    return {
      count: importedNienHan,
      noun: 'danh hiệu',
      scope: affectedPersonnelCount,
      scopeLabel: 'quân nhân',
    };
  }
  return {
    count: importedDanhHieu,
    noun: 'danh hiệu',
    scope: affectedPersonnelCount,
    scopeLabel: 'quân nhân',
  };
}

/**
 * Builds user-facing summary text for proposal approval import.
 * @param params - Aggregated import counts and target scope
 * @returns Human-readable Vietnamese message
 */
export function buildApproveSummaryMessage(params: BuildApproveSummaryParams): string {
  const { count, noun, scope, scopeLabel } = resolveApproveSummarySpec(params);
  const message = `Phê duyệt thành công, đã thêm ${count} ${noun} cho ${scope} ${scopeLabel}`;
  return params.errorCount > 0 ? `${message}, ${params.errorCount} lỗi` : message;
}
