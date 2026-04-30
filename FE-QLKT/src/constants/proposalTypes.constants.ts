export const PROPOSAL_TYPES = {
  CA_NHAN_HANG_NAM: 'CA_NHAN_HANG_NAM',
  DON_VI_HANG_NAM: 'DON_VI_HANG_NAM',
  NIEN_HAN: 'NIEN_HAN',
  CONG_HIEN: 'CONG_HIEN',
  DOT_XUAT: 'DOT_XUAT',
  HC_QKQT: 'HC_QKQT',
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN',
  NCKH: 'NCKH',
} as const;

export type ProposalType = (typeof PROPOSAL_TYPES)[keyof typeof PROPOSAL_TYPES];

export function isProposalType(value: string): value is ProposalType {
  return Object.values(PROPOSAL_TYPES).includes(value as ProposalType);
}
