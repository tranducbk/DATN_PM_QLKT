import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  HCQKQT_YEARS_REQUIRED,
  KNC_YEARS_REQUIRED_NAM,
  KNC_YEARS_REQUIRED_NU,
} from '../../constants/danhHieu.constants';
import { GENDER } from '../../constants/gender.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';

export type ServiceYearsProposalType = 'HC_QKQT' | 'KNC_VSNXD_QDNDVN';

/** Vietnamese display label per proposal type — used in unified error messages. */
const SERVICE_YEARS_AWARD_LABEL: Record<ServiceYearsProposalType, string> = {
  HC_QKQT: 'HC QKQT',
  KNC_VSNXD_QDNDVN: 'KNC VSNXD QĐNDVN',
};

export interface ServiceYearsPersonnel {
  id: string;
  ho_ten: string;
  gioi_tinh?: string | null;
  ngay_nhap_ngu: Date | null;
  ngay_xuat_ngu: Date | null;
}

export type ServiceYearsFailureReason =
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
  if (proposalType === PROPOSAL_TYPES.HC_QKQT) return HCQKQT_YEARS_REQUIRED;
  return gioiTinh === GENDER.FEMALE ? KNC_YEARS_REQUIRED_NU : KNC_YEARS_REQUIRED_NAM;
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
  if (proposalType === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
    const g = personnel.gioi_tinh;
    if (!g || (g !== GENDER.MALE && g !== GENDER.FEMALE)) {
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
  const ngayKetThuc = personnel.ngay_xuat_ngu ? new Date(personnel.ngay_xuat_ngu) : refDate;
  const totalMonths = calculateServiceMonths(ngayNhapNgu, ngayKetThuc);
  const requiredYears = requiredServiceYears(proposalType, personnel.gioi_tinh);

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
  const name = result.hoTen ?? result.personnelId;
  if (result.reason === 'NOT_FOUND') return `${result.personnelId}: Không tìm thấy quân nhân`;
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
