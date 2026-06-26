import {
  CONTRIBUTION_COEFFICIENT_GROUPS,
  CONTRIBUTION_COEFFICIENT_RANGES,
  type ContributionCoefficientGroup,
} from '../../constants/danhHieu.constants';
import { recalcPositionMonths } from '../../helpers/serviceYearsHelper';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  CONG_HIEN (HCBVTQ) — TÍNH THỜI GIAN PHỤC VỤ THEO 3 NHÓM HỆ SỐ CHỨC VỤ
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  HCBVTQ (Huân chương Bảo vệ Tổ quốc) là khen thưởng "cống hiến" — xét
 *  theo TỔNG SỐ THÁNG quân nhân đã giữ chức vụ ở mỗi nhóm hệ số. 3 nhóm:
 *
 *      LEVEL_07     = hệ số 0.7  ≤ X < 0.8   (chức vụ thấp/sĩ quan trẻ)
 *      LEVEL_08     = hệ số 0.8  ≤ X < 0.9   (chức vụ trung)
 *      LEVEL_09_10  = hệ số 0.9  ≤ X ≤ 1.0   (chức vụ cao)
 *
 *  THUẬT TOÁN AGGREGATE (sumMonthsByGroup):
 *  Duyệt từng row LichSuChucVu của quân nhân → phân loại vào 1 trong 3 nhóm
 *  theo `he_so_chuc_vu` → cộng dồn `so_thang` vào nhóm tương ứng.
 *
 *  CUTOFF DATE: thời gian phục vụ chỉ tính đến ngày cutoff (thường là ngày
 *  cuối tháng đề xuất). `recalcPositionMonths` tính lại so_thang của row
 *  cuối (ngay_ket_thuc=null = đang giữ chức) bằng diff(cutoff, ngay_bat_dau).
 *
 *  VÍ DỤ:
 *      Quân nhân giữ:
 *        - Chức A (hệ số 0.75) từ 2010-2018 = 96 tháng → LEVEL_07
 *        - Chức B (hệ số 0.85) từ 2018-2024 = 72 tháng → LEVEL_08
 *        - Chức C (hệ số 0.95) từ 2024 đến nay (cutoff=2026-06)
 *                                              = 30 tháng → LEVEL_09_10
 *      → { LEVEL_07: 96, LEVEL_08: 72, LEVEL_09_10: 30 }
 *
 *  Eligibility rule sẽ check theo (giới tính, hạng huân chương): vd hạng
 *  Nhất cần tối thiểu X tháng ở LEVEL_09_10 + Y tháng ở LEVEL_08 + ...
 * ════════════════════════════════════════════════════════════════════════════
 */

export interface PositionMonthsByGroup {
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: number;
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: number;
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: number;
}

interface PositionHistoryEntry {
  he_so_chuc_vu: number | string | null | undefined;
  so_thang: number | null | undefined;
  ngay_bat_dau?: Date | string | null;
  ngay_ket_thuc?: Date | string | null;
}

/**
 * Returns the group a position coefficient belongs to, or null if outside known ranges.
 * @param heSo - Hệ số chức vụ value
 * @returns Matching group key or null
 */
export function classifyCoefficientGroup(heSo: number): ContributionCoefficientGroup | null {
  for (const group of Object.values(CONTRIBUTION_COEFFICIENT_GROUPS)) {
    const range = CONTRIBUTION_COEFFICIENT_RANGES[group];
    if (!range) continue;
    const inRange =
      heSo >= range.min && (range.includeMax ? heSo <= range.max : heSo < range.max);
    if (inRange) return group;
  }
  return null;
}

/**
 * Sums months grouped by position coefficient range from already-recalculated history rows.
 * Use when callers have already invoked `recalcPositionMonths` themselves.
 * @param histories - Recalculated position history rows for one personnel
 * @returns Months grouped by position coefficient range (0.7 / 0.8 / 0.9-1.0)
 */
export function sumMonthsByGroup(histories: PositionHistoryEntry[]): PositionMonthsByGroup {
  const totals: PositionMonthsByGroup = {
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: 0,
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: 0,
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 0,
  };
  for (const history of histories) {
    const heSo = Number(history.he_so_chuc_vu) || 0;
    const group = classifyCoefficientGroup(heSo);
    if (!group) continue;
    if (history.so_thang === null || history.so_thang === undefined) continue;
    totals[group] += Number(history.so_thang);
  }
  return totals;
}

/**
 * Aggregates contribution months by hệ số group after recalculating per-row tenure.
 * @param histories - Position history rows for a single personnel
 * @param cutoffDate - Eligibility reference date (e.g. last day of proposal month)
 * @returns Months grouped by position coefficient range (0.7 / 0.8 / 0.9-1.0)
 */
export function aggregatePositionMonthsByGroup(
  histories: PositionHistoryEntry[],
  cutoffDate: Date
): PositionMonthsByGroup {
  const recalculated = recalcPositionMonths(
    histories.map(h => ({ ...h, ngay_bat_dau: h.ngay_bat_dau ?? null })),
    cutoffDate
  );
  return sumMonthsByGroup(recalculated);
}
