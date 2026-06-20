import {
  CONTRIBUTION_COEFFICIENT_GROUPS,
  CONTRIBUTION_COEFFICIENT_RANGES,
  type ContributionCoefficientGroup,
} from '../../constants/danhHieu.constants';
import { recalcPositionMonths } from '../../helpers/serviceYearsHelper';

export interface PositionMonthsByGroup {
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: number;
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: number;
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: number;
}

export interface PositionHistoryEntry {
  he_so_chuc_vu: number | string | null | undefined;
  so_thang: number | null | undefined;
  ngay_bat_dau?: Date | string | null;
  ngay_ket_thuc?: Date | string | null;
}

/**
 * Returns the group a hệ số chức vụ belongs to, or null if outside known ranges.
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
 * Sums months grouped by hệ số chức vụ range from already-recalculated history rows.
 * Use when callers have already invoked `recalcPositionMonths` themselves.
 * @param histories - Recalculated position history rows for one personnel
 * @returns Months grouped by hệ số chức vụ range (0.7 / 0.8 / 0.9-1.0)
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
 * @returns Months grouped by hệ số chức vụ range (0.7 / 0.8 / 0.9-1.0)
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
