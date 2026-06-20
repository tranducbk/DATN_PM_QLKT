import {
  DANH_HIEU_HCBVTQ,
  HCBVTQ_RANKS_HIGH_TO_LOW,
  cumulativeMonthsForHcbvtqRank,
  getDanhHieuName,
  type ContributionCoefficientGroup,
} from '../../constants/danhHieu.constants';

export type PositionMonthsByGroup = Record<ContributionCoefficientGroup, number>;

const RANK_ORDER = [
  DANH_HIEU_HCBVTQ.HANG_BA,
  DANH_HIEU_HCBVTQ.HANG_NHI,
  DANH_HIEU_HCBVTQ.HANG_NHAT,
] as const;

/**
 * Determines the highest HCBVTQ rank for which the personnel qualifies.
 * @param months - Months grouped by hệ số chức vụ ranges
 * @param requiredMonths - Threshold (120 NAM / 80 NU)
 * @returns Highest rank code or null when none qualifies
 */
export function getHighestQualifyingHCBVTQRank(
  months: PositionMonthsByGroup,
  requiredMonths: number
): string | null {
  for (const rank of HCBVTQ_RANKS_HIGH_TO_LOW) {
    if (cumulativeMonthsForHcbvtqRank(months, rank) >= requiredMonths) {
      return DANH_HIEU_HCBVTQ[rank];
    }
  }
  return null;
}

/**
 * Rejects a proposed HCBVTQ rank that is lower than the highest qualifying rank.
 * @param proposedRank - Rank being submitted/approved
 * @param months - Personnel's month totals by hệ số group
 * @param requiredMonths - Gender-specific threshold
 * @returns Error message or null when the proposed rank is valid
 */
export function validateHCBVTQHighestRank(
  proposedRank: string,
  months: PositionMonthsByGroup,
  requiredMonths: number
): string | null {
  const highest = getHighestQualifyingHCBVTQRank(months, requiredMonths);
  if (!highest) return null;
  const proposedIdx = RANK_ORDER.indexOf(proposedRank as (typeof RANK_ORDER)[number]);
  const highestIdx = RANK_ORDER.indexOf(highest as (typeof RANK_ORDER)[number]);
  if (proposedIdx < 0 || highestIdx < 0) return null;
  if (proposedIdx < highestIdx) {
    return (
      `Đề xuất ${getDanhHieuName(proposedRank)} thấp hơn hạng cao nhất đủ điều kiện ` +
      `${getDanhHieuName(highest)}. Vui lòng đề xuất ${getDanhHieuName(highest)}.`
    );
  }
  return null;
}
