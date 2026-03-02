/**
 * Constants cho các loại danh hiệu khen thưởng
 * Đây là nguồn dữ liệu duy nhất (Single Source of Truth) cho tất cả mapping danh hiệu
 */

// =====================================================
// DANH HIỆU CODES (để sử dụng trong code logic)
// =====================================================

/**
 * Mã các danh hiệu cá nhân hằng năm
 */
const DANH_HIEU_CA_NHAN_HANG_NAM = {
  CSTDCS: 'CSTDCS', // Chiến sĩ thi đua Cơ sở
  CSTT: 'CSTT', // Chiến sĩ tiên tiến
  BKBQP: 'BKBQP', // Bằng khen của Bộ trưởng Bộ Quốc phòng
  CSTDTQ: 'CSTDTQ', // Chiến sĩ thi đua Toàn quân
  BKTTCP: 'BKTTCP', // Bằng khen của Thủ tướng Chính phủ
};

/**
 * Mã các danh hiệu đơn vị hằng năm
 */
const DANH_HIEU_DON_VI_HANG_NAM = {
  DVQT: 'ĐVQT', // Đơn vị Quyết thắng
  DVTT: 'ĐVTT', // Đơn vị Tiên tiến
};

/**
 * Mã Huy chương Chiến sĩ Vẻ vang (Niên hạn)
 */
const DANH_HIEU_HCCSVV = {
  HANG_BA: 'HCCSVV_HANG_BA',
  HANG_NHI: 'HCCSVV_HANG_NHI',
  HANG_NHAT: 'HCCSVV_HANG_NHAT',
};

/**
 * Mã Huân chương Bảo vệ Tổ quốc (Cống hiến)
 */
const DANH_HIEU_HCBVTQ = {
  HANG_BA: 'HCBVTQ_HANG_BA',
  HANG_NHI: 'HCBVTQ_HANG_NHI',
  HANG_NHAT: 'HCBVTQ_HANG_NHAT',
};

/**
 * Mã các danh hiệu đặc biệt
 */
const DANH_HIEU_DAC_BIET = {
  HC_QKQT: 'HC_QKQT', // Huy chương Quân kỳ Quyết thắng
  KNC_VSNXD_QDNDVN: 'KNC_VSNXD_QDNDVN', // Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN
};

/**
 * Mã các loại thành tích khoa học
 */
const THANH_TICH_KHOA_HOC = {
  DTKH: 'DTKH', // Đề tài khoa học
  SKKH: 'SKKH', // Sáng kiến khoa học
};

// =====================================================
// MAPPING DANH HIỆU -> TÊN TIẾNG VIỆT
// =====================================================

/**
 * Mapping đầy đủ mã danh hiệu sang tên tiếng Việt
 * Đây là nguồn dữ liệu duy nhất cho việc hiển thị tên danh hiệu
 */
const DANH_HIEU_MAP = {
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

// =====================================================
// MAPPING LOẠI ĐỀ XUẤT -> TÊN TIẾNG VIỆT
// =====================================================

/**
 * Mapping mã loại đề xuất sang tên tiếng Việt
 */
const LOAI_DE_XUAT_MAP = {
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
const AWARD_TYPE_MAP = {
  ANNUAL_PERSONAL: 'Cá nhân Hằng năm',
  ANNUAL_UNIT: 'Đơn vị Hằng năm',
  CONTRIBUTION: 'Huân chương Bảo vệ Tổ quốc',
  TENURE: 'Huy chương Chiến sĩ vẻ vang',
  ADHOC: 'Đột xuất',
  SCIENTIFIC: 'Thành tích khoa học',
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Lấy tên tiếng Việt của danh hiệu
 * @param {string} danhHieu - Mã danh hiệu
 * @returns {string} - Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
function getDanhHieuName(danhHieu) {
  if (!danhHieu) return 'Chưa có dữ liệu';
  return DANH_HIEU_MAP[danhHieu] || danhHieu;
}

/**
 * Lấy tên tiếng Việt của loại đề xuất
 * @param {string} loaiDeXuat - Mã loại đề xuất
 * @returns {string} - Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
function getLoaiDeXuatName(loaiDeXuat) {
  if (!loaiDeXuat) return 'Chưa xác định';
  return LOAI_DE_XUAT_MAP[loaiDeXuat] || loaiDeXuat;
}

/**
 * Lấy tên tiếng Việt của loại khen thưởng
 * @param {string} awardType - Mã loại khen thưởng
 * @returns {string} - Tên tiếng Việt hoặc mã gốc nếu không tìm thấy
 */
function getAwardTypeName(awardType) {
  if (!awardType) return 'Chưa xác định';
  return AWARD_TYPE_MAP[awardType] || awardType;
}

/**
 * Xác định loại khen thưởng dựa trên mã danh hiệu
 * @param {string} danhHieu - Mã danh hiệu
 * @returns {string} - Loại khen thưởng
 */
function getLoaiKhenThuongByDanhHieu(danhHieu) {
  if (!danhHieu) return 'Chưa xác định';
  if (danhHieu.startsWith('HCBVTQ')) return 'Huân chương Bảo vệ Tổ quốc';
  if (danhHieu.startsWith('HCCSVV')) return 'Huy chương Chiến sĩ vẻ vang';
  if (['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'].includes(danhHieu)) return 'Cá nhân Hằng năm';
  if (['ĐVQT', 'ĐVTT'].includes(danhHieu)) return 'Đơn vị Hằng năm';
  if (danhHieu === 'HC_QKQT') return 'Huy chương Quân kỳ Quyết thắng';
  if (danhHieu === 'KNC_VSNXD_QDNDVN') return 'Kỷ niệm chương';
  return 'Đột xuất';
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  // Codes
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  DANH_HIEU_DAC_BIET,
  THANH_TICH_KHOA_HOC,

  // Maps
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  AWARD_TYPE_MAP,

  // Helper functions
  getDanhHieuName,
  getLoaiDeXuatName,
  getAwardTypeName,
  getLoaiKhenThuongByDanhHieu,
};
