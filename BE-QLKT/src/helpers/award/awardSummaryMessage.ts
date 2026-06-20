import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';

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
