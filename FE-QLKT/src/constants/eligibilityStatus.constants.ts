export const ELIGIBILITY_STATUS = {
  CHUA_DU: 'CHUA_DU',
  DU_DIEU_KIEN: 'DU_DIEU_KIEN',
  DA_NHAN: 'DA_NHAN',
} as const;

const ELIGIBILITY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  [ELIGIBILITY_STATUS.DA_NHAN]: { label: 'Đã nhận', color: 'green' },
  [ELIGIBILITY_STATUS.DU_DIEU_KIEN]: { label: 'Đủ điều kiện', color: 'orange' },
  [ELIGIBILITY_STATUS.CHUA_DU]: { label: 'Chưa đủ', color: 'default' },
};

/**
 * Returns the label + color for an eligibility status, falling back to CHUA_DU when unknown.
 * @param status - Eligibility status code
 * @returns Tag metadata `{ label, color }`
 */
export function getEligibilityStatusMeta(status: string | null | undefined): {
  label: string;
  color: string;
} {
  return ELIGIBILITY_STATUS_MAP[status ?? ''] ?? ELIGIBILITY_STATUS_MAP[ELIGIBILITY_STATUS.CHUA_DU];
}
