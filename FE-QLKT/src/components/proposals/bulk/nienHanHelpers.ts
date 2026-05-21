export type HCCSVVRank = 'HCCSVV_HANG_BA' | 'HCCSVV_HANG_NHI' | 'HCCSVV_HANG_NHAT';

export interface NienHanEligibility {
  eligible: boolean;
  reason?: string;
  suggestedRank?: HCCSVVRank;
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
