/**
 * Calculates the number of complete months between two dates.
 * Uses calendar-aware month arithmetic (consistent with all award eligibility checks).
 * @param startDate - Enlistment date
 * @param endDate - Discharge date, or today if null/undefined
 * @returns Total complete months of service
 */
export function calculateServiceMonths(
  startDate: Date,
  endDate?: Date | null
): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * Calculates covered months by month difference (without inclusive +1).
 * @param startDate - Interval start
 * @param endDate - Interval end
 * @returns Number of covered calendar months
 */
export function calculateCoveredMonthsByMonth(
  startDate: Date,
  endDate: Date
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * Calculates complete months between two dates with day precision.
 * Subtracts one month when end day is earlier than start day.
 * @param startDate - Tenure start date (e.g. position start)
 * @param endDate - Tenure end date, or today if null/undefined
 * @returns Total complete months with day-aware adjustment
 */
export function calculateTenureMonthsWithDayPrecision(
  startDate: Date,
  endDate?: Date | null
): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();

  if (end.getDate() < start.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

interface PositionHistory {
  ngay_bat_dau: Date | string | null;
  ngay_ket_thuc?: Date | string | null;
  so_thang?: number | null;
  [key: string]: unknown;
}

/**
 * Recalculates so_thang for each position history entry, capped at the cutoff date.
 * Open positions (no ngay_ket_thuc) are calculated up to cutoffDate instead of today.
 * Closed positions ending after cutoffDate are also capped.
 * @param histories - Position history records
 * @param cutoffDate - Date to calculate up to (e.g. proposal month/year)
 * @returns Updated histories with recalculated so_thang
 */
export function recalcPositionMonths<T extends PositionHistory>(
  histories: T[],
  cutoffDate: Date
): T[] {
  return histories.map(item => {
    if (!item.ngay_bat_dau) return item;
    const start = new Date(item.ngay_bat_dau);
    const end = item.ngay_ket_thuc ? new Date(item.ngay_ket_thuc) : cutoffDate;
    const effectiveEnd = end > cutoffDate ? cutoffDate : end;
    return {
      ...item,
      so_thang: calculateCoveredMonthsByMonth(start, effectiveEnd),
    };
  });
}

/**
 * Builds a cutoff date from year + month (last day of that month).
 * @param nam - Year
 * @param thang - Month (1-12), or null to use current date
 * @returns Cutoff date
 */
export function buildCutoffDate(nam: number | string, thang: number | null): Date {
  if (!thang) return new Date();
  return new Date(Number(nam), thang, 0);
}

/**
 * Formats total months as "X years Y months".
 * @param totalMonths - Number of months
 * @returns Human-readable Vietnamese duration string
 */
export function formatServiceDuration(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years} năm ${months} tháng`;
  if (years > 0) return `${years} năm`;
  return `${months} tháng`;
}
