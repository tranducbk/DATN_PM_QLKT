/**
 * Shared constants and helper functions for audit log descriptions
 */

const { formatDate } = require('../datetimeHelper');

/**
 * Fallback messages thống nhất cho toàn bộ hệ thống log
 */
const FALLBACK = {
  UNKNOWN: 'Chưa xác định',
  NO_NAME: 'Chưa có tên',
  NO_UNIT: 'Chưa có đơn vị',
  NO_POSITION: 'Chưa có chức vụ',
  NO_FILE: 'Không có file',
};

/**
 * Mapping vai trò sang tiếng Việt
 */
const ROLE_NAMES = {
  USER: 'Người dùng',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
  SUPER_ADMIN: 'Quản trị viên cấp cao',
};

/**
 * Mapping loại thành tích khoa học sang tiếng Việt
 */
const ACHIEVEMENT_TYPE_NAMES = {
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
  NCKH: 'Nghiên cứu khoa học',
};

/**
 * Parse responseData (có thể là string JSON hoặc object)
 */
const parseResponseData = responseData => {
  try {
    return typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
  } catch {
    return null;
  }
};

/**
 * Lấy tên đơn vị từ ChucVu object
 */
const getUnitNameFromChucVu = chucVu => {
  if (!chucVu) return '';
  if (chucVu.CoQuanDonVi?.ten_don_vi) {
    return chucVu.CoQuanDonVi.ten_don_vi;
  }
  if (chucVu.DonViTrucThuoc?.ten_don_vi) {
    const tenDonVi = chucVu.DonViTrucThuoc.ten_don_vi;
    if (chucVu.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi) {
      return `${tenDonVi} (${chucVu.DonViTrucThuoc.CoQuanDonVi.ten_don_vi})`;
    }
    return tenDonVi;
  }
  return '';
};

/**
 * Query và lấy tên đơn vị từ unitId
 */
const getUnitNameFromUnitId = async (unitId, prisma) => {
  if (!unitId) return '';
  try {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({
        where: { id: unitId },
        select: { ten_don_vi: true },
      }),
      prisma.donViTrucThuoc.findUnique({
        where: { id: unitId },
        include: {
          CoQuanDonVi: { select: { ten_don_vi: true } },
        },
      }),
    ]);

    if (coQuanDonVi?.ten_don_vi) {
      return coQuanDonVi.ten_don_vi;
    }
    if (donViTrucThuoc?.ten_don_vi) {
      const tenDonVi = donViTrucThuoc.ten_don_vi;
      if (donViTrucThuoc.CoQuanDonVi?.ten_don_vi) {
        return `${tenDonVi} (${donViTrucThuoc.CoQuanDonVi.ten_don_vi})`;
      }
      return tenDonVi;
    }
    return '';
  } catch {
    return '';
  }
};

/**
 * Query tên quân nhân từ personnelId
 */
const queryPersonnelName = async (personnelId, prisma) => {
  if (!personnelId) return '';
  try {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      select: { ho_ten: true },
    });
    return personnel?.ho_ten || '';
  } catch {
    return '';
  }
};

/**
 * Query thông tin chức vụ (tên và đơn vị) từ chucVuId
 */
const queryPositionInfo = async (chucVuId, prisma) => {
  if (!chucVuId) return { tenChucVu: '', tenDonVi: '' };
  try {
    const chucVu = await prisma.chucVu.findUnique({
      where: { id: chucVuId },
      include: {
        CoQuanDonVi: { select: { ten_don_vi: true } },
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    if (!chucVu) return { tenChucVu: '', tenDonVi: '' };
    return {
      tenChucVu: chucVu.ten_chuc_vu || '',
      tenDonVi: getUnitNameFromChucVu(chucVu),
    };
  } catch {
    return { tenChucVu: '', tenDonVi: '' };
  }
};

/**
 * Helper để truy vấn database trong log description
 * Sử dụng singleton PrismaClient thay vì tạo instance mới mỗi lần
 */
const withPrisma = async callback => {
  const { prisma } = require('../../models');
  try {
    return await callback(prisma);
  } catch (error) {
    return null;
  }
};

/**
 * Format date range cho log description
 */
const formatDateRange = (ngayBatDau, ngayKetThuc) => {
  if (!ngayBatDau && ngayKetThuc === undefined) return '';
  if (ngayBatDau) {
    const formattedStart = formatDate(ngayBatDau);
    if (ngayKetThuc !== undefined) {
      if (ngayKetThuc) {
        const formattedEnd = formatDate(ngayKetThuc);
        return ` (Từ: ${formattedStart} đến: ${formattedEnd})`;
      }
      return ` (Từ: ${formattedStart} - Chưa kết thúc)`;
    }
    return ` (Từ: ${formattedStart})`;
  }
  if (ngayKetThuc !== undefined) {
    if (ngayKetThuc) {
      const formattedEnd = formatDate(ngayKetThuc);
      return ` (Đến: ${formattedEnd})`;
    }
    return ' (Chưa kết thúc)';
  }
  return '';
};

module.exports = {
  FALLBACK,
  ROLE_NAMES,
  ACHIEVEMENT_TYPE_NAMES,
  parseResponseData,
  getUnitNameFromChucVu,
  getUnitNameFromUnitId,
  queryPersonnelName,
  queryPositionInfo,
  withPrisma,
  formatDateRange,
  formatDate,
};
