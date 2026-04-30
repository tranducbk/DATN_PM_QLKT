import {
  CONG_HIEN_BASE_REQUIRED_MONTHS,
  CONG_HIEN_FEMALE_REQUIRED_MONTHS,
} from '@/constants/danhHieu.constants';

export type CongHienGroup = '0.7' | '0.8' | '0.9-1.0';

export interface PositionHistoryLike {
  he_so_chuc_vu?: number | string | null;
  ChucVu?: {
    he_so_chuc_vu?: number | string | null;
  } | null;
  ngay_bat_dau?: string | Date | null;
  ngay_ket_thuc?: string | Date | null;
}

export const getReferenceEndDate = (year: number, month: number): Date =>
  new Date(year, month, 0);

export const calculateCoveredMonthsByMonth = (startDate: Date, endDate: Date): number =>
  Math.max(
    0,
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
  );

export const calculateContributionMonthsByGroup = (
  histories: PositionHistoryLike[],
  group: CongHienGroup,
  referenceEndDate: Date
): number => {
  if (!histories?.length) return 0;

  return histories.reduce((total, history) => {
    const heSo = Number(history.he_so_chuc_vu) || Number(history.ChucVu?.he_so_chuc_vu) || 0;
    let belongsToGroup = false;
    if (group === '0.7') belongsToGroup = heSo >= 0.7 && heSo < 0.8;
    if (group === '0.8') belongsToGroup = heSo >= 0.8 && heSo < 0.9;
    if (group === '0.9-1.0') belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
    if (!belongsToGroup || !history.ngay_bat_dau) return total;

    const startDate = new Date(history.ngay_bat_dau);
    if (isNaN(startDate.getTime()) || startDate > referenceEndDate) return total;

    const endCandidate = history.ngay_ket_thuc ? new Date(history.ngay_ket_thuc) : referenceEndDate;
    const endDate = endCandidate > referenceEndDate ? referenceEndDate : endCandidate;
    if (isNaN(endDate.getTime()) || endDate < startDate) return total;

    return total + calculateCoveredMonthsByMonth(startDate, endDate);
  }, 0);
};

export const formatMonthsToText = (totalMonths: number): string => {
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  if (totalMonths === 0) return '-';
  if (years > 0 && remainingMonths > 0) return `${years} năm ${remainingMonths} tháng`;
  if (years > 0) return `${years} năm`;
  return `${remainingMonths} tháng`;
};

export const getContributionRequiredMonths = (gender?: string | null): number =>
  gender === 'NU' ? CONG_HIEN_FEMALE_REQUIRED_MONTHS : CONG_HIEN_BASE_REQUIRED_MONTHS;

export const getHighestEligibleContributionMedal = (
  months07: number,
  months08: number,
  months0910: number,
  requiredMonths: number
): string | null => {
  if (months0910 >= requiredMonths) return 'HCBVTQ_HANG_NHAT';
  if (months08 + months0910 >= requiredMonths) return 'HCBVTQ_HANG_NHI';
  if (months07 + months08 + months0910 >= requiredMonths) return 'HCBVTQ_HANG_BA';
  return null;
};
