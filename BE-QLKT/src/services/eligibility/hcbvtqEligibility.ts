import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { positionHistoryRepository } from '../../repositories/positionHistory.repository';
import {
  CONG_HIEN_BASE_REQUIRED_MONTHS,
  CONG_HIEN_FEMALE_REQUIRED_MONTHS,
  CONG_HIEN_HE_SO_GROUPS,
  DANH_HIEU_HCBVTQ,
  HCBVTQ_RANK_KEYS,
  type CongHienHeSoGroup,
} from '../../constants/danhHieu.constants';
import { GENDER } from '../../constants/gender.constants';
import {
  aggregatePositionMonthsByGroup,
  type PositionMonthsByGroup,
} from './congHienMonthsAggregator';

export type HcbvtqRank = (typeof HCBVTQ_RANK_KEYS)[keyof typeof HCBVTQ_RANK_KEYS];

export interface HCBVTQRankCheckResult {
  rank: HcbvtqRank | null;
  rankName: string;
  eligible: boolean;
  totalMonths: number;
  requiredMonths: number;
}

export interface HCBVTQEvaluationContext {
  monthsByPersonnel: Map<string, PositionMonthsByGroup>;
  genderByPersonnel: Map<string, string | null>;
  hoTenByPersonnel: Map<string, string>;
}

/** Empty months bucket used as fallback when a personnel has no recorded history. */
export function emptyMonthsByGroup(): PositionMonthsByGroup {
  return {
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: 0,
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: 0,
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: 0,
  };
}

/**
 * Returns the gender-aware required-month threshold for HCBVTQ eligibility.
 * @param gioiTinh - Personnel gender (GENDER.MALE / GENDER.FEMALE / null)
 * @returns 80 months for female, 120 months otherwise
 */
export function requiredCongHienMonths(gioiTinh: string | null | undefined): number {
  return gioiTinh === GENDER.FEMALE
    ? CONG_HIEN_FEMALE_REQUIRED_MONTHS
    : CONG_HIEN_BASE_REQUIRED_MONTHS;
}

/**
 * Loads gender + position-history-derived months-by-group for a set of personnel.
 * Issues exactly two batch queries regardless of input size.
 * @param personnelIds - Personnel ids referenced in proposal/award payload
 * @param cutoffDate - Eligibility reference date (last day of proposal month)
 * @returns Maps keyed by personnel id (months, gender, ho_ten)
 */
export async function loadHCBVTQEvaluationContext(
  personnelIds: string[],
  cutoffDate: Date
): Promise<HCBVTQEvaluationContext> {
  const uniqueIds = Array.from(new Set(personnelIds.filter(Boolean)));
  const monthsByPersonnel = new Map<string, PositionMonthsByGroup>();
  const genderByPersonnel = new Map<string, string | null>();
  const hoTenByPersonnel = new Map<string, string>();

  if (uniqueIds.length === 0) {
    return { monthsByPersonnel, genderByPersonnel, hoTenByPersonnel };
  }

  const [quanNhanList, allHistories] = await Promise.all([
    quanNhanRepository.findManyRaw({
      where: { id: { in: uniqueIds } },
      select: { id: true, ho_ten: true, gioi_tinh: true },
    }),
    positionHistoryRepository.findManyRaw({
      where: { quan_nhan_id: { in: uniqueIds } },
      select: {
        quan_nhan_id: true,
        he_so_chuc_vu: true,
        so_thang: true,
        ngay_bat_dau: true,
        ngay_ket_thuc: true,
      },
    }),
  ]);

  for (const qn of quanNhanList) {
    genderByPersonnel.set(qn.id, qn.gioi_tinh);
    hoTenByPersonnel.set(qn.id, qn.ho_ten);
  }

  const historiesByPersonnel = new Map<string, typeof allHistories>();
  for (const h of allHistories) {
    const list = historiesByPersonnel.get(h.quan_nhan_id) ?? [];
    list.push(h);
    historiesByPersonnel.set(h.quan_nhan_id, list);
  }

  for (const personnelId of uniqueIds) {
    const histories = historiesByPersonnel.get(personnelId) ?? [];
    monthsByPersonnel.set(personnelId, aggregatePositionMonthsByGroup(histories, cutoffDate));
  }

  return { monthsByPersonnel, genderByPersonnel, hoTenByPersonnel };
}

/**
 * Maps an HCBVTQ danh_hieu to its rank key + Vietnamese display label.
 * @param danhHieu - Stored danh_hieu code (HCBVTQ.HANG_NHAT etc.)
 * @returns Rank key and Vietnamese name, or { rank: null } when unrecognised
 */
export function classifyHCBVTQRank(danhHieu: string | null | undefined): {
  rank: HcbvtqRank | null;
  rankName: string;
} {
  if (danhHieu === DANH_HIEU_HCBVTQ.HANG_NHAT) {
    return { rank: HCBVTQ_RANK_KEYS.HANG_NHAT, rankName: 'hạng Nhất' };
  }
  if (danhHieu === DANH_HIEU_HCBVTQ.HANG_NHI) {
    return { rank: HCBVTQ_RANK_KEYS.HANG_NHI, rankName: 'hạng Nhì' };
  }
  if (danhHieu === DANH_HIEU_HCBVTQ.HANG_BA) {
    return { rank: HCBVTQ_RANK_KEYS.HANG_BA, rankName: 'hạng Ba' };
  }
  return { rank: null, rankName: '' };
}

/**
 * Picks the cumulative month total for a given HCBVTQ rank.
 * HANG_NHAT only counts 0.9-1.0; HANG_NHI counts 0.8 + 0.9-1.0; HANG_BA counts all.
 * @param months - Months by hệ số group
 * @param rank - HCBVTQ rank key
 * @returns Cumulative months relevant for the rank
 */
export function cumulativeMonthsForRank(
  months: PositionMonthsByGroup,
  rank: HcbvtqRank
): number {
  const m07 = months[CONG_HIEN_HE_SO_GROUPS.LEVEL_07] ?? 0;
  const m08 = months[CONG_HIEN_HE_SO_GROUPS.LEVEL_08] ?? 0;
  const m0910 = months[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10] ?? 0;
  if (rank === HCBVTQ_RANK_KEYS.HANG_NHAT) return m0910;
  if (rank === HCBVTQ_RANK_KEYS.HANG_NHI) return m08 + m0910;
  return m07 + m08 + m0910;
}

/**
 * Evaluates whether a personnel qualifies for the proposed HCBVTQ rank.
 * Pure function — callers format their own error messages using the result.
 * @param danhHieu - Proposed HCBVTQ code
 * @param months - Months by hệ số group for that personnel
 * @param gioiTinh - Personnel gender (drives required-month threshold)
 * @returns Rank classification, eligibility flag, total/required months
 */
export function evaluateHCBVTQRank(
  danhHieu: string | null | undefined,
  months: PositionMonthsByGroup,
  gioiTinh: string | null | undefined
): HCBVTQRankCheckResult {
  const requiredMonths = requiredCongHienMonths(gioiTinh);
  const { rank, rankName } = classifyHCBVTQRank(danhHieu);
  if (!rank) {
    return { rank: null, rankName: '', eligible: false, totalMonths: 0, requiredMonths };
  }
  const totalMonths = cumulativeMonthsForRank(months, rank);
  return {
    rank,
    rankName,
    eligible: totalMonths >= requiredMonths,
    totalMonths,
    requiredMonths,
  };
}

/**
 * Returns months for a specific group from a personnel's months map.
 * @param ctx - Evaluation context built by `loadHCBVTQEvaluationContext`
 * @param personnelId - Personnel id
 * @param group - Hệ số group key
 * @returns Months for the group, 0 when missing
 */
export function getMonthsByGroup(
  ctx: HCBVTQEvaluationContext,
  personnelId: string,
  group: CongHienHeSoGroup
): number {
  return ctx.monthsByPersonnel.get(personnelId)?.[group] ?? 0;
}
