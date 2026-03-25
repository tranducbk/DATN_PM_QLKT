/** Trạng thái đề xuất — khớp với BE PROPOSAL_STATUS */
export const PROPOSAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ProposalStatus = (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];

/** Label tiếng Việt cho trạng thái */
export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

/** Màu tag Ant Design cho trạng thái */
export const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
};

/** Loại đề xuất — khớp với BE PROPOSAL_TYPES */
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
