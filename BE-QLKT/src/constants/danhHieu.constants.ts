import type { ProposalType } from './proposalTypes.constants';

export const DANH_HIEU_CA_NHAN_HANG_NAM = {
  CSTDCS: 'CSTDCS',
  CSTT: 'CSTT',
  BKBQP: 'BKBQP',
  CSTDTQ: 'CSTDTQ',
  BKTTCP: 'BKTTCP',
} as const;

export const DANH_HIEU_DON_VI_HANG_NAM = {
  DVQT: 'ĐVQT',
  DVTT: 'ĐVTT',
  BKBQP: 'BKBQP',
  BKTTCP: 'BKTTCP',
} as const;

export const DANH_HIEU_HCCSVV = {
  HANG_BA: 'HCCSVV_HANG_BA',
  HANG_NHI: 'HCCSVV_HANG_NHI',
  HANG_NHAT: 'HCCSVV_HANG_NHAT',
} as const;

export const DANH_HIEU_HCBVTQ = {
  HANG_BA: 'HCBVTQ_HANG_BA',
  HANG_NHI: 'HCBVTQ_HANG_NHI',
  HANG_NHAT: 'HCBVTQ_HANG_NHAT',
} as const;

export const DANH_HIEU_CA_NHAN_KHAC = {
  HC_QKQT: 'HC_QKQT',
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN',
} as const;

export const DANH_HIEU_NCKH = {
  DTKH: 'DTKH',
  SKKH: 'SKKH',
} as const;

export const DANH_HIEU_MAP: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua Cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  CSTDTQ: 'Chiến sĩ thi đua Toàn quân',

  ĐVQT: 'Đơn vị Quyết thắng',
  ĐVTT: 'Đơn vị Tiên tiến',

  BKBQP: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
  BKTTCP: 'Bằng khen của Thủ tướng Chính phủ',

  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ Vẻ vang Hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhất',

  HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc Hạng Ba',
  HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì',
  HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất',

  HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN',

  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

// Compiler enforces that all ProposalType keys are covered — missing key = type error.
export const LOAI_DE_XUAT_MAP: Record<ProposalType, string> = {
  CA_NHAN_HANG_NAM: 'Cá nhân Hằng năm',
  DON_VI_HANG_NAM: 'Đơn vị Hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Đột xuất',
  HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN',
  NCKH: 'Nghiên cứu khoa học',
};

/**
 * Human-readable `danh_hieu` via `DANH_HIEU_MAP`; unknown codes pass through unchanged.
 * @param danhHieu - Raw code from persistence or UI
 * @returns Vietnamese label, UX placeholder when empty, or unmapped code
 */
export function getDanhHieuName(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa có dữ liệu';
  return DANH_HIEU_MAP[danhHieu] || danhHieu;
}

/**
 * Builds `Tên (CODE), …` copy for validation errors and import feedback.
 * @param codes - Codes cited in the message
 * @returns Single-line comma-separated list
 */
export function formatDanhHieuList(codes: readonly string[]): string {
  return codes.map(c => `${getDanhHieuName(c)} (${c})`).join(', ');
}

/**
 * Label for `loai_de_xuat` (`LOAI_DE_XUAT_MAP`); absent values yield the UI undetermined string.
 * @param loaiDeXuat - Key into `LOAI_DE_XUAT_MAP` (proposal category)
 * @returns Display string or literal fallback
 */
export function getLoaiDeXuatName(loaiDeXuat: string | null | undefined): string {
  if (!loaiDeXuat) return 'Chưa xác định';
  return LOAI_DE_XUAT_MAP[loaiDeXuat as ProposalType] || loaiDeXuat;
}

/** CSTDCS + CSTT — stored in `danh_hieu` column. */
export const DANH_HIEU_CA_NHAN_CO_BAN = new Set<string>([
  DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
  DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
]);
/** BKBQP + CSTDTQ + BKTTCP — stored as `nhan_bkbqp`/`nhan_cstdtq`/`nhan_bkttcp` flags, not in `danh_hieu`. */
export const DANH_HIEU_CA_NHAN_BANG_KHEN = new Set<string>([
  DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP,
  DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ,
  DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP,
]);

/** DVQT + DVTT — stored in `danh_hieu` column. */
export const DANH_HIEU_DON_VI_CO_BAN = new Set<string>([
  DANH_HIEU_DON_VI_HANG_NAM.DVQT,
  DANH_HIEU_DON_VI_HANG_NAM.DVTT,
]);
/** BKBQP + BKTTCP — stored as `nhan_bkbqp`/`nhan_bkttcp` flags, not in `danh_hieu`. */
export const DANH_HIEU_DON_VI_BANG_KHEN = new Set<string>([
  DANH_HIEU_DON_VI_HANG_NAM.BKBQP,
  DANH_HIEU_DON_VI_HANG_NAM.BKTTCP,
]);
