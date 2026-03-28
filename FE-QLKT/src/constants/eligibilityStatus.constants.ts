export const ELIGIBILITY_STATUS = {
  CHUA_DU: 'CHUA_DU',
  DU_DIEU_KIEN: 'DU_DIEU_KIEN',
  DA_NHAN: 'DA_NHAN',
} as const;

export type EligibilityStatus = (typeof ELIGIBILITY_STATUS)[keyof typeof ELIGIBILITY_STATUS];

/** Mapping trạng thái đủ điều kiện sang label + màu hiển thị */
export const ELIGIBILITY_STATUS_MAP: Record<string, { label: string; color: string }> = {
  [ELIGIBILITY_STATUS.DA_NHAN]: { label: 'Đã nhận', color: 'green' },
  [ELIGIBILITY_STATUS.DU_DIEU_KIEN]: { label: 'Đủ điều kiện', color: 'orange' },
  [ELIGIBILITY_STATUS.CHUA_DU]: { label: 'Chưa đủ', color: 'default' },
};
