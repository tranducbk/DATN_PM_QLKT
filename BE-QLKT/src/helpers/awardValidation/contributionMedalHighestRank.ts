/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HCBVTQ HIGHEST RANK VALIDATION — đảm bảo trao đúng rank cao nhất
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  BUSINESS RULE:
 *  Quân nhân đủ điều kiện hạng cao hơn → KHÔNG cho trao hạng thấp hơn.
 *  Vd: Đủ tháng cho Hạng Nhất → đề xuất Hạng Nhì = REJECT.
 *
 *  Lý do: huân chương lifetime, 1 lần. Nếu trao Hạng Nhì rồi không thể
 *  upgrade lên Nhất (rank upgrade chỉ từ thấp → cao). → Phải trao đúng
 *  HẠNG CAO NHẤT có thể từ đầu.
 *
 *  THUẬT TOÁN:
 *  1. Tính cumulative months theo từng rank (xem hcbvtqEligibility.ts).
 *  2. Tìm rank cao nhất đủ điều kiện (Hạng Nhất → Nhì → Ba).
 *  3. Nếu rank đề xuất < rank cao nhất đủ → REJECT với message
 *    "Quân nhân đủ điều kiện Hạng X, không thể nhận Hạng Y".
 *
 *  KHÁC `contributionMedalRankUpgrade` (chỉ check upgrade):
 *  - rankUpgrade: chặn DOWNGRADE từ rank đã có sang rank thấp hơn.
 *  - highestRank: chặn trao THẤP HƠN MỨC CÓ THỂ ĐẠT (kể cả lần đầu).
 *  → 2 check khác nhau, cần cả 2 để đảm bảo trao đúng.
 * ════════════════════════════════════════════════════════════════════════════
 */

import {
  CONG_HIEN_HE_SO_GROUPS,
  DANH_HIEU_HCBVTQ,
  getDanhHieuName,
  type CongHienHeSoGroup,
} from '../../constants/danhHieu.constants';

export type PositionMonthsByGroup = Record<CongHienHeSoGroup, number>;

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
  const m07 = months[CONG_HIEN_HE_SO_GROUPS.LEVEL_07] ?? 0;
  const m08 = months[CONG_HIEN_HE_SO_GROUPS.LEVEL_08] ?? 0;
  const m0910 = months[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10] ?? 0;
  if (m0910 >= requiredMonths) return DANH_HIEU_HCBVTQ.HANG_NHAT;
  if (m08 + m0910 >= requiredMonths) return DANH_HIEU_HCBVTQ.HANG_NHI;
  if (m07 + m08 + m0910 >= requiredMonths) return DANH_HIEU_HCBVTQ.HANG_BA;
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
