/**
 * Constants cho các loại danh hiệu khen thưởng
 * Đây là nguồn dữ liệu duy nhất (Single Source of Truth) cho tất cả mapping danh hiệu
 */

/**
 * Mã các danh hiệu cá nhân hằng năm
 */
export const DANH_HIEU_CA_NHAN_HANG_NAM = {
  CSTDCS: 'CSTDCS',
  CSTT: 'CSTT',
  BKBQP: 'BKBQP',
  CSTDTQ: 'CSTDTQ',
  BKTTCP: 'BKTTCP',
} as const;

/**
 * Mã các danh hiệu đơn vị hằng năm
 */
export const DANH_HIEU_DON_VI_HANG_NAM = {
  DVQT: 'ĐVQT',
  DVTT: 'ĐVTT',
} as const;

/**
 * Mã Huy chương Chiến sĩ Vẻ vang (Niên hạn)
 */
export const DANH_HIEU_HCCSVV = {
  HANG_BA: 'HCCSVV_HANG_BA',
  HANG_NHI: 'HCCSVV_HANG_NHI',
  HANG_NHAT: 'HCCSVV_HANG_NHAT',
} as const;

/**
 * Mã Huân chương Bảo vệ Tổ quốc (Cống hiến)
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
  HC_QKQT: 'HC_QKQT',
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN',
} as const;

/**
 * Mã các loại thành tích khoa học
 */
export const THANH_TICH_KHOA_HOC = {
  DTKH: 'DTKH',
  SKKH: 'SKKH',
} as const;

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

  // Huy chương Chiến sĩ Vẻ vang (Niên hạn)
  HCCSVV_HANG_BA: 'Huy chương Chiến sĩ Vẻ vang Hạng Ba',
  HCCSVV_HANG_NHI: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhì',
  HCCSVV_HANG_NHAT: 'Huy chương Chiến sĩ Vẻ vang Hạng Nhất',

  // Huân chương Bảo vệ Tổ quốc (Cống hiến)
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
 * Lấy tên tiếng Việt của danh hiệu
 */
export function getDanhHieuName(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa có dữ liệu';
  return DANH_HIEU_MAP[danhHieu] || danhHieu;
}

/** Danh sách mã + tên cho thông báo lỗi (vd. nhập sai danh hiệu). */
export function formatDanhHieuList(codes: readonly string[]): string {
  return codes.map(c => `${getDanhHieuName(c)} (${c})`).join(', ');
}

/**
 * Lấy tên tiếng Việt của loại đề xuất
 */
export function getLoaiDeXuatName(loaiDeXuat: string | null | undefined): string {
  if (!loaiDeXuat) return 'Chưa xác định';
  return LOAI_DE_XUAT_MAP[loaiDeXuat] || loaiDeXuat;
}

/**
 * Lấy tên tiếng Việt của loại khen thưởng
 */
export const UNIT_DV_TITLES = new Set<string>([DANH_HIEU_DON_VI_HANG_NAM.DVQT, DANH_HIEU_DON_VI_HANG_NAM.DVTT]);
export const UNIT_BK_TITLES = new Set<string>([DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP, DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP]);

export function getAwardTypeName(awardType: string | null | undefined): string {
  if (!awardType) return 'Chưa xác định';
  return AWARD_TYPE_MAP[awardType] || awardType;
}

/**
 * Xác định loại khen thưởng dựa trên mã danh hiệu
 */
export function getLoaiKhenThuongByDanhHieu(danhHieu: string | null | undefined): string {
  if (!danhHieu) return 'Chưa xác định';
  if (danhHieu.startsWith('HCBVTQ')) return 'Huân chương Bảo vệ Tổ quốc';
  if (danhHieu.startsWith('HCCSVV')) return 'Huy chương Chiến sĩ vẻ vang';
  if (['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'].includes(danhHieu)) return 'Cá nhân Hằng năm';
  if (['ĐVQT', 'ĐVTT'].includes(danhHieu)) return 'Đơn vị Hằng năm';
  if (danhHieu === 'HC_QKQT') return 'Huy chương Quân kỳ Quyết thắng';
  if (danhHieu === 'KNC_VSNXD_QDNDVN') return 'Kỷ niệm chương';
  return 'Đột xuất';
}
