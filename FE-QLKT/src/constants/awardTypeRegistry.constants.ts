import { PROPOSAL_TYPES, type ProposalType } from './proposalTypes.constants';

export interface AwardTypeMetadata {
  code: ProposalType;
  label: string;
  shortLabel: string;
  description: string;
  danhHieuCodes: readonly string[];
  tagColor: string;
  requiresMonth: boolean;
  hasNote: boolean;
  isUnitAward: boolean;
  importReviewPath?: string;
}

export const AWARD_TYPE_REGISTRY: Record<ProposalType, AwardTypeMetadata> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
    code: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    label: 'Khen thưởng cá nhân hằng năm',
    shortLabel: 'Cá nhân hằng năm',
    description: 'Danh hiệu CSTT, CSTDCS, BKBQP, CSTĐTQ, BKTTCP',
    danhHieuCodes: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'],
    tagColor: 'blue',
    requiresMonth: false,
    hasNote: true,
    isUnitAward: false,
    importReviewPath: '/admin/awards/bulk/import-review',
  },
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: {
    code: PROPOSAL_TYPES.DON_VI_HANG_NAM,
    label: 'Khen thưởng đơn vị hằng năm',
    shortLabel: 'Đơn vị hằng năm',
    description: 'Danh hiệu ĐVTT, ĐVQT, BKBQP, BKTTCP',
    danhHieuCodes: ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'],
    tagColor: 'cyan',
    requiresMonth: false,
    hasNote: true,
    isUnitAward: true,
    importReviewPath: '/admin/awards/bulk/import-review-unit',
  },
  [PROPOSAL_TYPES.NIEN_HAN]: {
    code: PROPOSAL_TYPES.NIEN_HAN,
    label: 'Huy chương Chiến sĩ vẻ vang',
    shortLabel: 'HCCSVV',
    description: 'Danh hiệu Huy chương Chiến sĩ vẻ vang 3 hạng (Ba, Nhì, Nhất)',
    danhHieuCodes: ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'],
    tagColor: 'purple',
    requiresMonth: true,
    hasNote: true,
    isUnitAward: false,
    importReviewPath: '/admin/awards/bulk/import-review-tenure-medals',
  },
  [PROPOSAL_TYPES.CONG_HIEN]: {
    code: PROPOSAL_TYPES.CONG_HIEN,
    label: 'Huân chương Bảo vệ Tổ quốc',
    shortLabel: 'HCBVTQ',
    description: 'Danh hiệu Huân chương Bảo vệ Tổ quốc 3 hạng (Ba, Nhì, Nhất)',
    danhHieuCodes: ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'],
    tagColor: 'magenta',
    requiresMonth: true,
    hasNote: true,
    isUnitAward: false,
    importReviewPath: '/admin/awards/bulk/import-review-hcbvtq',
  },
  [PROPOSAL_TYPES.HC_QKQT]: {
    code: PROPOSAL_TYPES.HC_QKQT,
    label: 'Huy chương Quân kỳ quyết thắng',
    shortLabel: 'HCQKQT',
    description: 'Yêu cầu đủ 25 năm phục vụ trong QĐNDVN',
    danhHieuCodes: ['HC_QKQT'],
    tagColor: 'gold',
    requiresMonth: true,
    hasNote: true,
    isUnitAward: false,
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    code: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    label: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
    shortLabel: 'KNC VSNXD',
    description: 'Yêu cầu đủ 25 năm phục vụ đối với nam và 20 năm phục vụ đối với nữ trong QĐNDVN',
    danhHieuCodes: ['KNC_VSNXD_QDNDVN'],
    tagColor: 'lime',
    requiresMonth: true,
    hasNote: true,
    isUnitAward: false,
  },
  [PROPOSAL_TYPES.NCKH]: {
    code: PROPOSAL_TYPES.NCKH,
    label: 'Thành tích Nghiên cứu khoa học',
    shortLabel: 'NCKH',
    description: 'Đề tài khoa học / Sáng kiến khoa học',
    danhHieuCodes: ['DTKH', 'SKKH'],
    tagColor: 'green',
    requiresMonth: false,
    hasNote: true,
    isUnitAward: false,
    importReviewPath: '/admin/awards/bulk/import-review-nckh',
  },
  [PROPOSAL_TYPES.DOT_XUAT]: {
    code: PROPOSAL_TYPES.DOT_XUAT,
    label: 'Khen thưởng đột xuất',
    shortLabel: 'Đột xuất',
    description: 'Khen thưởng theo hình thức đột xuất',
    danhHieuCodes: [],
    tagColor: 'orange',
    requiresMonth: false,
    hasNote: true,
    isUnitAward: false,
  },
};

/**
 * @param type - Award type code
 * @returns Metadata entry; throws if registry entry missing (compile-time guarantee via Record).
 */
export function getAwardTypeMetadata(type: ProposalType): AwardTypeMetadata {
  return AWARD_TYPE_REGISTRY[type];
}
