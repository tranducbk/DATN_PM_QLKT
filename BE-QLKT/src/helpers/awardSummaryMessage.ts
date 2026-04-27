import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';

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

/**
 * Builds user-facing summary text for proposal approval import.
 * @param params - Aggregated import counts and target scope
 * @returns Human-readable Vietnamese message
 */
export function buildApproveSummaryMessage(params: BuildApproveSummaryParams): string {
  const {
    proposalType,
    importedDanhHieu,
    importedThanhTich,
    importedNienHan,
    errorCount,
    affectedPersonnelCount,
    affectedUnitCount,
  } = params;

  let message = 'Phê duyệt thành công';
  if (proposalType === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
    message = `Phê duyệt thành công, đã thêm ${importedDanhHieu} danh hiệu cho ${affectedUnitCount} đơn vị`;
  } else if (proposalType === PROPOSAL_TYPES.NCKH) {
    message = `Phê duyệt thành công, đã thêm ${importedThanhTich} thành tích cho ${affectedPersonnelCount} quân nhân`;
  } else if (
    proposalType === PROPOSAL_TYPES.NIEN_HAN ||
    proposalType === PROPOSAL_TYPES.HC_QKQT ||
    proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
  ) {
    message = `Phê duyệt thành công, đã thêm ${importedNienHan} danh hiệu cho ${affectedPersonnelCount} quân nhân`;
  } else {
    message = `Phê duyệt thành công, đã thêm ${importedDanhHieu} danh hiệu cho ${affectedPersonnelCount} quân nhân`;
  }

  if (errorCount > 0) {
    return `${message}, ${errorCount} lỗi`;
  }

  return message;
}
