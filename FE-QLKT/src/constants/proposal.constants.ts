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

export function getProposalStatusLabel(status: string | undefined | null): string {
  if (status == null || status === '') return '-';
  return PROPOSAL_STATUS_LABELS[status] || status;
}

/** Màu Badge (antd) — cột trạng thái */
export const PROPOSAL_STATUS_BADGE_COLORS: Record<string, string> = {
  [PROPOSAL_STATUS.PENDING]: 'gold',
  [PROPOSAL_STATUS.APPROVED]: 'green',
  [PROPOSAL_STATUS.REJECTED]: 'red',
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

export const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Cá nhân Hằng năm',
  DON_VI_HANG_NAM: 'Đơn vị Hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Đột xuất',
  NCKH: 'ĐTKH/SKKH',
  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
};

export function getProposalTypeLabel(type: string | undefined | null): string {
  if (type == null || type === '') return '-';
  return PROPOSAL_TYPE_LABELS[type] || type;
}

/** Admin — màn Quản lý đề xuất: nhãn tab vs cột trạng thái (copy UI hiện tại) */
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

/** Admin — danh sách đề xuất: label rút gọn + màu Tag (cột + bộ lọc loại) */
export const PROPOSAL_TYPE_ADMIN_TAG: Record<string, { label: string; color: string }> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: { label: 'Cá nhân hằng năm', color: 'blue' },
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: { label: 'Đơn vị hằng năm', color: 'cyan' },
  [PROPOSAL_TYPES.NIEN_HAN]: { label: 'Huy chương Chiến sĩ vẻ vang', color: 'purple' },
  [PROPOSAL_TYPES.CONG_HIEN]: { label: 'Huân chương Bảo vệ Tổ quốc', color: 'magenta' },
  [PROPOSAL_TYPES.DOT_XUAT]: { label: 'Đột xuất', color: 'orange' },
  [PROPOSAL_TYPES.NCKH]: { label: 'ĐTKH/SKKH', color: 'green' },
  [PROPOSAL_TYPES.HC_QKQT]: { label: 'HC QK Quyết thắng', color: 'gold' },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: { label: 'KNC VSNXD', color: 'lime' },
};

/** Manager — danh sách đề xuất: chỉ màu Tag (nhãn dùng PROPOSAL_TYPE_LABELS) */
export const PROPOSAL_TYPE_TAG_COLORS_MANAGER: Record<string, string> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: 'blue',
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: 'purple',
  [PROPOSAL_TYPES.NIEN_HAN]: 'cyan',
  [PROPOSAL_TYPES.HC_QKQT]: 'gold',
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: 'lime',
  [PROPOSAL_TYPES.CONG_HIEN]: 'geekblue',
  [PROPOSAL_TYPES.DOT_XUAT]: 'orange',
  [PROPOSAL_TYPES.NCKH]: 'magenta',
};
