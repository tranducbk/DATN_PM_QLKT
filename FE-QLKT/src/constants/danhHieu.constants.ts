/**
 * Constants cho các loại danh hiệu khen thưởng
 * Đây là nguồn dữ liệu duy nhất (Single Source of Truth) cho tất cả mapping danh hiệu
 */

// DANH HIỆU CODES (để sử dụng trong code logic)

/**
 * Mã các danh hiệu cá nhân hằng năm
 */
export const DANH_HIEU_CA_NHAN_HANG_NAM = {
  CSTDCS: 'CSTDCS', // Chiến sĩ thi đua Cơ sở
  CSTT: 'CSTT', // Chiến sĩ tiên tiến
  BKBQP: 'BKBQP', // Bằng khen của Bộ trưởng Bộ Quốc phòng
  CSTDTQ: 'CSTDTQ', // Chiến sĩ thi đua Toàn quân
  BKTTCP: 'BKTTCP', // Bằng khen của Thủ tướng Chính phủ
} as const;

/**
 * Mã các danh hiệu đơn vị hằng năm
 */
export const DANH_HIEU_DON_VI_HANG_NAM = {
  DVQT: 'ĐVQT', // Đơn vị Quyết thắng
  DVTT: 'ĐVTT', // Đơn vị Tiên tiến
} as const;

/**
 * Mã Huy chương Chiến sĩ Vẻ vang
 */
export const DANH_HIEU_HCCSVV = {
  HANG_BA: 'HCCSVV_HANG_BA',
  HANG_NHI: 'HCCSVV_HANG_NHI',
  HANG_NHAT: 'HCCSVV_HANG_NHAT',
} as const;

/**
 * Mã Huân chương Bảo vệ Tổ quốc
 */
export const DANH_HIEU_HCBVTQ = {
  HANG_BA: 'HCBVTQ_HANG_BA',
  HANG_NHI: 'HCBVTQ_HANG_NHI',
  HANG_NHAT: 'HCBVTQ_HANG_NHAT',
} as const;

/**
 * Mã các danh hiệu đặc biệt
 */
export const DANH_HIEU_DAC_BIET = {
  HC_QKQT: 'HC_QKQT', // Huy chương Quân kỳ Quyết thắng
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN', // Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN
} as const;

/**
 * Mã các loại thành tích khoa học
 */
export const THANH_TICH_KHOA_HOC = {
  DTKH: 'DTKH', // Đề tài khoa học
  SKKH: 'SKKH', // Sáng kiến khoa học
} as const;

/** Tên viết tắt tiếng Việt cho thành tích khoa học (dùng cho chart labels) */
export const THANH_TICH_KHOA_HOC_SHORT_LABELS: Record<string, string> = {
  DTKH: 'ĐTKH',
  SKKH: 'SKKH',
};

// MAPPING DANH HIỆU -> TÊN TIẾNG VIỆT

/**
 * Mapping đầy đủ mã danh hiệu sang tên tiếng Việt
 * Đây là nguồn dữ liệu duy nhất cho việc hiển thị tên danh hiệu
 */
export const DANH_HIEU_MAP: Record<string, string> = {
  // Danh hiệu cá nhân hằng năm
  CSTDCS: 'Chiến sĩ thi đua Cơ sở',
  CSTT: 'Chiến sĩ tiên tiến',
  BKBQP: 'Bằng khen của Bộ trưởng Bộ Quốc phòng',
  CSTDTQ: 'Chiến sĩ thi đua Toàn quân',
  BKTTCP: 'Bằng khen của Thủ tướng Chính phủ',

  // Danh hiệu đơn vị hằng năm
  ĐVQT: 'Đơn vị Quyết thắng',
  ĐVTT: 'Đơn vị Tiên tiến',

  // Huy chương Chiến sĩ Vẻ vang
  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ Vẻ vang Hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhất',

  // Huân chương Bảo vệ Tổ quốc
  HCBVTQ_HANG_BA: 'Huân chương Bảo vệ Tổ quốc Hạng Ba',
  HCBVTQ_HANG_NHI: 'Huân chương Bảo vệ Tổ quốc Hạng Nhì',
  HCBVTQ_HANG_NHAT: 'Huân chương Bảo vệ Tổ quốc Hạng Nhất',

  // Huy chương và Kỷ niệm chương đặc biệt
  HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN',

  // Thành tích khoa học
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
};

// MAPPING LOẠI ĐỀ XUẤT -> TÊN TIẾNG VIỆT

/**
 * Mapping mã loại đề xuất sang tên tiếng Việt
 */
export const LOAI_DE_XUAT_MAP: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Cá nhân Hằng năm',
  DON_VI_HANG_NAM: 'Đơn vị Hằng năm',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  DOT_XUAT: 'Đột xuất',
  HC_QKQT: 'Huy chương Quân kỳ Quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN',
  NCKH: 'Nghiên cứu khoa học',
};

/** Options cho dropdown loại khen thưởng (dùng chung cho decisions page, modal, v.v.) */
export const LOAI_KHEN_THUONG_OPTIONS = Object.entries(LOAI_DE_XUAT_MAP).map(([value, label]) => ({
  label,
  value,
}));

/**
 * Mapping mã loại khen thưởng (award_type) sang tên tiếng Việt
 */
export const AWARD_TYPE_MAP: Record<string, string> = {
  ANNUAL_PERSONAL: 'Cá nhân Hằng năm',
  ANNUAL_UNIT: 'Đơn vị Hằng năm',
  CONTRIBUTION: 'Huân chương Bảo vệ Tổ quốc',
  TENURE: 'Huy chương Chiến sĩ vẻ vang',
  ADHOC: 'Đột xuất',
  SCIENTIFIC: 'Thành tích khoa học',
};

/**
 * Danh sách các options cho dropdown theo từng loại
 */
export const DANH_HIEU_OPTIONS = {
  CA_NHAN_HANG_NAM: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'],
  DON_VI_HANG_NAM: ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'],
  NIEN_HAN: ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'],
  CONG_HIEN: ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'],
} as const;

// HELPER FUNCTIONS

/**
 * Lấy tên tiếng Việt của danh hiệu
 * @param danhHieu - Mã danh hiệu
 * @returns Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
export function getDanhHieuName(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa có dữ liệu';
  return DANH_HIEU_MAP[danhHieu] || danhHieu;
}

/**
 * Lấy tên tiếng Việt của loại đề xuất
 * @param loaiDeXuat - Mã loại đề xuất
 * @returns Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
export function getLoaiDeXuatName(loaiDeXuat: string | null | undefined): string {
  if (!loaiDeXuat) return 'Chưa xác định';
  return LOAI_DE_XUAT_MAP[loaiDeXuat] || loaiDeXuat;
}

/**
 * Lấy tên tiếng Việt của loại khen thưởng
 * @param awardType - Mã loại khen thưởng
 * @returns Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
export function getAwardTypeName(awardType: string | null | undefined): string {
  if (!awardType) return 'Chưa xác định';
  return AWARD_TYPE_MAP[awardType] || awardType;
}

// Constants cho Awards Tabs (ExportModal, awards page)

/** Các loại tab khen thưởng */
export type AwardType =
  | 'CNHN'
  | 'DVHN'
  | 'HCCSVV'
  | 'HCBVTQ'
  | 'KNC_VSNXD_QDNDVN'
  | 'HCQKQT'
  | 'NCKH';

/** Label tiếng Việt cho từng tab khen thưởng */
export const AWARD_TAB_LABELS: Record<AwardType, string> = {
  CNHN: 'Cá nhân hằng năm',
  DVHN: 'Đơn vị hằng năm',
  HCCSVV: 'Huy chương Chiến sĩ Vẻ vang',
  HCBVTQ: 'Huân chương Bảo vệ Tổ quốc',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương VSNXD QĐNDVN',
  HCQKQT: 'Huy chương Quân kỳ Quyết thắng',
  NCKH: 'Thành tích khoa học',
};

/** Danh hiệu hợp lệ cho filter theo từng tab */
export const AWARD_TAB_DANH_HIEU: Record<string, string[]> = {
  CNHN: ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ'],
  DVHN: ['ĐVQT', 'ĐVTT', 'BKBQP', 'BKTTCP'],
  HCCSVV: ['HCCSVV_HANG_NHAT', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_BA'],
  HCBVTQ: ['HCBVTQ_HANG_NHAT', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_BA'],
};

/** Tên file khi xuất Excel theo tab */
export const AWARD_TAB_FILENAME: Record<string, string> = {
  CNHN: 'ca_nhan_hang_nam',
  DVHN: 'don_vi_hang_nam',
  HCCSVV: 'hccsvv',
  HCBVTQ: 'hcbvtq_cong_hien',
  KNC_VSNXD_QDNDVN: 'knc_vsnxd',
  HCQKQT: 'hc_quan_ky_quyet_thang',
  NCKH: 'thanh_tich_khoa_hoc',
};

/** Tab cá nhân (có bảng chọn quân nhân khi xuất) */
export const INDIVIDUAL_AWARD_TABS = [
  'CNHN',
  'HCCSVV',
  'HCBVTQ',
  'KNC_VSNXD_QDNDVN',
  'HCQKQT',
  'NCKH',
];

/** Map awardType (bulk create) → allow key (dev zone setting) */
export const AWARD_TYPE_TO_ALLOW: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'allow_annual',
  DON_VI_HANG_NAM: 'allow_unit',
  NIEN_HAN: 'allow_hccsvv',
  HC_QKQT: 'allow_militaryFlag',
  KNC_VSNXD_QDNDVN: 'allow_commemoration',
  CONG_HIEN: 'allow_contribution',
  NCKH: 'allow_scientific',
};

// HELPER FUNCTIONS

export function getLoaiKhenThuongByDanhHieu(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa xác định';
  if (danhHieu.startsWith('HCBVTQ')) return 'Huân chương Bảo vệ Tổ quốc';
  if (danhHieu.startsWith('HCCSVV')) return 'Huy chương Chiến sĩ vẻ vang';
  if (['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'].includes(danhHieu)) return 'Cá nhân Hằng năm';
  if (['ĐVQT', 'ĐVTT'].includes(danhHieu)) return 'Đơn vị Hằng năm';
  if (danhHieu === 'HC_QKQT') return 'Huy chương Quân kỳ Quyết thắng';
  if (danhHieu === 'KNC_VSNXD_QDNDVN') return 'Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN';
  return 'Đột xuất';
}
