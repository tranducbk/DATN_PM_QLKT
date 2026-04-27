import type { DateInput } from '@/lib/types/common';

export interface ServiceDuration {
  years: number;
  months: number;
  totalMonths: number;
}

/**
 * Computes service-time months from enlistment to discharge (or a reference date).
 * @param ngayNhapNgu - Date of enlistment (string or Date)
 * @param ngayXuatNgu - Date of discharge (optional; falls back to referenceDate)
 * @param referenceDate - Cut-off date when discharge is missing (defaults to now)
 * @returns Years + remaining months + total months, or null when input is invalid
 */
export function calculateTotalMonths(
  ngayNhapNgu: DateInput,
  ngayXuatNgu: DateInput,
  referenceDate?: Date
): ServiceDuration | null {
  if (!ngayNhapNgu) return null;

  try {
    const startDate = typeof ngayNhapNgu === 'string' ? new Date(ngayNhapNgu) : ngayNhapNgu;
    const endDate = ngayXuatNgu
      ? typeof ngayXuatNgu === 'string'
        ? new Date(ngayXuatNgu)
        : ngayXuatNgu
      : (referenceDate ?? new Date());

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return null;
    }

    const totalMonths = Math.max(
      0,
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        endDate.getMonth() -
        startDate.getMonth()
    );
    return {
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
      totalMonths,
    };
  } catch {
    return null;
  }
}
