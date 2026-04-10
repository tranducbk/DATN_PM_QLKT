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

  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) {
    months--;
  }
  return Math.max(0, months);
}
