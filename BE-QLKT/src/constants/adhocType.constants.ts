export const ADHOC_TYPE = {
  CA_NHAN: 'CA_NHAN',
  TAP_THE: 'TAP_THE',
} as const;

export type AdhocType = (typeof ADHOC_TYPE)[keyof typeof ADHOC_TYPE];
