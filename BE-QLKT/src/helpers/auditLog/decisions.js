/**
 * Decision file audit log descriptions
 */

const { FALLBACK } = require('./constants');

const decisions = {
  CREATE: (req, res, responseData) => {
    const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
    const loaiQuyetDinh = req.body?.loai_quyet_dinh || '';
    const loaiNames = {
      DANH_HIEU_HANG_NAM: 'Danh hiệu hằng năm',
      DANH_HIEU_NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
      CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
      BKBQP: 'Bằng khen Bộ Quốc phòng',
      CSTDTQ: 'Chiến sĩ thi đua toàn quốc',
    };
    const loaiName = loaiNames[loaiQuyetDinh] || loaiQuyetDinh || '';
    return `Tạo quyết định: ${soQuyetDinh}${loaiName ? ` (${loaiName})` : ''}`;
  },
  UPDATE: (req, res, responseData) => {
    const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const decision = data?.data || data;
      if (decision?.so_quyet_dinh) {
        return `Cập nhật quyết định: ${decision.so_quyet_dinh}`;
      }
    } catch (e) {
      // Ignore parse error
    }
    return `Cập nhật quyết định: ${soQuyetDinh}`;
  },
  DELETE: (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const decision = data?.data || data;
      if (decision?.so_quyet_dinh) {
        return `Xóa quyết định: ${decision.so_quyet_dinh}`;
      }
    } catch (e) {
      // Ignore parse error
    }
    return `Xóa quyết định (không xác định được thông tin)`;
  },
};

module.exports = { decisions };
