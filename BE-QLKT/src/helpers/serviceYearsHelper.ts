/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SERVICE YEARS HELPER — date math cho thâm niên + thời gian giữ chức
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  3 BIẾN THỂ TÍNH SỐ THÁNG (chọn cẩn thận theo nghiệp vụ):
 *
 *  ① calculateServiceMonths — "calendar month" diff (KHÔNG xét ngày):
 *     (year_end - year_start) * 12 + (month_end - month_start)
 *     Vd: 15/03/2020 → 02/06/2025 = (2025-2020)*12 + (5-2) = 63 tháng
 *     (tính từ 15/03 đến 02/06 = chưa đủ 63 tháng theo ngày, nhưng business
 *      rule quân đội tính theo tháng dương lịch → coi như đủ).
 *     → DÙNG cho: thâm niên tổng (HC_QKQT, KNC) — đơn giản, ưu đãi user.
 *
 *  ② calculateCoveredMonthsByMonth — giống ① nhưng có guard NaN/inverted:
 *     → DÙNG cho: aggregate position history (recalcPositionMonths).
 *
 *  ③ calculateTenureMonthsWithDayPrecision — diff CÓ xét ngày:
 *     Nếu end.day < start.day → trừ 1 tháng (chưa đủ ngày).
 *     Vd: 15/03/2020 → 02/06/2025 = 62 tháng (vì 02 < 15).
 *     → DÙNG cho: tính thời gian giữ chức vụ chi tiết (vd HCBVTQ phải
 *       chính xác từng ngày để upgrade rank đúng thời điểm).
 *
 *  WHY tách 3 hàm (không gộp 1):
 *  Nghiệp vụ quân đội mỗi loại huân chương có định nghĩa "đủ N tháng"
 *  khác nhau. Gộp 1 hàm sẽ phải truyền flag `dayPrecision: boolean` →
 *  dễ nhầm. Tách rõ tên → caller chọn đúng intent.
 *
 *  TIMEZONE TRAP:
 *  - `new Date()` trả về local timezone của server.
 *  - `new Date('2020-03-15')` parse là UTC midnight → có thể bị shift về
 *    14/03 hoặc 16/03 tuỳ timezone server.
 *  - Hiện tại CHẤP NHẬN vì cả startDate lẫn endDate đều shift cùng chiều
 *    → diff không đổi. NHƯNG nếu deploy multi-region, NÊN dùng UTC date
 *    helpers (Date.UTC) để tránh edge case.
 *
 *  RECALC POSITION MONTHS (recalcPositionMonths):
 *  Chức vụ "đang giữ" (ngay_ket_thuc=null) cần tính tới CUTOFF, không
 *  phải tới `new Date()`. Lý do: khi xét eligibility tại thời điểm đề
 *  xuất (vd: tháng 06/2024), không được tính thời gian giữ chức sau đó
 *  → đảm bảo đúng tại thời điểm trao huân chương.
 *  Edge case: position closed nhưng end > cutoff (vd: bổ nhiệm tới 2030
 *  nhưng xét tại 2024) → cap về cutoff luôn.
 *
 *  BUILD CUTOFF (buildCutoffDate):
 *  `new Date(year, month, 0)` = ngày 0 của tháng `month` → tương đương
 *  ngày cuối của tháng `month - 1` (do JS Date wrap).
 *  Vd: buildCutoffDate(2024, 6) = new Date(2024, 6, 0) = 30/06/2024.
 *  Đây là "cuối tháng đề xuất" (proposal.nam + proposal.thang).
 * ════════════════════════════════════════════════════════════════════════════
 */

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

  // Calendar diff: (Δyear * 12) + Δmonth. Bỏ qua ngày → ưu đãi user
  // (vd: 15/03 → 02/04 = 1 tháng đầy đủ).
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months); // guard âm khi end < start
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
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;

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
      so_thang: calculateTenureMonthsWithDayPrecision(start, effectiveEnd),
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

interface DurationAggregate {
  years?: number | null;
  months?: number | null;
}

/**
 * Coerces a stored thoi_gian value (aggregate object, number, or JSON string) to total months.
 * Shared by medal Excel exports so contribution/commemorative stay in sync.
 * @param value - thoi_gian field value from an award row
 * @returns Total months, '' when empty, or the raw string when JSON is unparseable
 */
export function durationToMonths(value: unknown): number | string {
  if (!value) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    const agg = value as DurationAggregate;
    return (agg.years ?? 0) * 12 + (agg.months ?? 0);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as DurationAggregate;
      return (parsed.years ?? 0) * 12 + (parsed.months ?? 0);
    } catch (error) {
      console.error('Failed to parse thoi_gian JSON for award export:', error);
      return value;
    }
  }
  return '';
}
