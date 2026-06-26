import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  HCQKQT_YEARS_REQUIRED,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '../../constants/danhHieu.constants';
import { GENDER } from '../../constants/gender.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SERVICE YEARS ELIGIBILITY — eligibility theo SỐ NĂM PHỤC VỤ
 *  (dùng chung cho HC_QKQT và KNC_VSNXD_QDNDVN)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  CẢ 2 LOẠI HUÂN CHƯƠNG đều xét trên cùng tiêu chí cơ bản:
 *  "Quân nhân đã phục vụ ≥ N năm trong quân ngũ" (lifetime, 1 lần).
 *
 *  NGƯỠNG (constants):
 *      HCQKQT_YEARS_REQUIRED = 25 năm  (Huân chương Quân kỳ Quyết thắng,
 *                                       sĩ quan — không phân biệt nam/nữ)
 *      KNC_YEARS_REQUIRED_NAM = 25 năm (Kỷ niệm chương vì sự nghiệp xây
 *                                       dựng QĐNDVN — nam giới)
 *      KNC_YEARS_REQUIRED_NU  = 20 năm (KNC — nữ giới, ưu đãi giới)
 *
 *  CÔNG THỨC:
 *      totalMonths = calculateServiceMonths(ngay_nhap_ngu, ngay_xuat_ngu ?? refDate)
 *      eligible    = totalMonths >= requiredYears * 12
 *
 *      refDate = ngày tham chiếu (thường = ngày cuối tháng đề xuất).
 *      Quân nhân chưa xuất ngũ (ngay_xuat_ngu=null) → tính đến refDate.
 *      Quân nhân đã xuất ngũ → tính đến ngày xuất ngũ (đóng băng số tháng).
 *
 *  PHÂN BIỆT REASON CODE (cho i18n + format message):
 *      NOT_FOUND        → personnel không tồn tại trong DB (có thể bị xoá
 *                         giữa chừng — không leak CUID, hướng dẫn tải lại)
 *      MISSING_GENDER   → KNC bắt buộc giới tính (vì threshold khác nhau);
 *                         HC_QKQT bỏ qua check này
 *      MISSING_NHAP_NGU → thiếu ngày nhập ngũ (không thể tính số tháng)
 *      NOT_ENOUGH_YEARS → service time < threshold
 *
 *  PURE FUNCTION DESIGN:
 *  evaluateServiceYears KHÔNG query DB — caller (strategy) phải load
 *  personnel + truyền vào. Lý do:
 *    - Test dễ (chỉ cần inject fixture).
 *    - Caller có thể batch load nhiều personnel cùng lúc (batchEvaluate-
 *      ServiceYears dùng findMany({in: [...]})) thay vì N+1 query trong loop.
 * ════════════════════════════════════════════════════════════════════════════
 */

type ServiceYearsProposalType = 'HC_QKQT' | 'KNC_VSNXD_QDNDVN';

/** Vietnamese display label per proposal type — used in unified error messages. */
const SERVICE_YEARS_AWARD_LABEL: Record<ServiceYearsProposalType, string> = {
  HC_QKQT: 'HC QKQT',
  KNC_VSNXD_QDNDVN: 'KNC VSNXD QĐNDVN',
};

// Personnel selected from the system can only be "not found" if deleted mid-flow (a race);
// the CUID is not actionable for the operator, so guide them to reload instead of leaking it.
export const SERVICE_YEARS_PERSONNEL_NOT_FOUND =
  'Không tìm thấy thông tin một quân nhân (có thể đã bị xoá khỏi hệ thống) — vui lòng tải lại và thử lại.';

interface ServiceYearsPersonnel {
  id: string;
  ho_ten: string;
  gioi_tinh?: string | null;
  ngay_nhap_ngu: Date | null;
  ngay_xuat_ngu: Date | null;
}

type ServiceYearsFailureReason =
  | 'NOT_FOUND'
  | 'MISSING_GENDER'
  | 'MISSING_NHAP_NGU'
  | 'NOT_ENOUGH_YEARS';

export interface ServiceYearsEligibilityResult {
  personnelId: string;
  hoTen: string | null;
  eligible: boolean;
  reason: ServiceYearsFailureReason | null;
  totalMonths: number | null;
  requiredYears: number | null;
}

/**
 * Returns the gender-aware required-year threshold for a service-time award.
 * @param proposalType - HC_QKQT or KNC_VSNXD_QDNDVN
 * @param gioiTinh - Personnel gender (only consulted for KNC)
 * @returns Required years (25 for HC_QKQT and KNC nam, 20 for KNC nu)
 */
export function requiredServiceYears(
  proposalType: ServiceYearsProposalType,
  gioiTinh: string | null | undefined
): number {
  if (proposalType === PROPOSAL_TYPES.HC_QKQT) return HCQKQT_YEARS_REQUIRED; // HC QKQT: 25 năm, không phân biệt giới
  return gioiTinh === GENDER.FEMALE ? KNC_YEARS_REQUIRED_NU : KNC_YEARS_REQUIRED_NAM; // KNC: nữ 20 năm, nam 25 năm
}

/**
 * Pure evaluation of whether one personnel meets the minimum service years.
 * KNC additionally requires gender to be set; HC_QKQT skips gender check.
 * @param personnel - Personnel row, or null when not found in DB
 * @param personnelId - Original id (used in NOT_FOUND results)
 * @param proposalType - HC_QKQT or KNC_VSNXD_QDNDVN
 * @param refDate - Fallback end date when personnel has no ngay_xuat_ngu
 * @returns Structured eligibility result; callers format error messages
 */
export function evaluateServiceYears(
  personnel: ServiceYearsPersonnel | null | undefined,
  personnelId: string,
  proposalType: ServiceYearsProposalType,
  refDate: Date
): ServiceYearsEligibilityResult {
  // Không tìm thấy quân nhân (có thể bị xoá giữa chừng) → NOT_FOUND.
  if (!personnel) {
    return {
      personnelId,
      hoTen: null,
      eligible: false,
      reason: 'NOT_FOUND',
      totalMonths: null,
      requiredYears: null,
    };
  }
  // KNC bắt buộc có giới tính vì ngưỡng nam/nữ khác nhau; HC_QKQT thì bỏ qua bước này.
  if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
    const gender = personnel.gioi_tinh;
    if (!gender || (gender !== GENDER.MALE && gender !== GENDER.FEMALE)) {
      return {
        personnelId,
        hoTen: personnel.ho_ten,
        eligible: false,
        reason: 'MISSING_GENDER',
        totalMonths: null,
        requiredYears: null,
      };
    }
  }
  // Thiếu ngày nhập ngũ → không thể tính số tháng phục vụ → MISSING_NHAP_NGU.
  if (!personnel.ngay_nhap_ngu) {
    return {
      personnelId,
      hoTen: personnel.ho_ten,
      eligible: false,
      reason: 'MISSING_NHAP_NGU',
      totalMonths: null,
      requiredYears: null,
    };
  }

  const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
  // Đã xuất ngũ → tính đến ngày xuất ngũ (đóng băng); còn tại ngũ → tính đến refDate.
  const ngayKetThuc = personnel.ngay_xuat_ngu ? new Date(personnel.ngay_xuat_ngu) : refDate;
  const totalMonths = calculateServiceMonths(ngayNhapNgu, ngayKetThuc); // tổng số tháng phục vụ
  const requiredYears = requiredServiceYears(proposalType, personnel.gioi_tinh); // ngưỡng năm theo loại + giới

  // Quy ngưỡng năm ra tháng (×12) để so trực tiếp; thiếu → NOT_ENOUGH_YEARS.
  if (totalMonths < requiredYears * 12) {
    return {
      personnelId,
      hoTen: personnel.ho_ten,
      eligible: false,
      reason: 'NOT_ENOUGH_YEARS',
      totalMonths,
      requiredYears,
    };
  }
  return {
    personnelId,
    hoTen: personnel.ho_ten,
    eligible: true,
    reason: null,
    totalMonths,
    requiredYears,
  };
}

/**
 * Builds the unified per-personnel error line for service-years eligibility failures.
 * Shared by submit / approve / awardBulk so all three paths emit identical wording.
 * Format for shortage: `${hoTen}: Chưa đủ ${requiredYears} năm phục vụ để nhận ${label} (hiện ${duration})`
 * @param result - Output of `evaluateServiceYears`
 * @param proposalType - HC_QKQT or KNC_VSNXD_QDNDVN
 * @returns Formatted line, or null when the personnel is eligible
 */
export function buildServiceYearsErrorMessage(
  result: ServiceYearsEligibilityResult,
  proposalType: ServiceYearsProposalType
): string | null {
  if (result.eligible) return null;
  if (result.reason === 'NOT_FOUND') return SERVICE_YEARS_PERSONNEL_NOT_FOUND;
  const name = result.hoTen ?? 'một quân nhân';
  if (result.reason === 'MISSING_GENDER') return `${name}: Chưa cập nhật thông tin giới tính`;
  if (result.reason === 'MISSING_NHAP_NGU') return `${name}: Chưa có thông tin ngày nhập ngũ`;
  if (result.reason === 'NOT_ENOUGH_YEARS') {
    const label = SERVICE_YEARS_AWARD_LABEL[proposalType];
    return `${name}: Chưa đủ ${result.requiredYears} năm phục vụ để nhận ${label} (hiện ${formatServiceDuration(result.totalMonths ?? 0)})`;
  }
  return null;
}

/**
 * Batch-fetches personnel and evaluates service-year eligibility for each id.
 * @param personnelIds - Personnel ids referenced in the payload
 * @param proposalType - HC_QKQT or KNC_VSNXD_QDNDVN
 * @param refDate - Fallback end date when ngay_xuat_ngu is null
 * @returns One result per input id (preserves order, deduped)
 */
export async function batchEvaluateServiceYears(
  personnelIds: string[],
  proposalType: ServiceYearsProposalType,
  refDate: Date
): Promise<ServiceYearsEligibilityResult[]> {
  const uniqueIds = Array.from(new Set(personnelIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const list = await quanNhanRepository.findManyRaw({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      ho_ten: true,
      gioi_tinh: true,
      ngay_nhap_ngu: true,
      ngay_xuat_ngu: true,
    },
  });
  const map = new Map(list.map(p => [p.id, p]));
  return uniqueIds.map(id => evaluateServiceYears(map.get(id) ?? null, id, proposalType, refDate));
}
