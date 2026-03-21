/**
 * Unit and position management audit log descriptions
 */

const {
  FALLBACK,
  parseResponseData,
  getUnitNameFromChucVu,
  getUnitNameFromUnitId,
  queryPositionInfo,
  withPrisma,
  formatDate,
} = require('./constants');

const units = {
  CREATE: (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const unit = data?.data || data;
      if (unit?.ten_don_vi) {
        return `Tạo đơn vị trực thuộc: ${unit.ten_don_vi}`;
      }
      if (unit?.ten_co_quan_don_vi) {
        return `Tạo cơ quan đơn vị: ${unit.ten_co_quan_don_vi}`;
      }
    } catch (e) {
      // Ignore parse error
    }
    // Kiểm tra từ request body để phân biệt
    if (req.body?.ten_don_vi) {
      return `Tạo đơn vị trực thuộc: ${req.body.ten_don_vi}`;
    }
    if (req.body?.ten_co_quan_don_vi) {
      return `Tạo cơ quan đơn vị: ${req.body.ten_co_quan_don_vi}`;
    }
    return `Tạo đơn vị: ${req.body?.ten_don_vi || req.body?.ten_co_quan_don_vi || FALLBACK.UNKNOWN}`;
  },
  UPDATE: (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const unit = data?.data || data;
      if (unit?.ten_don_vi) {
        return `Cập nhật đơn vị trực thuộc: ${unit.ten_don_vi}`;
      }
      if (unit?.ten_co_quan_don_vi) {
        return `Cập nhật cơ quan đơn vị: ${unit.ten_co_quan_don_vi}`;
      }
    } catch (e) {
      // Ignore parse error
    }
    // Kiểm tra từ request body để phân biệt
    if (req.body?.ten_don_vi) {
      return `Cập nhật đơn vị trực thuộc: ${req.body.ten_don_vi}`;
    }
    if (req.body?.ten_co_quan_don_vi) {
      return `Cập nhật cơ quan đơn vị: ${req.body.ten_co_quan_don_vi}`;
    }
    return `Cập nhật đơn vị: ${req.body?.ten_don_vi || req.body?.ten_co_quan_don_vi || FALLBACK.UNKNOWN}`;
  },
  DELETE: (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const unit = data?.data || data;
      if (unit?.ten_don_vi) {
        return `Xóa đơn vị trực thuộc: ${unit.ten_don_vi}`;
      }
      if (unit?.ten_co_quan_don_vi) {
        return `Xóa cơ quan đơn vị: ${unit.ten_co_quan_don_vi}`;
      }
    } catch (e) {
      // Ignore parse error
    }
    return `Xóa đơn vị (không xác định được thông tin)`;
  },
};

const positions = {
  CREATE: async (req, res, responseData) => {
    const tenChucVu = req.body?.ten_chuc_vu || FALLBACK.NO_POSITION;
    const unitId = req.body?.unit_id || null;
    const ngayHienTai = formatDate(new Date());

    // Parse response data
    const parsedData = parseResponseData(responseData);
    const position = parsedData?.data || parsedData;

    // Lấy thông tin từ response
    let finalTenChucVu = position?.ten_chuc_vu || tenChucVu;
    let tenDonVi = getUnitNameFromChucVu(position);

    // Query database nếu thiếu thông tin đơn vị
    if (!tenDonVi && unitId) {
      await withPrisma(async prisma => {
        tenDonVi = await getUnitNameFromUnitId(unitId, prisma);
      });
    }

    let description = `Tạo chức vụ: ${finalTenChucVu}`;
    if (tenDonVi) {
      description += ` (${tenDonVi})`;
    }
    if (ngayHienTai) {
      description += ` - Ngày: ${ngayHienTai}`;
    }
    return description;
  },
  UPDATE: async (req, res, responseData) => {
    const positionId = req.params?.id;
    const tenChucVu = req.body?.ten_chuc_vu || null;
    const ngayHienTai = formatDate(new Date());

    // Parse response data
    const parsedData = parseResponseData(responseData);
    const position = parsedData?.data || parsedData;

    // Lấy thông tin từ response
    let finalTenChucVu = position?.ten_chuc_vu || tenChucVu;
    let tenDonVi = getUnitNameFromChucVu(position);

    // Query database nếu thiếu thông tin
    if ((!finalTenChucVu || !tenDonVi) && positionId) {
      await withPrisma(async prisma => {
        const positionInfo = await queryPositionInfo(positionId, prisma);
        if (!finalTenChucVu) {
          finalTenChucVu = positionInfo.tenChucVu || FALLBACK.NO_POSITION;
        }
        if (!tenDonVi) {
          tenDonVi = positionInfo.tenDonVi;
        }
      });
    }

    let description = `Cập nhật chức vụ: ${finalTenChucVu || FALLBACK.NO_POSITION}`;
    if (tenDonVi) {
      description += ` (${tenDonVi})`;
    }
    if (ngayHienTai) {
      description += ` - Ngày: ${ngayHienTai}`;
    }
    return description;
  },
  DELETE: async (req, res, responseData) => {
    const positionId = req.params?.id;
    const ngayHienTai = formatDate(new Date());

    // Parse response data (service trả về thông tin trước khi xóa)
    const parsedData = parseResponseData(responseData);
    const position = parsedData?.data || parsedData;

    // Lấy thông tin từ response
    let tenChucVu = position?.ten_chuc_vu || '';
    let tenDonVi = getUnitNameFromChucVu(position);

    // Query database nếu thiếu thông tin
    if ((!tenChucVu || !tenDonVi) && positionId) {
      await withPrisma(async prisma => {
        const positionInfo = await queryPositionInfo(positionId, prisma);
        if (!tenChucVu) {
          tenChucVu = positionInfo.tenChucVu;
        }
        if (!tenDonVi) {
          tenDonVi = positionInfo.tenDonVi;
        }
      });
    }

    let description = 'Xóa chức vụ';
    if (tenChucVu) {
      description += `: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    } else {
      description += ` (không xác định được thông tin)`;
    }
    if (ngayHienTai) {
      description += ` - Ngày: ${ngayHienTai}`;
    }

    return description;
  },
};

module.exports = { units, positions };
