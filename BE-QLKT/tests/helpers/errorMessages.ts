/**
 * Single source of truth for assertion-grade error / suggestion strings.
 *
 * Each constant mirrors the literal message produced by the corresponding
 * service. Tests should import these instead of inlining substrings — that
 * way a code-side wording change forces a single, audited test update and
 * regressions surface as exact-equality failures rather than silent passes.
 */

export const MIXED_CA_NHAN_HANG_NAM_ERROR =
  'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ/BKTTCP trong một đề xuất. ' +
  'Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ/BKTTCP.';

export const MIXED_DON_VI_HANG_NAM_ERROR =
  'Không thể đề xuất ĐVQT/ĐVTT cùng với BKBQP/BKTTCP trong một đề xuất. ' +
  'Vui lòng tách thành các đề xuất riêng: một đề xuất cho ĐVQT/ĐVTT, và một đề xuất riêng cho BKBQP/BKTTCP.';

export const PROPOSAL_ALREADY_APPROVED_ERROR = 'Đề xuất này đã được phê duyệt trước đó';
export const PROPOSAL_NOT_FOUND_ERROR = 'Đề xuất không tồn tại';
export const QUAN_NHAN_NOT_FOUND_ERROR = 'Quân nhân không tồn tại';
export const TAI_KHOAN_QUAN_NHAN_NOT_FOUND_ERROR =
  'Thông tin quân nhân của tài khoản này không tồn tại';

export const APPROVE_MISSING_MONTH_ERROR =
  'Đề xuất thiếu tháng. HCCSVV/HCQKQT/KNC bắt buộc có tháng (1-12) trước khi phê duyệt.';

export const SUBMIT_INVALID_TITLE_DATA_ERROR = 'Dữ liệu đề xuất không hợp lệ';
export const SUBMIT_MISSING_MONTH_ERROR =
  'Thiếu tháng đề xuất. Loại đề xuất này bắt buộc nhập tháng (1-12).';

export const DUPLICATE_PREFIX = 'Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):';
export const SUBMIT_INELIGIBLE_PERSONNEL_PREFIX = 'Một số quân nhân chưa đủ điều kiện:';
export const SUBMIT_INELIGIBLE_UNIT_PREFIX = 'Một số đơn vị chưa đủ điều kiện:';
export const APPROVE_ELIGIBILITY_PREFIX = 'Kiểm tra lại điều kiện trước khi phê duyệt thất bại:';
export const APPROVE_MISSING_DECISION_PREFIX = 'Thiếu số quyết định trước khi phê duyệt:';

/**
 * Builds the exact "{entityName}: Thiếu số quyết định cho danh hiệu {label}" message
 * emitted by `validateDecisionNumbers`.
 * @param entityName - Personnel `ho_ten` for personal, `ten_don_vi` for unit
 * @param danhHieuName - Vietnamese label from `getDanhHieuName`
 */
export function missingDecisionNumberMessage(entityName: string, danhHieuName: string): string {
  return `${entityName}: Thiếu số quyết định cho danh hiệu ${danhHieuName}`;
}

/**
 * Builds the exact "Quân nhân đã có danh hiệu …" duplicate message produced by
 * `validation.checkDuplicateAward` for actual stored CA_NHAN_HANG_NAM rows.
 * @param danhHieuName - Vietnamese full label (from `getDanhHieuName`)
 * @param nam - Award year
 */
export function duplicateActualAnnualMessage(danhHieuName: string, nam: number): string {
  return `Quân nhân đã có danh hiệu ${danhHieuName} năm ${nam} trên hệ thống`;
}

/** "Quân nhân đã có đề xuất danh hiệu …" message for pending CA_NHAN_HANG_NAM proposals. */
export function duplicatePendingAnnualMessage(danhHieuName: string, nam: number): string {
  return `Quân nhân đã có đề xuất danh hiệu ${danhHieuName} cho năm ${nam}`;
}

/** "Đơn vị đã có đề xuất danh hiệu …" message for pending DON_VI_HANG_NAM proposals. */
export function duplicatePendingUnitMessage(danhHieuName: string, nam: number): string {
  return `Đơn vị đã có đề xuất danh hiệu ${danhHieuName} cho năm ${nam}`;
}

/** "Đơn vị đã có danh hiệu …" message for stored DON_VI_HANG_NAM rows. */
export function duplicateActualUnitMessage(danhHieuName: string, nam: number): string {
  return `Đơn vị đã có danh hiệu ${danhHieuName} năm ${nam} trên hệ thống`;
}

export const HCQKQT_NOT_FOUND_PERSONNEL = (personnelId: string) =>
  `${personnelId}: Không tìm thấy quân nhân`;

export const HCQKQT_MISSING_NHAP_NGU = (hoTen: string) =>
  `${hoTen}: Chưa có thông tin ngày nhập ngũ`;

/** Approve.ts service-month formatted reason for HCQKQT shortage. */
export function hcqkqtNotEnoughYears(hoTen: string, totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const duration =
    years > 0 && months > 0
      ? `${years} năm ${months} tháng`
      : years > 0
        ? `${years} năm`
        : `${months} tháng`;
  return `${hoTen}: Chưa đủ 25 năm phục vụ để nhận HC QKQT (hiện ${duration})`;
}

export const KNC_MISSING_GENDER = (hoTen: string) =>
  `${hoTen}: Chưa cập nhật thông tin giới tính`;

export const KNC_MISSING_NHAP_NGU = (hoTen: string) =>
  `${hoTen}: Chưa có thông tin ngày nhập ngũ`;

/** KNC reason produced inside `approveProposal` for ineligible personnel. */
export function kncNotEnoughYears(
  hoTen: string,
  requiredYears: number,
  totalMonths: number
): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const duration =
    years > 0 && months > 0
      ? `${years} năm ${months} tháng`
      : years > 0
        ? `${years} năm`
        : `${months} tháng`;
  return `${hoTen}: Chưa đủ ${requiredYears} năm phục vụ để nhận KNC VSNXD QĐNDVN (hiện ${duration})`;
}

const NAME_BKBQP = 'Bằng khen của Bộ trưởng Bộ Quốc phòng';
const NAME_CSTDTQ = 'Chiến sĩ thi đua toàn quân';
const NAME_BKTTCP = 'Bằng khen của Thủ tướng Chính phủ';

function insufficient(name: string, required: string[], current: string[]): string {
  return `Chưa đủ điều kiện ${name}.\nYêu cầu: ${required.join(', ')}.\nHiện có: ${current.join(', ')}.`;
}

/** Personal chain-eligibility reasons emitted by `profileService.checkAwardEligibility`. */
export const eligibilityReasons = {
  bkbqpEligible: `Đủ điều kiện ${NAME_BKBQP}.`,
  cstdtqEligible: `Đủ điều kiện ${NAME_CSTDTQ}.`,
  bkttcpEligible: `Đủ điều kiện ${NAME_BKTTCP}.`,
  bkbqpReason(cstdcs: number, nckh: number): string {
    return insufficient(
      NAME_BKBQP,
      ['2 năm CSTDCS liên tục', 'NCKH mỗi năm'],
      [`${cstdcs} năm CSTDCS`, `${nckh} năm NCKH`]
    );
  },
  cstdtqReason(cstdcs: number, bkbqp: number, nckh: number): string {
    return insufficient(
      NAME_CSTDTQ,
      ['3 năm CSTDCS liên tục', '1 BKBQP', 'NCKH mỗi năm'],
      [`${cstdcs} năm CSTDCS`, `${bkbqp} BKBQP`, `${nckh} năm NCKH`]
    );
  },
  cstdtqMissedWindow(streakLength: number): string {
    return (
      `Đã bỏ lỡ thời điểm xét ${NAME_CSTDTQ}. Hiện đã ${streakLength} năm CSTDCS liên tục, ` +
      `đáng lẽ đề xuất khi đủ 3 năm. Vui lòng đợi đến khi bắt đầu chu kỳ ${NAME_CSTDTQ} mới để được xét lại.`
    );
  },
  bkttcpReason(cstdcs: number, bkbqp7: number, cstdtq7: number, nckh: number): string {
    return insufficient(
      NAME_BKTTCP,
      ['7 năm CSTDCS liên tục', '3 BKBQP', '2 CSTDTQ', 'NCKH mỗi năm'],
      [`${cstdcs} năm CSTDCS`, `${bkbqp7} BKBQP`, `${cstdtq7} CSTDTQ`, `${nckh} năm NCKH`]
    );
  },
  bkttcpMissedWindow(streakLength: number): string {
    return (
      `Đã bỏ lỡ thời điểm xét ${NAME_BKTTCP}. Hiện đã ${streakLength} năm CSTDCS liên tục, ` +
      `đáng lẽ đề xuất khi đủ 7 năm. Vui lòng đợi đến khi bắt đầu chu kỳ ${NAME_BKTTCP} mới để được xét lại.`
    );
  },
  bkttcpUnsupported:
    `Phần mềm chưa hỗ trợ khen thưởng cao hơn ${NAME_BKTTCP}, sẽ phát triển trong thời gian tới.`,
  bkttcpLifetimeBlocked:
    `Đã có ${NAME_BKTTCP}. Đây là khen thưởng một lần duy nhất.`,
  bkttcpLifetimeBlockedAndUnsupported:
    `Đã có ${NAME_BKTTCP}. Phần mềm chưa hỗ trợ các danh hiệu cao hơn ${NAME_BKTTCP}, sẽ phát triển trong thời gian tới.`,
};

/** Unit-side chain-eligibility reasons emitted by `unitAnnualAwardService.checkUnitAwardEligibility`. */
export const unitEligibilityReasons = {
  bkbqpEligible: `Đủ điều kiện ${NAME_BKBQP}.`,
  bkttcpEligible: `Đủ điều kiện ${NAME_BKTTCP}.`,
  bkbqpReason(dvqt: number): string {
    return insufficient(
      NAME_BKBQP,
      ['2 năm ĐVQT liên tục'],
      [`${dvqt} năm ĐVQT`]
    );
  },
  bkttcpReason(dvqt: number, bkbqp: number): string {
    return insufficient(
      NAME_BKTTCP,
      ['7 năm ĐVQT liên tục', '3 BKBQP'],
      [`${dvqt} năm ĐVQT`, `${bkbqp} BKBQP`]
    );
  },
  bkttcpMissedWindow(streakLength: number): string {
    return (
      `Đã bỏ lỡ thời điểm xét ${NAME_BKTTCP}. Hiện đã ${streakLength} năm ĐVQT liên tục, ` +
      `đáng lẽ đề xuất khi đủ 7 năm. Vui lòng đợi đến khi bắt đầu chu kỳ ${NAME_BKTTCP} mới để được xét lại.`
    );
  },
  bkttcpUnsupported:
    `Phần mềm chưa hỗ trợ khen thưởng cao hơn ${NAME_BKTTCP}, sẽ phát triển trong thời gian tới.`,
  bkttcpLifetimeBlocked:
    `Đã có ${NAME_BKTTCP}. Đây là khen thưởng một lần duy nhất.`,
  bkttcpLifetimeBlockedAndUnsupported:
    `Đã có ${NAME_BKTTCP}. Phần mềm chưa hỗ trợ các danh hiệu cao hơn ${NAME_BKTTCP}, sẽ phát triển trong thời gian tới.`,
};

export const NIEN_HAN_INVALID_DANH_HIEU_PREFIX =
  'Loại đề xuất "Huy chương Chiến sĩ vẻ vang" chỉ cho phép các hạng HCCSVV.';

export const HCQKQT_INVALID_DANH_HIEU_PREFIX =
  'Loại đề xuất "Huy chương Quân kỳ quyết thắng" chỉ cho phép danh hiệu HC_QKQT.';

export const KNC_INVALID_DANH_HIEU_PREFIX =
  'Loại đề xuất "Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN" chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN.';

export const HCQKQT_SUBMIT_INELIGIBLE_PREFIX =
  'Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm phục vụ):';

export const KNC_SUBMIT_INELIGIBLE_PREFIX =
  'Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN:';

/** Builds the per-personnel "<hoTen> (<reason>)" suffix used in submit-time eligibility errors. */
export function submitIneligibleEntry(hoTen: string, reason: string): string {
  return `${hoTen} (${reason})`;
}

/** Approve.ts NCKH duplicate row message ("<hoTen>: Thành tích "<moTa>" năm <nam> đã tồn tại"). */
export function nckhDuplicateMessage(hoTen: string, moTa: string, nam: number): string {
  return `${hoTen}: Thành tích "${moTa}" năm ${nam} đã tồn tại`;
}

/** HCCSVV (NIEN_HAN) Excel-import preview/confirm error messages. */
export const IMPORT_NIEN_HAN_MISSING_DECISION = 'Thiếu số quyết định';
export const IMPORT_NIEN_HAN_PERSONNEL_NOT_FOUND = (id: string) =>
  `Không tìm thấy quân nhân với ID ${id}`;
export const IMPORT_NIEN_HAN_MISSING_FIELDS = (fields: string[]) =>
  `Thiếu ${fields.join(', ')}`;
export const IMPORT_NIEN_HAN_NOT_ENOUGH_SERVICE_PREFIX = (danhHieuName: string, requiredYears: number) =>
  `Chưa đủ thời gian phục vụ cho ${danhHieuName} (yêu cầu ${requiredYears} năm`;

/** HC_QKQT Excel-import error messages. */
export const IMPORT_HCQKQT_PERSONNEL_NOT_FOUND = (id: string) =>
  `Không tìm thấy quân nhân với ID ${id}`;
export const IMPORT_HCQKQT_ALREADY_AWARDED = (nam: number) =>
  `Quân nhân đã có HC QKQT trên hệ thống (năm ${nam})`;
export const IMPORT_HCQKQT_NOT_ENOUGH_YEARS_PREFIX = 'Chưa đủ 25 năm phục vụ';

/** KNC VSNXD Excel-import error messages. */
export const IMPORT_KNC_MISSING_FIELDS = (fields: string[]) =>
  `Thiếu ${fields.join(', ')}`;
export const IMPORT_KNC_NOT_ENOUGH_SERVICE_PREFIX = (genderLabel: 'Nam' | 'Nữ', requiredYears: number) =>
  `Chưa đủ điều kiện: ${genderLabel} cần >= ${requiredYears} năm phục vụ`;
export const IMPORT_KNC_MISSING_NHAP_NGU =
  'Không có ngày nhập ngũ trong hồ sơ, không thể kiểm tra điều kiện';

/**
 * CONG_HIEN submit-time duplicate messages produced by `checkDuplicateAward`
 * inside the manager-side submit guard. The actual builder formats the full
 * Vietnamese award name + year — these helpers pin the exact wording.
 */
export function CONG_HIEN_SUBMIT_DUPLICATE_ACTUAL(danhHieuName: string, nam: number): string {
  return `Quân nhân đã có ${danhHieuName} (năm ${nam})`;
}

export function CONG_HIEN_SUBMIT_DUPLICATE_PENDING(danhHieuName: string, nam: number): string {
  return `Quân nhân đang có đề xuất ${danhHieuName} chờ duyệt (năm ${nam})`;
}

/**
 * HCBVTQ highest-rank (downgrade-block) builders. Cover messages produced by
 * `validateHCBVTQHighestRank` when the proposed rank is lower than the highest
 * one the personnel already qualifies for.
 */
export const HCBVTQ_HIGHEST_DOWNGRADE_FRAGMENT =
  'thấp hơn hạng cao nhất đủ điều kiện';

/** Builds the submit-side per-personnel downgrade-blocked error message. */
export function HCBVTQ_HIGHEST_SUBMIT_LINE(
  hoTen: string,
  proposedName: string,
  highestName: string
): string {
  return (
    `Quân nhân "${hoTen}": Đề xuất ${proposedName} thấp hơn hạng cao nhất đủ điều kiện ` +
    `${highestName}. Vui lòng đề xuất ${highestName}.`
  );
}

/** Builds the approve-side aggregated downgrade-blocked line. */
export function HCBVTQ_HIGHEST_APPROVE_LINE(
  hoTen: string,
  proposedName: string,
  highestName: string
): string {
  return (
    `${hoTen}: Đề xuất ${proposedName} thấp hơn hạng cao nhất đủ điều kiện ` +
    `${highestName}. Vui lòng đề xuất ${highestName}.`
  );
}

/** CONG_HIEN (HCBVTQ) approve & import error messages. */
export const CONG_HIEN_APPROVE_INELIGIBLE_PREFIX =
  'Không đủ điều kiện Huân chương Bảo vệ Tổ quốc';
export const CONG_HIEN_IMPORT_PENDING_PROPOSAL =
  'Quân nhân đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt';
export const CONG_HIEN_IMPORT_ALREADY_HAS_PREFIX = 'Đã có';
export const CONG_HIEN_CONFIRM_PENDING_SUFFIX = 'đang có đề xuất HC Bảo vệ Tổ quốc chờ duyệt';
export const CONG_HIEN_IMPORT_MISSING_DECISION = 'Thiếu số quyết định';
export const CONG_HIEN_IMPORT_DUPLICATE_IN_FILE =
  'Trùng lặp trong file — mỗi quân nhân chỉ có 1 HCBVTQ';

/** NCKH Excel-import error messages. */
export const IMPORT_NCKH_MISSING_FIELDS = (fields: string[]) =>
  `Thiếu ${fields.join(', ')}`;
export const IMPORT_NCKH_DUPLICATE_DB = 'Thành tích khoa học đã tồn tại';
export const IMPORT_NCKH_DUPLICATE_FILE = (nam: number, loai: string, moTa: string) =>
  `Trùng lặp trong file — cùng quân nhân, năm ${nam}, loại ${loai}, mô tả "${moTa}"`;

export const REJECT_PROPOSAL_NOT_FOUND = 'Đề xuất không tồn tại';
export const REJECT_ALREADY_APPROVED = 'Không thể từ chối đề xuất đã được phê duyệt';
export const REJECT_ALREADY_REJECTED = 'Đề xuất này đã bị từ chối trước đó';
export const REJECT_RACE_CONDITION =
  'Đề xuất đã bị thay đổi bởi người khác. Vui lòng tải lại trang và thử lại.';

export const DELETE_PROPOSAL_NOT_FOUND = 'Đề xuất không tồn tại';
export const DELETE_FORBIDDEN_OTHERS = 'Bạn chỉ có thể xóa đề xuất của chính mình';
export const DELETE_ONLY_PENDING = 'Chỉ có thể xóa đề xuất đang chờ duyệt (PENDING)';
export const DELETE_RACE_CONDITION =
  'Đề xuất đã bị thay đổi bởi người khác (có thể đã được phê duyệt hoặc từ chối). Vui lòng tải lại trang.';

/** Manager-scope visibility error from `getProposalById`. */
export const PROPOSAL_VIEW_FORBIDDEN_OTHERS = 'Bạn không có quyền xem đề xuất này';

/** HC_QKQT lifetime duplicate message produced by `checkDuplicateAward`. */
export function hcqkqtAlreadyAwardedMessage(nam: number): string {
  return `Quân nhân đã có Huy chương Quân kỳ quyết thắng (năm ${nam})`;
}

/** Bulk CONG_HIEN rank-upgrade guard messages produced by `awardBulk.service`. */
export function hcbvtqBulkDowngradeBlocked(
  hoTen: string,
  existingDanhHieuName: string,
  newDanhHieuName: string
): string {
  return `Quân nhân "${hoTen}": đã có ${existingDanhHieuName}, không thể downgrade xuống ${newDanhHieuName}`;
}

export function hcbvtqBulkDuplicateBlocked(
  hoTen: string,
  existingDanhHieuName: string,
  newDanhHieuName: string
): string {
  return `Quân nhân "${hoTen}": đã có ${existingDanhHieuName}, không thể thêm trùng ${newDanhHieuName}`;
}

/** CONG_HIEN downgrade-blocked message produced inside the approve transaction. */
export function congHienLowerOrEqualBlocked(
  hoTen: string,
  existingDanhHieuName: string,
  existingNam: number,
  newDanhHieuName: string
): string {
  return (
    `Quân nhân "${hoTen}" đã có Huân chương Bảo vệ Tổ quốc "${existingDanhHieuName}" (năm ${existingNam}). ` +
    `Không thể lưu danh hiệu "${newDanhHieuName}" vì hạng thấp hơn hoặc bằng.`
  );
}

export const POSITION_HISTORY_PERSONNEL_ID_REQUIRED = 'Personnel ID is required';
export const POSITION_HISTORY_DATA_INVALID = 'Dữ liệu không hợp lệ';
export const POSITION_HISTORY_PERSONNEL_ID_REQUIRED_CREATE = 'ID quân nhân là bắt buộc';
export const POSITION_HISTORY_CHUC_VU_ID_REQUIRED = 'ID chức vụ là bắt buộc';
export const POSITION_HISTORY_NGAY_BAT_DAU_REQUIRED = 'Ngày bắt đầu là bắt buộc';
export const POSITION_HISTORY_DATE_ORDER_INVALID = 'Ngày bắt đầu phải trước ngày kết thúc';
export const POSITION_HISTORY_PERSONNEL_NOT_FOUND = 'Quân nhân không tồn tại';
export const POSITION_HISTORY_CHUC_VU_NOT_FOUND = 'Chức vụ không tồn tại';
export const POSITION_HISTORY_NOT_FOUND = 'Lịch sử chức vụ không tồn tại';
export const POSITION_HISTORY_ID_REQUIRED = 'ID lịch sử chức vụ là bắt buộc';

/** Builds the overlap error message produced by createPositionHistory. */
export function positionHistoryOverlapCreateMessage(
  existingStart: string,
  existingEnd: string
): string {
  return (
    `Khoảng thời gian đảm nhiệm chức vụ trùng lặp với chức vụ khác (${existingStart} - ${existingEnd}). ` +
    `Vui lòng chọn khoảng thời gian không trùng lặp.`
  );
}

/** Builds the overlap error message produced by updatePositionHistory. */
export function positionHistoryOverlapUpdateMessage(
  existingStart: string,
  existingEnd: string
): string {
  return (
    `Khoảng thời gian đảm nhiệm chức vụ trùng lặp với chức vụ khác (${existingStart} - ${existingEnd}). ` +
    `Vui lòng điều chỉnh ngày bắt đầu/kết thúc để không bị chồng lấn.`
  );
}

/** Suggestion (`goi_y`) strings emitted by `recalculateAnnualProfile` / `recalculateAnnualUnit`. */
export const suggestionMessages = {
  personalEligibleBkttcp: 'Đã đủ điều kiện đề nghị xét Bằng khen của Thủ tướng Chính phủ.',
  personalEligibleCstdtq: 'Đã đủ điều kiện đề nghị xét Chiến sĩ thi đua toàn quân.',
  personalEligibleBkbqp: 'Đã đủ điều kiện đề nghị xét Bằng khen của Bộ trưởng Bộ Quốc phòng.',
  personalNotEligible:
    'Chưa đủ điều kiện đề nghị xét Bằng khen của Bộ trưởng Bộ Quốc phòng hoặc Chiến sĩ thi đua toàn quân.',
  personalUnsupported:
    'Phần mềm chưa hỗ trợ khen thưởng cao hơn Bằng khen của Thủ tướng Chính phủ, sẽ phát triển trong thời gian tới.',
  unitEligibleBkttcp: 'Đã đủ điều kiện đề nghị xét Bằng khen của Thủ tướng Chính phủ.',
  unitEligibleBkbqp: 'Đã đủ điều kiện đề nghị xét Bằng khen của Bộ trưởng Bộ Quốc phòng.',
  unitNotEligible: 'Chưa đủ điều kiện đề nghị xét Bằng khen của Bộ trưởng Bộ Quốc phòng.',
  unitUnsupported:
    'Phần mềm chưa hỗ trợ khen thưởng cao hơn Bằng khen của Thủ tướng Chính phủ, sẽ phát triển trong thời gian tới.',
};

/**
 * Personnel-state-during-flow builders. Cover messages surfaced when a personnel
 * or account row mutates between submit and approve.
 */
export const PERSONNEL_STATE_HCQKQT_NOT_FOUND = (personnelId: string) =>
  `${personnelId}: Không tìm thấy quân nhân`;
export const PERSONNEL_STATE_HCQKQT_MISSING_NHAP_NGU = (hoTen: string) =>
  `${hoTen}: Chưa có thông tin ngày nhập ngũ`;

/**
 * Date-boundary builders. Pin submit/approve messages emitted when proposal
 * year/month or personnel enlistment dates land at edge cases. Submit + approve
 * + bulk all share the unified format from `buildServiceYearsErrorMessage`.
 */
export const DATE_BOUNDARY_HCQKQT_PREFIX =
  'Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm phục vụ):';
export const DATE_BOUNDARY_HCQKQT_NOT_ENOUGH_LINE = (hoTen: string, totalMonths: number) =>
  hcqkqtNotEnoughYears(hoTen, totalMonths);

/**
 * Bulk-duplicate-in-file builders. Cover messages produced when one upload
 * payload contains the same personnel/award twice.
 */
export const BULK_DUP_PAYLOAD_PREFIX = 'Phát hiện dữ liệu bị lặp ngay trong payload đề xuất.';
export const BULK_DUP_PAYLOAD_LINE = (hoTen: string, danhHieu: string) =>
  `${hoTen}: ${danhHieu}`;
export const BULK_DUP_EXCEL_FILE_DUPLICATE = (nam: number) =>
  `Trùng lặp trong file — cùng quân nhân, năm ${nam}`;

/**
 * Type-confusion builders. Pin behavior when the service receives string-typed
 * numerics, untrimmed IDs, or empty-string vs null decision numbers.
 */
export const TYPE_CONFUSION_MISSING_MONTH =
  'Thiếu tháng đề xuất. Loại đề xuất này bắt buộc nhập tháng (1-12).';
export const TYPE_CONFUSION_INVALID_DANH_HIEU_PREFIX =
  'Phát hiện danh hiệu không hợp lệ trong dữ liệu đề xuất.';

/** Profile-recalc-lag builder for delete-not-found errors. */
export const RECALC_DELETE_NOT_FOUND = 'Danh hiệu hằng năm không tồn tại';
