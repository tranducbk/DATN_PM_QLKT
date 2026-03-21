/**
 * Personnel management audit log descriptions
 * Includes: personnel CRUD, position-history, scientific-achievements
 */

const {
  FALLBACK,
  ACHIEVEMENT_TYPE_NAMES,
  parseResponseData,
  getUnitNameFromChucVu,
  queryPersonnelName,
  queryPositionInfo,
  withPrisma,
  formatDateRange,
} = require('./constants');

const personnel = {
  CREATE: (req, res, responseData) => {
    const cccd = req.body?.cccd || '';

    // Lấy họ tên từ response (service có thể set ho_ten = cccd khi tạo mới)
    let hoTen = req.body?.ho_ten || '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      hoTen = data?.data?.ho_ten || data?.data?.QuanNhan?.ho_ten || hoTen;
    } catch (e) {
      // Ignore
    }

    // Nếu họ tên = cccd hoặc không có, chỉ hiển thị cccd
    if (!hoTen || hoTen === cccd) {
      return `Tạo quân nhân mới với CCCD: ${cccd || FALLBACK.UNKNOWN}`;
    }

    return `Tạo quân nhân: ${hoTen}${cccd ? ` (CCCD: ${cccd})` : ''}`;
  },
  UPDATE: (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const personnelData = data?.data || data;
      const hoTen = personnelData?.ho_ten || req.body?.ho_ten || FALLBACK.NO_NAME;

      // Kiểm tra xem có chuyển đơn vị không
      if (personnelData?.unitTransferInfo) {
        const { oldUnit, newUnit } = personnelData.unitTransferInfo;
        const oldUnitName = oldUnit?.ten_don_vi || FALLBACK.NO_UNIT;
        const newUnitName = newUnit?.ten_don_vi || FALLBACK.NO_UNIT;
        return `Chuyển đơn vị quân nhân: ${hoTen} từ "${oldUnitName}" sang "${newUnitName}"`;
      }

      return `Cập nhật thông tin quân nhân: ${hoTen}`;
    } catch (e) {
      const hoTen = req.body?.ho_ten || FALLBACK.NO_NAME;
      return `Cập nhật thông tin quân nhân: ${hoTen}`;
    }
  },
  DELETE: async (req, res, responseData) => {
    const personnelId = req.params?.id;
    let hoTen = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      hoTen = data?.data?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    // Query từ DB nếu thiếu thông tin
    if (!hoTen && personnelId) {
      try {
        const { prisma } = require('../../models');
        const personnelRecord = await prisma.quanNhan.findUnique({
          where: { id: personnelId },
          select: { ho_ten: true },
        });
        hoTen = personnelRecord?.ho_ten || '';
      } catch (error) {
        // Ignore
      }
    }

    if (hoTen) {
      return `Xóa quân nhân: ${hoTen}`;
    }
    return `Xóa quân nhân (không xác định được thông tin)`;
  },
  IMPORT: (req, res, responseData) => {
    const fileName = req.file?.originalname || FALLBACK.NO_FILE;
    let successCount = 0;
    let failCount = 0;

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data || data;
      successCount = result?.success || result?.successCount || result?.total || 0;
      failCount = result?.failed || result?.failCount || 0;

      if (successCount > 0 || failCount > 0) {
        return `Import quân nhân từ file: ${fileName} (${successCount} thành công${
          failCount > 0 ? `, ${failCount} thất bại` : ''
        })`;
      }
    } catch (e) {
      // Ignore parse error
    }

    return `Import quân nhân từ file: ${fileName}`;
  },
  EXPORT: (req, res, responseData) => {
    return `Xuất dữ liệu quân nhân ra Excel`;
  },
};

const positionHistory = {
  CREATE: async (req, res, responseData) => {
    const personnelId = req.params?.personnelId || req.body?.personnel_id || null;
    const chucVuId = req.body?.chuc_vu_id || null;

    // Parse response data
    const parsedData = parseResponseData(responseData);
    const history = parsedData?.data || parsedData;

    // Lấy thông tin từ response
    let hoTen = history?.QuanNhan?.ho_ten || '';
    let tenChucVu = history?.ChucVu?.ten_chuc_vu || '';
    let tenDonVi = getUnitNameFromChucVu(history?.ChucVu);
    let ngayBatDau = history?.ngay_bat_dau || req.body?.ngay_bat_dau || '';
    let ngayKetThuc = history?.ngay_ket_thuc || req.body?.ngay_ket_thuc || '';

    // Query database nếu thiếu thông tin
    if ((!hoTen && personnelId) || (!tenChucVu && chucVuId)) {
      await withPrisma(async prisma => {
        if (!hoTen && personnelId) {
          hoTen = await queryPersonnelName(personnelId, prisma);
        }
        if (!tenChucVu && chucVuId) {
          const positionInfo = await queryPositionInfo(chucVuId, prisma);
          tenChucVu = positionInfo.tenChucVu;
          if (!tenDonVi) {
            tenDonVi = positionInfo.tenDonVi;
          }
        }
      });
    }

    // Tạo mô tả
    let description = 'Tạo lịch sử chức vụ';
    if (hoTen) {
      description += ` cho quân nhân: ${hoTen}`;
    }

    if (tenChucVu) {
      description += ` - Chức vụ: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    }

    description += formatDateRange(ngayBatDau, ngayKetThuc);

    return description;
  },
  UPDATE: async (req, res, responseData) => {
    const historyId = req.params?.id || null;
    const chucVuId = req.body?.chuc_vu_id || null;

    // Parse response data
    const parsedData = parseResponseData(responseData);
    const history = parsedData?.data || parsedData;

    // Lấy thông tin từ response
    let hoTen = history?.QuanNhan?.ho_ten || '';
    let personnelId = history?.quan_nhan_id || null;
    let tenChucVu = history?.ChucVu?.ten_chuc_vu || '';
    let tenDonVi = getUnitNameFromChucVu(history?.ChucVu);
    let ngayBatDau = history?.ngay_bat_dau || req.body?.ngay_bat_dau || '';
    let ngayKetThuc =
      history?.ngay_ket_thuc !== undefined
        ? history.ngay_ket_thuc
        : req.body?.ngay_ket_thuc !== undefined
          ? req.body.ngay_ket_thuc
          : undefined;

    // Query database nếu thiếu thông tin
    if ((!hoTen || !tenChucVu) && historyId) {
      await withPrisma(async prisma => {
        // Query lịch sử chức vụ để lấy personnelId và chucVuId
        const historyRecord = await prisma.lichSuChucVu.findUnique({
          where: { id: historyId },
          select: {
            quan_nhan_id: true,
            chuc_vu_id: true,
          },
        });

        if (historyRecord) {
          if (!personnelId) {
            personnelId = historyRecord.quan_nhan_id;
          }
          const finalChucVuId = chucVuId || historyRecord.chuc_vu_id;

          if (!hoTen && personnelId) {
            hoTen = await queryPersonnelName(personnelId, prisma);
          }

          if (!tenChucVu && finalChucVuId) {
            const positionInfo = await queryPositionInfo(finalChucVuId, prisma);
            tenChucVu = positionInfo.tenChucVu;
            if (!tenDonVi) {
              tenDonVi = positionInfo.tenDonVi;
            }
          }
        }
      });
    }

    // Tạo mô tả
    let description = 'Cập nhật lịch sử chức vụ';
    if (hoTen) {
      description += ` cho quân nhân: ${hoTen}`;
    }

    if (tenChucVu) {
      description += ` - Chức vụ: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    }

    description += formatDateRange(ngayBatDau, ngayKetThuc);

    return description;
  },
  DELETE: async (req, res, responseData) => {
    const historyId = req.params?.id || null;

    // Parse response data (service trả về thông tin trước khi xóa)
    const parsedData = parseResponseData(responseData);
    const result = parsedData?.data || parsedData;

    // Lấy thông tin từ response
    let hoTen = result?.QuanNhan?.ho_ten || '';
    let tenChucVu = result?.ChucVu?.ten_chuc_vu || '';
    let tenDonVi = getUnitNameFromChucVu(result?.ChucVu);

    // Query database nếu thiếu thông tin
    if ((!hoTen || !tenChucVu) && historyId) {
      await withPrisma(async prisma => {
        const history = await prisma.lichSuChucVu.findUnique({
          where: { id: historyId },
          include: {
            QuanNhan: { select: { ho_ten: true } },
            ChucVu: {
              include: {
                CoQuanDonVi: { select: { ten_don_vi: true } },
                DonViTrucThuoc: {
                  include: {
                    CoQuanDonVi: { select: { ten_don_vi: true } },
                  },
                },
              },
            },
          },
        });

        if (history) {
          if (!hoTen && history.QuanNhan?.ho_ten) {
            hoTen = history.QuanNhan.ho_ten;
          }
          if (!tenChucVu && history.ChucVu?.ten_chuc_vu) {
            tenChucVu = history.ChucVu.ten_chuc_vu;
          }
          if (!tenDonVi) {
            tenDonVi = getUnitNameFromChucVu(history.ChucVu);
          }
        }
      });
    }

    // Tạo mô tả
    let description = 'Xóa lịch sử chức vụ';
    if (hoTen) {
      description += ` của quân nhân: ${hoTen}`;
    }

    if (tenChucVu) {
      description += ` - Chức vụ: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    }

    if (!hoTen && !tenChucVu) {
      description += ` (không xác định được thông tin)`;
    }

    return description;
  },
};

const scientificAchievements = {
  CREATE: async (req, res, responseData) => {
    const loai = req.body?.loai || '';
    const moTa = req.body?.mo_ta || '';
    const nam = req.body?.nam || '';
    const personnelId = req.body?.personnel_id || req.body?.quan_nhan_id || null;

    const loaiName = ACHIEVEMENT_TYPE_NAMES[loai] || loai || FALLBACK.UNKNOWN;

    // Lấy tên quân nhân nếu có
    let hoTen = '';
    if (personnelId) {
      try {
        const { prisma } = require('../../models');
        const personnelRecord = await prisma.quanNhan.findUnique({
          where: { id: personnelId },
          select: { ho_ten: true },
        });
        hoTen = personnelRecord?.ho_ten || '';
      } catch (error) {
        // Ignore error
      }
    }

    // Lấy từ response nếu có
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const achievement = data?.data || data;
      if (achievement?.QuanNhan?.ho_ten) {
        hoTen = achievement.QuanNhan.ho_ten;
      }
    } catch (e) {
      // Ignore parse error
    }

    return `Tạo thành tích khoa học: ${loaiName}${hoTen ? ` cho quân nhân ${hoTen}` : ''}${
      moTa ? ` - ${moTa}` : ''
    }${nam ? ` (Năm ${nam})` : ''}`;
  },
  UPDATE: async (req, res, responseData) => {
    const loai = req.body?.loai || '';
    const moTa = req.body?.mo_ta || '';
    const nam = req.body?.nam || '';
    const achievementId = req.params?.id || null;

    const loaiName = ACHIEVEMENT_TYPE_NAMES[loai] || loai || FALLBACK.UNKNOWN;

    // Lấy thông tin từ response hoặc query từ DB
    let hoTen = '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const achievement = data?.data || data;
      if (achievement?.QuanNhan?.ho_ten) {
        hoTen = achievement.QuanNhan.ho_ten;
      } else if (achievementId) {
        const { prisma } = require('../../models');
        const achievementRecord = await prisma.thanhTichKhoaHoc.findUnique({
          where: { id: achievementId },
          include: { QuanNhan: { select: { ho_ten: true } } },
        });
        hoTen = achievementRecord?.QuanNhan?.ho_ten || '';
      }
    } catch (e) {
      // Ignore parse error
    }

    return `Cập nhật thành tích khoa học: ${loaiName}${hoTen ? ` cho quân nhân ${hoTen}` : ''}${
      moTa ? ` - ${moTa}` : ''
    }${nam ? ` (Năm ${nam})` : ''}`;
  },
  DELETE: async (req, res, responseData) => {
    const achievementId = req.params?.id || null;

    // Lấy thông tin từ response hoặc query từ DB
    let hoTen = '';
    let loai = '';
    let moTa = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const achievement = data?.data || data;
      if (achievement?.QuanNhan?.ho_ten) {
        hoTen = achievement.QuanNhan.ho_ten;
      }
      if (achievement?.loai) {
        loai = achievement.loai;
      }
      if (achievement?.mo_ta) {
        moTa = achievement.mo_ta;
      }
    } catch (e) {
      // Ignore parse error
    }

    // Query từ DB nếu thiếu thông tin
    if ((!hoTen || !loai) && achievementId) {
      try {
        const { prisma } = require('../../models');
        const achievementRecord = await prisma.thanhTichKhoaHoc.findUnique({
          where: { id: achievementId },
          include: { QuanNhan: { select: { ho_ten: true } } },
        });
        if (achievementRecord) {
          hoTen = achievementRecord.QuanNhan?.ho_ten || hoTen;
          loai = achievementRecord.loai || loai;
          moTa = achievementRecord.mo_ta || moTa;
        }
      } catch (error) {
        // Ignore error
      }
    }

    const loaiName = ACHIEVEMENT_TYPE_NAMES[loai] || loai || FALLBACK.UNKNOWN;

    if (hoTen && loai) {
      return `Xóa thành tích khoa học: ${loaiName}${
        moTa ? ` - ${moTa}` : ''
      } của quân nhân ${hoTen}`;
    }

    return `Xóa thành tích khoa học (không xác định được thông tin)`;
  },
};

module.exports = {
  personnel,
  'position-history': positionHistory,
  'scientific-achievements': scientificAchievements,
};
