import {
  CONG_HIEN_HE_SO_RANGES,
  type CongHienHeSoGroup,
} from '@/constants/danhHieu.constants';
import type { PositionHistoryEntry } from './types';

/**
 * Sums service months that fall into a specific he_so_chuc_vu group, then formats
 * the result as "X năm Y tháng" (or "—" when the group has no time).
 */
export function calculateTotalTimeByGroup(
  histories: PositionHistoryEntry[],
  group: CongHienHeSoGroup
): string {
  let totalMonths = 0;

  histories.forEach(history => {
    const heSo = Number(history.he_so_chuc_vu) || 0;
    const range = CONG_HIEN_HE_SO_RANGES[group];
    const belongsToGroup = range
      ? heSo >= range.min && (range.includeMax ? heSo <= range.max : heSo < range.max)
      : false;

    if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
      totalMonths += history.so_thang;
    }
  });

  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  if (totalMonths === 0) return '—';
  if (years > 0 && remainingMonths > 0) {
    return `${years} năm ${remainingMonths} tháng`;
  }
  if (years > 0) {
    return `${years} năm`;
  }
  return `${remainingMonths} tháng`;
}

/**
 * Reads a `display` string from a service-time JSON value (object or stringified).
 * Returns null when the value is missing, malformed, or empty.
 */
export function getDurationDisplay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null) {
    const display = (value as { display?: unknown }).display;
    return typeof display === 'string' && display.trim() ? display : null;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as { display?: unknown };
      return typeof parsed.display === 'string' && parsed.display.trim() ? parsed.display : null;
    } catch {
      return null;
    }
  }
  return null;
}
