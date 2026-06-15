import { ELIGIBILITY_STATUS } from '@/constants/eligibilityStatus.constants';
import { isMissingGender } from '@/constants/gender.constants';
import {
  AWARD_TAB_LABELS,
  HCCSVV_YEARS_HANG_BA,
  HCCSVV_YEARS_HANG_NHI,
  HCCSVV_YEARS_HANG_NHAT,
} from '@/constants/danhHieu.constants';
import { calculateTotalMonths } from './serviceDuration';
import type { Step2Personnel as Personnel } from './types';

export type HCCSVVRank = 'HCCSVV_HANG_BA' | 'HCCSVV_HANG_NHI' | 'HCCSVV_HANG_NHAT';

export interface NienHanEligibility {
  eligible: boolean;
  reason?: string;
  suggestedRank?: HCCSVVRank;
}

export interface RankWindow {
  eligible: boolean;
  yearsNeeded: number;
  monthsNeeded: number;
  totalYears: number;
}

export interface HCCSVVTimeBreakdown {
  hangBa: RankWindow;
  hangNhi: RankWindow;
  hangNhat: RankWindow;
}

export const HCCSVV_RANK_LABEL: Record<HCCSVVRank, string> = {
  HCCSVV_HANG_BA: 'hạng Ba',
  HCCSVV_HANG_NHI: 'hạng Nhì',
  HCCSVV_HANG_NHAT: 'hạng Nhất',
};

export function formatMonthsRemaining(years: number, months: number): string {
  if (years > 0 && months > 0) return `${years} năm ${months} tháng`;
  if (years > 0) return `${years} năm`;
  return `${months} tháng`;
}

export function computeHCCSVVTimeBreakdown(
  record: Personnel,
  proposalYear: number,
  proposalMonth: number
): HCCSVVTimeBreakdown | null {
  if (!record.ngay_nhap_ngu) return null;

  const months = calculateTotalMonths(record.ngay_nhap_ngu, record.ngay_xuat_ngu);
  if (!months) return null;

  const startDate =
    typeof record.ngay_nhap_ngu === 'string'
      ? new Date(record.ngay_nhap_ngu)
      : record.ngay_nhap_ngu;

  const refDate = new Date(proposalYear, proposalMonth, 0);
  const totalYears = months.years;

  const buildWindow = (yearsThreshold: number): RankWindow => {
    const eligibilityDate = new Date(startDate);
    eligibilityDate.setFullYear(eligibilityDate.getFullYear() + yearsThreshold);
    const total =
      (eligibilityDate.getFullYear() - refDate.getFullYear()) * 12 +
      (eligibilityDate.getMonth() - refDate.getMonth());
    const remaining = Math.max(0, total);
    return {
      eligible: refDate >= eligibilityDate,
      yearsNeeded: Math.floor(remaining / 12),
      monthsNeeded: remaining % 12,
      totalYears,
    };
  };

  return {
    hangBa: buildWindow(HCCSVV_YEARS_HANG_BA),
    hangNhi: buildWindow(HCCSVV_YEARS_HANG_NHI),
    hangNhat: buildWindow(HCCSVV_YEARS_HANG_NHAT),
  };
}

interface ServiceProfileLike {
  hccsvv_hang_ba_status?: string | null;
  hccsvv_hang_nhi_status?: string | null;
  hccsvv_hang_nhat_status?: string | null;
  hccsvv_nam_nhan?: unknown;
}

export function evaluateNienHanProposalEligibility(
  record: Personnel,
  proposalYear: number,
  proposalMonth: number,
  serviceProfile: ServiceProfileLike | undefined
): NienHanEligibility {
  if (isMissingGender(record.gioi_tinh)) {
    return { eligible: false, reason: 'Quân nhân chưa cập nhật giới tính' };
  }
  if (!record.ngay_nhap_ngu) {
    return { eligible: false, reason: 'Quân nhân chưa cập nhật ngày nhập ngũ' };
  }

  const breakdown = computeHCCSVVTimeBreakdown(record, proposalYear, proposalMonth);
  if (!breakdown) {
    return { eligible: false, reason: 'Không đủ dữ liệu để đánh giá' };
  }

  const hasHangBa = serviceProfile?.hccsvv_hang_ba_status === ELIGIBILITY_STATUS.DA_NHAN;
  const hasHangNhi = serviceProfile?.hccsvv_hang_nhi_status === ELIGIBILITY_STATUS.DA_NHAN;
  const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;

  if (hasHangNhat) {
    return { eligible: false, reason: `Đã nhận đủ tất cả hạng ${AWARD_TAB_LABELS.HCCSVV}` };
  }

  const namNhan = serviceProfile?.hccsvv_nam_nhan as
    | Record<string, { nam?: number | null }>
    | undefined;

  let targetRank: HCCSVVRank;
  let targetTimeOk: boolean;
  let yearsThreshold: number;
  let timeRemaining: { yearsNeeded: number; monthsNeeded: number };
  let lowerRankYear: number | null = null;
  let lowerRankName = '';

  if (!hasHangBa) {
    targetRank = 'HCCSVV_HANG_BA';
    targetTimeOk = breakdown.hangBa.eligible;
    yearsThreshold = HCCSVV_YEARS_HANG_BA;
    timeRemaining = breakdown.hangBa;
  } else if (!hasHangNhi) {
    targetRank = 'HCCSVV_HANG_NHI';
    targetTimeOk = breakdown.hangNhi.eligible;
    yearsThreshold = HCCSVV_YEARS_HANG_NHI;
    timeRemaining = breakdown.hangNhi;
    lowerRankYear = namNhan?.HCCSVV_HANG_BA?.nam ?? null;
    lowerRankName = 'hạng Ba';
  } else {
    targetRank = 'HCCSVV_HANG_NHAT';
    targetTimeOk = breakdown.hangNhat.eligible;
    yearsThreshold = HCCSVV_YEARS_HANG_NHAT;
    timeRemaining = breakdown.hangNhat;
    lowerRankYear = namNhan?.HCCSVV_HANG_NHI?.nam ?? null;
    lowerRankName = 'hạng Nhì';
  }

  const targetLabel = HCCSVV_RANK_LABEL[targetRank];

  if (!targetTimeOk) {
    return {
      eligible: false,
      reason: `Chưa đủ ${yearsThreshold} năm để đề xuất ${targetLabel}. Còn ${formatMonthsRemaining(timeRemaining.yearsNeeded, timeRemaining.monthsNeeded)}.`,
      suggestedRank: targetRank,
    };
  }

  if (lowerRankYear != null && proposalYear <= lowerRankYear) {
    return {
      eligible: false,
      reason: `Năm đề xuất ${targetLabel} (${proposalYear}) phải sau năm đã nhận ${lowerRankName} (${lowerRankYear}). Vui lòng chọn năm đề xuất sau ${lowerRankYear}.`,
      suggestedRank: targetRank,
    };
  }

  return { eligible: true, suggestedRank: targetRank };
}

export function getNienHanSortPriority(
  record: Personnel,
  proposalYear: number,
  proposalMonth: number,
  serviceProfile: ServiceProfileLike | undefined
): number {
  const missingGender =
    isMissingGender(record.gioi_tinh);
  if (missingGender) return 3;
  if (!record.ngay_nhap_ngu) return 3;

  const hasHangNhat = serviceProfile?.hccsvv_hang_nhat_status === ELIGIBILITY_STATUS.DA_NHAN;
  if (hasHangNhat) return 2;

  const eligibility = evaluateNienHanProposalEligibility(
    record,
    proposalYear,
    proposalMonth,
    serviceProfile
  );
  return eligibility.eligible ? 0 : 3;
}
