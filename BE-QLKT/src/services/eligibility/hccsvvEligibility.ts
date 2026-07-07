import { calculateServiceMonths, resolveServiceEndDate } from '../../helpers/serviceYearsHelper';
import {
  DANH_HIEU_HCCSVV,
  HCCSVV_YEARS_HANG_BA,
  HCCSVV_YEARS_HANG_NHI,
  HCCSVV_YEARS_HANG_NHAT,
} from '../../constants/danhHieu.constants';

export const HCCSVV_YEARS_REQUIRED: Record<string, number> = {
  [DANH_HIEU_HCCSVV.HANG_BA]: HCCSVV_YEARS_HANG_BA,
  [DANH_HIEU_HCCSVV.HANG_NHI]: HCCSVV_YEARS_HANG_NHI,
  [DANH_HIEU_HCCSVV.HANG_NHAT]: HCCSVV_YEARS_HANG_NHAT,
};

export interface HCCSVVEligibilityResult {
  eligible: boolean;
  requiredYears: number | null;
  totalMonths: number | null;
}

/**
 * Evaluates whether a personnel meets the required years of service for an HCCSVV rank.
 * @param danhHieu - HCCSVV rank code (HCCSVV_HANG_BA/NHI/NHAT)
 * @param ngayNhapNgu - Enlistment date
 * @param ngayXuatNgu - Discharge date, or null if still serving
 * @param refDate - Reference date the duration is measured as of
 * @returns Eligibility result; requiredYears/totalMonths are null when danhHieu or ngayNhapNgu is missing
 */
export function evaluateHCCSVVEligibility(
  danhHieu: string,
  ngayNhapNgu: Date | null | undefined,
  ngayXuatNgu: Date | null | undefined,
  refDate: Date
): HCCSVVEligibilityResult {
  const requiredYears = HCCSVV_YEARS_REQUIRED[danhHieu] ?? null;
  if (!requiredYears || !ngayNhapNgu) {
    return { eligible: !requiredYears, requiredYears, totalMonths: null };
  }
  const totalMonths = calculateServiceMonths(ngayNhapNgu, resolveServiceEndDate(ngayXuatNgu, refDate));
  return { eligible: totalMonths >= requiredYears * 12, requiredYears, totalMonths };
}
