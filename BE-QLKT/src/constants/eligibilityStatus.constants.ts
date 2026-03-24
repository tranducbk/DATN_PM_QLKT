export const ELIGIBILITY_STATUS = {
  CHUA_DU: 'CHUA_DU',
  DU_DIEU_KIEN: 'DU_DIEU_KIEN',
  DA_NHAN: 'DA_NHAN',
} as const;

export type EligibilityStatus = (typeof ELIGIBILITY_STATUS)[keyof typeof ELIGIBILITY_STATUS];
