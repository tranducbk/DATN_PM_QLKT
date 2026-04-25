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

export const CONG_HIEN_HE_SO_GROUPS = {
  LEVEL_07: '0.7',
  LEVEL_08: '0.8',
  LEVEL_09_10: '0.9-1.0',
} as const;

export type CongHienHeSoGroup =
  (typeof CONG_HIEN_HE_SO_GROUPS)[keyof typeof CONG_HIEN_HE_SO_GROUPS];

export const CONG_HIEN_HE_SO_RANGES: Record<
  CongHienHeSoGroup,
  { min: number; max: number; includeMax: boolean }
> = {
  [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: { min: 0.7, max: 0.8, includeMax: false },
  [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: { min: 0.8, max: 0.9, includeMax: false },
  [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: { min: 0.9, max: 1.0, includeMax: true },
};

/** Minimum service months for HCBVTQ baseline (male). */
export const CONG_HIEN_BASE_REQUIRED_MONTHS = 120;
/** Female requirement = 2/3 of male baseline. */
export const CONG_HIEN_FEMALE_REQUIRED_MONTHS = Math.round(
  CONG_HIEN_BASE_REQUIRED_MONTHS * (2 / 3)
);

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
  'Đề tài khoa học': 'ĐTKH',
  'Sáng kiến khoa học': 'SKKH',
};

export const THANH_TICH_KHOA_HOC_FULL_LABELS: Record<string, string> = {
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
  'Đề tài khoa học': 'Đề tài khoa học',
  'Sáng kiến khoa học': 'Sáng kiến khoa học',
};

export const DANH_HIEU_MAP: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua Cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  BKBQP: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
  CSTDTQ: 'Chiến sĩ thi đua Toàn quân',
  BKTTCP: 'Bằng khen của Thủ tướng Chính phủ',

  ĐVQT: 'Đơn vị Quyết thắng',
  ĐVTT: 'Đơn vị Tiên tiến',

  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ vẻ vang Hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ vẻ vang Hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ vẻ vang Hạng Nhất',

  HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc Hạng Ba',
  HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì',
  HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất',

  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',

  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

export const DANH_HIEU_SHORT_MAP: Record<string, string> = {
  CSTDCS: 'Chiến sĩ thi đua Cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  HCCSVV_HANG_BA: 'HCCSVV Hạng Ba',
  HCCSVV_HANG_NHI: 'HCCSVV Hạng Nhì',
  HCCSVV_HANG_NHAT: 'HCCSVV Hạng Nhất',
  HCBVTQ_HANG_BA: 'HCBVTQ Hạng Ba',
  HCBVTQ_HANG_NHI: 'HCBVTQ Hạng Nhì',
  HCBVTQ_HANG_NHAT: 'HCBVTQ Hạng Nhất',
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

export const LOAI_DE_XUAT_MAP: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Khen thưởng cá nhân hằng năm',
  DON_VI_HANG_NAM: 'Khen thưởng đơn vị hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Khen thưởng đột xuất',
  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  NCKH: 'Thành tích Nghiên cứu khoa học',
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
  SCIENTIFIC: 'Thành tích Nghiên cứu khoa học',
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
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  HCQKQT: 'Huy chương Quân kỳ quyết thắng',
  NCKH: 'Thành tích Nghiên cứu khoa học',
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
  'Đề tài khoa học': 'blue',
  'Sáng kiến khoa học': 'green',
};

export const INDIVIDUAL_AWARD_TABS = [
  'CNHN',
  'HCCSVV',
  'HCBVTQ',
  'KNC_VSNXD_QDNDVN',
  'HCQKQT',
  'NCKH',
];

export const AWARD_TYPE_TO_ALLOW: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'allow_annual',
  DON_VI_HANG_NAM: 'allow_unit',
  NIEN_HAN: 'allow_hccsvv',
  HC_QKQT: 'allow_militaryFlag',
  KNC_VSNXD_QDNDVN: 'allow_commemoration',
  CONG_HIEN: 'allow_contribution',
  NCKH: 'allow_scientific',
};

/** Years of service required for each HC Chiến sĩ Vẻ vang rank. */
export const HCCSVV_YEARS_HANG_BA = 10;
export const HCCSVV_YEARS_HANG_NHI = 15;
export const HCCSVV_YEARS_HANG_NHAT = 20;

/** Minimum years of service for HC Quân kỳ quyết thắng (both genders). */
export const HCQKQT_YEARS_REQUIRED = 25;

/** Minimum years of service for KNC VSNXD QDNDVN by gender. */
export const KNC_YEARS_REQUIRED_NAM = 25;
export const KNC_YEARS_REQUIRED_NU = 20;

export function getLoaiKhenThuongByDanhHieu(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa xác định';
  if (danhHieu.startsWith('HCBVTQ')) return LOAI_DE_XUAT_MAP.CONG_HIEN;
  if (danhHieu.startsWith('HCCSVV')) return LOAI_DE_XUAT_MAP.NIEN_HAN;
  if (['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'].includes(danhHieu))
    return LOAI_DE_XUAT_MAP.CA_NHAN_HANG_NAM;
  if (['ĐVQT', 'ĐVTT'].includes(danhHieu)) return LOAI_DE_XUAT_MAP.DON_VI_HANG_NAM;
  if (danhHieu === 'HC_QKQT') return LOAI_DE_XUAT_MAP.HC_QKQT;
  if (danhHieu === 'KNC_VSNXD_QDNDVN') return LOAI_DE_XUAT_MAP.KNC_VSNXD_QDNDVN;
  return LOAI_DE_XUAT_MAP.DOT_XUAT;
}
