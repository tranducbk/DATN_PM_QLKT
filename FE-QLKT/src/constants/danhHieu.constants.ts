/**
 * Single Source of Truth cho tất cả mapping danh hiệu khen thưởng.
 */

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

export const DANH_HIEU_DAC_BIET = {
  HC_QKQT: 'HC_QKQT',
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN',
} as const;

export const THANH_TICH_KHOA_HOC = {
  DTKH: 'DTKH',
  SKKH: 'SKKH',
} as const;

/** Tên viết tắt tiếng Việt cho thành tích khoa học (dùng cho chart labels) */
export const THANH_TICH_KHOA_HOC_SHORT_LABELS: Record<string, string> = {
  DTKH: 'ĐTKH',
  SKKH: 'SKKH',
};

export const DANH_HIEU_MAP: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua Cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  BKBQP: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
  CSTDTQ: 'Chiến sĩ thi đua Toàn quân',
  BKTTCP: 'Bằng khen của Thủ tướng Chính phủ',

  ĐVQT: 'Đơn vị Quyết thắng',
  ĐVTT: 'Đơn vị Tiên tiến',

  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ Vẻ vang Hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhất',

  HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc Hạng Ba',
  HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì',
  HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất',

  HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',

  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

export const LOAI_DE_XUAT_MAP: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Khen thưởng cá nhân hằng năm',
  DON_VI_HANG_NAM: 'Khen thưởng đơn vị hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Khen thưởng đột xuất',
  HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
  NCKH: 'Thành tích NCKH',
};

/** Options cho dropdown loại khen thưởng (dùng chung cho decisions page, modal, v.v.) */
export const LOAI_KHEN_THUONG_OPTIONS = Object.entries(LOAI_DE_XUAT_MAP).map(([value, label]) => ({
  label,
  value,
}));

export const AWARD_TYPE_MAP: Record<string, string> = {
  ANNUAL_PERSONAL: 'Khen thưởng cá nhân hằng năm',
  ANNUAL_UNIT: 'Khen thưởng đơn vị hằng năm',
  CONTRIBUTION: 'Huân chương Bảo vệ Tổ quốc',
  TENURE: 'Huy chương Chiến sĩ vẻ vang',
  ADHOC: 'Khen thưởng đột xuất',
  SCIENTIFIC: 'Thành tích NCKH',
};

export const DANH_HIEU_OPTIONS = {
  CA_NHAN_HANG_NAM: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'],
  DON_VI_HANG_NAM: ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'],
  NIEN_HAN: ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'],
  CONG_HIEN: ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'],
} as const;

/**
 * @param danhHieu - Mã danh hiệu
 * @returns Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
export function getDanhHieuName(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa có dữ liệu';
  return DANH_HIEU_MAP[danhHieu] || danhHieu;
}

/**
 * @param loaiDeXuat - Mã loại đề xuất
 * @returns Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
export function getLoaiDeXuatName(loaiDeXuat: string | null | undefined): string {
  if (!loaiDeXuat) return 'Chưa xác định';
  return LOAI_DE_XUAT_MAP[loaiDeXuat] || loaiDeXuat;
}

/**
 * @param awardType - Mã loại khen thưởng
 * @returns Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
export function getAwardTypeName(awardType: string | null | undefined): string {
  if (!awardType) return 'Chưa xác định';
  return AWARD_TYPE_MAP[awardType] || awardType;
}

export type AwardType =
  | 'CNHN'
  | 'DVHN'
  | 'HCCSVV'
  | 'HCBVTQ'
  | 'KNC_VSNXD_QDNDVN'
  | 'HCQKQT'
  | 'NCKH'
  | 'KTDX';

export const AWARD_TAB_LABELS: Record<AwardType, string> = {
  CNHN: 'Khen thưởng cá nhân hằng năm',
  DVHN: 'Khen thưởng đơn vị hằng năm',
  HCCSVV: 'Huy chương Chiến sĩ vẻ vang',
  HCBVTQ: 'Huân chương Bảo vệ Tổ quốc',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
  HCQKQT: 'Huy chương Quân kỳ Quyết thắng',
  NCKH: 'Thành tích NCKH',
  KTDX: 'Khen thưởng đột xuất',
};

export const AWARD_TAB_DANH_HIEU: Record<string, string[]> = {
  CNHN: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'],
  DVHN: ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'],
  HCCSVV: ['HCCSVV_HANG_NHAT', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_BA'],
  HCBVTQ: ['HCBVTQ_HANG_NHAT', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_BA'],
};

export const AWARD_TAB_FILENAME: Record<string, string> = {
  CNHN: 'ca_nhan_hang_nam',
  DVHN: 'don_vi_hang_nam',
  HCCSVV: 'hccsvv',
  HCBVTQ: 'hcbvtq_cong_hien',
  KNC_VSNXD_QDNDVN: 'knc_vsnxd',
  HCQKQT: 'hc_quan_ky_quyet_thang',
  NCKH: 'thanh_tich_khoa_hoc',
  KTDX: 'khen_thuong_dot_xuat',
};

export const DANH_HIEU_COLORS: Record<string, string> = {
  CSTT: 'green',
  CSTDCS: 'blue',
  BKBQP: 'gold',
  CSTDTQ: 'purple',
  BKTTCP: 'red',
  HCCSVV_HANG_BA: 'green',
  HCCSVV_HANG_NHI: 'blue',
  HCCSVV_HANG_NHAT: 'gold',
  HCBVTQ_HANG_BA: 'green',
  HCBVTQ_HANG_NHI: 'blue',
  HCBVTQ_HANG_NHAT: 'gold',
  ĐVQT: 'green',
  ĐVTT: 'blue',
  DTKH: 'blue',
  SKKH: 'green',
};

/** Tabs that use personnel selection when exporting */
export const INDIVIDUAL_AWARD_TABS = [
  'CNHN',
  'HCCSVV',
  'HCBVTQ',
  'KNC_VSNXD_QDNDVN',
  'HCQKQT',
  'NCKH',
];

/** Maps bulk-create award types to dev zone feature flags */
export const AWARD_TYPE_TO_ALLOW: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'allow_annual',
  DON_VI_HANG_NAM: 'allow_unit',
  NIEN_HAN: 'allow_hccsvv',
  HC_QKQT: 'allow_militaryFlag',
  KNC_VSNXD_QDNDVN: 'allow_commemoration',
  CONG_HIEN: 'allow_contribution',
  NCKH: 'allow_scientific',
};

export function getLoaiKhenThuongByDanhHieu(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa xác định';
  if (danhHieu.startsWith('HCBVTQ')) return LOAI_DE_XUAT_MAP.CONG_HIEN;
  if (danhHieu.startsWith('HCCSVV')) return LOAI_DE_XUAT_MAP.NIEN_HAN;
  if (['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'].includes(danhHieu)) return LOAI_DE_XUAT_MAP.CA_NHAN_HANG_NAM;
  if (['ĐVQT', 'ĐVTT'].includes(danhHieu)) return LOAI_DE_XUAT_MAP.DON_VI_HANG_NAM;
  if (danhHieu === 'HC_QKQT') return LOAI_DE_XUAT_MAP.HC_QKQT;
  if (danhHieu === 'KNC_VSNXD_QDNDVN') return LOAI_DE_XUAT_MAP.KNC_VSNXD_QDNDVN;
  return LOAI_DE_XUAT_MAP.DOT_XUAT;
}
