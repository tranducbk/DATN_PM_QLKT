export const PROPOSAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ProposalStatus = (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
};

export function getProposalStatusLabel(status: string | undefined | null): string {
  if (status == null || status === '') return '-';
  return PROPOSAL_STATUS_LABELS[status] || status;
}

export const PROPOSAL_STATUS_BADGE_COLORS: Record<string, string> = {
  [PROPOSAL_STATUS.PENDING]: 'gold',
  [PROPOSAL_STATUS.APPROVED]: 'green',
  [PROPOSAL_STATUS.REJECTED]: 'red',
};

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

export const PROPOSAL_TYPES_REQUIRING_MONTH = new Set<ProposalType>([
  PROPOSAL_TYPES.NIEN_HAN,
  PROPOSAL_TYPES.HC_QKQT,
  PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
]);

export function requiresProposalMonth(type: ProposalType): boolean {
  return PROPOSAL_TYPES_REQUIRING_MONTH.has(type);
}

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  CA_NHAN_HANG_NAM: 'Khen thưởng cá nhân hằng năm',
  DON_VI_HANG_NAM: 'Khen thưởng đơn vị hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Khen thưởng đột xuất',
  NCKH: 'Thành tích Nghiên cứu khoa học',
  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
};

export function getProposalTypeLabel(type: string | undefined | null): string {
  if (type == null || type === '') return '-';
  return isProposalType(type) ? PROPOSAL_TYPE_LABELS[type] : type;
}

export const PROPOSAL_STATUS_ADMIN: Record<
  string,
  { tabLabel: string; tableTagText: string; tagColor: string }
> = {
  [PROPOSAL_STATUS.PENDING]: {
    tabLabel: 'Đang chờ',
    tableTagText: 'Đang chờ',
    tagColor: 'warning',
  },
  [PROPOSAL_STATUS.APPROVED]: {
    tabLabel: 'Đã duyệt',
    tableTagText: 'Đã duyệt',
    tagColor: 'success',
  },
  [PROPOSAL_STATUS.REJECTED]: {
    tabLabel: 'Từ chối',
    tableTagText: 'Từ chối',
    tagColor: 'error',
  },
};

export const PROPOSAL_TYPE_ADMIN_TAG: Record<ProposalType, { label: string; color: string }> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: { label: 'Khen thưởng cá nhân hằng năm', color: 'blue' },
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: { label: 'Khen thưởng đơn vị hằng năm', color: 'cyan' },
  [PROPOSAL_TYPES.NIEN_HAN]: { label: 'Huy chương Chiến sĩ vẻ vang', color: 'purple' },
  [PROPOSAL_TYPES.CONG_HIEN]: { label: 'Huân chương Bảo vệ Tổ quốc', color: 'magenta' },
  [PROPOSAL_TYPES.DOT_XUAT]: { label: 'Khen thưởng đột xuất', color: 'orange' },
  [PROPOSAL_TYPES.NCKH]: { label: 'Thành tích Nghiên cứu khoa học', color: 'green' },
  [PROPOSAL_TYPES.HC_QKQT]: { label: 'Huy chương Quân kỳ quyết thắng', color: 'gold' },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    label: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
    color: 'lime',
  },
};

export const PROPOSAL_REVIEW_CARD_TITLES: Record<ProposalType, string> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: 'Khen thưởng cá nhân hằng năm',
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: 'Khen thưởng đơn vị hằng năm',
  [PROPOSAL_TYPES.NIEN_HAN]: 'Huy chương Chiến sĩ vẻ vang',
  [PROPOSAL_TYPES.CONG_HIEN]: 'Huân chương Bảo vệ Tổ quốc',
  [PROPOSAL_TYPES.HC_QKQT]: 'Huy chương Quân kỳ quyết thắng',
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  [PROPOSAL_TYPES.NCKH]: 'Thành tích Nghiên cứu khoa học',
  [PROPOSAL_TYPES.DOT_XUAT]: 'Khen thưởng đột xuất',
};

export const PROPOSAL_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
