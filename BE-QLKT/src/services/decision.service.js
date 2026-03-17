const fs = require('fs').promises;
const path = require('path');
const { prisma } = require('../models');

class DecisionService {
  /**
   * Lấy tất cả quyết định khen thưởng
   * @param {Object} filters - Bộ lọc tùy chọn (nam, loai_khen_thuong)
   * @param {number} page - Trang hiện tại
   * @param {number} limit - Số lượng mỗi trang
   */
  async getAllDecisions(filters = {}, page = 1, limit = 50) {
    const { nam, loai_khen_thuong, search } = filters;
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (nam) whereClause.nam = parseInt(nam);
    if (loai_khen_thuong) whereClause.loai_khen_thuong = loai_khen_thuong;
    if (search) {
      whereClause.OR = [
        { so_quyet_dinh: { contains: search, mode: 'insensitive' } },
        { nguoi_ky: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [decisions, total] = await Promise.all([
      prisma.fileQuyetDinh.findMany({
        where: whereClause,
        orderBy: [{ nam: 'desc' }, { ngay_ky: 'desc' }, { so_quyet_dinh: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.fileQuyetDinh.count({ where: whereClause }),
    ]);

    return {
      decisions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Autocomplete tìm kiếm quyết định theo số quyết định
   * @param {string} query - Từ khóa tìm kiếm
   * @param {number} limit - Số lượng kết quả tối đa
   */
  async autocomplete(query, limit = 10) {
    if (!query || query.trim() === '') {
      return [];
    }

    const decisions = await prisma.fileQuyetDinh.findMany({
      where: {
        so_quyet_dinh: {
          contains: query.trim(),
          mode: 'insensitive',
        },
      },
      orderBy: [{ nam: 'desc' }, { ngay_ky: 'desc' }],
      take: limit,
    });

    return decisions;
  }

  /**
   * Lấy chi tiết quyết định theo ID
   * @param {string} id - UUID của quyết định
   */
  async getDecisionById(id) {
    const decision = await prisma.fileQuyetDinh.findUnique({
      where: { id },
    });

    if (!decision) {
      throw new Error('Quyết định không tồn tại');
    }

    return decision;
  }

  /**
   * Lấy quyết định theo số quyết định
   * @param {string} soQuyetDinh - Số quyết định
   */
  async getDecisionBySoQuyetDinh(soQuyetDinh) {
    const decision = await prisma.fileQuyetDinh.findUnique({
      where: { so_quyet_dinh: soQuyetDinh },
    });

    return decision;
  }

  /**
   * Lấy file path từ số quyết định
   * @param {string} soQuyetDinh - Số quyết định
   * @returns {Promise<{success: boolean, file_path: string|null, decision: object|null, error: string|null}>}
   */
  async getFilePathBySoQuyetDinh(soQuyetDinh) {
    try {
      if (!soQuyetDinh || soQuyetDinh.trim() === '') {
        return {
          success: false,
          file_path: null,
          decision: null,
          error: 'Số quyết định không được để trống',
        };
      }

      const decision = await prisma.fileQuyetDinh.findUnique({
        where: { so_quyet_dinh: soQuyetDinh.trim() },
      });

      if (!decision) {
        return {
          success: false,
          file_path: null,
          decision: null,
          error: 'Không tìm thấy quyết định với số này',
        };
      }

      if (!decision.file_path) {
        return {
          success: false,
          file_path: null,
          decision: decision,
          error: 'Quyết định này chưa có file đính kèm',
        };
      }

      return {
        success: true,
        file_path: decision.file_path,
        decision: decision,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        file_path: null,
        decision: null,
        error: error.message || 'Có lỗi xảy ra khi lấy file quyết định',
      };
    }
  }

  /**
   * Lấy file path và kiểm tra file tồn tại để download
   * @param {string} soQuyetDinh - Số quyết định
   * @returns {Promise<Object>} - { success, filePath, filename, error }
   */
  async getDecisionFileForDownload(soQuyetDinh) {
    try {
      if (!soQuyetDinh || soQuyetDinh.trim() === '') {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'Số quyết định không được để trống',
        };
      }

      const decision = await prisma.fileQuyetDinh.findUnique({
        where: { so_quyet_dinh: soQuyetDinh.trim() },
      });

      if (!decision) {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'Không tìm thấy quyết định với số này',
        };
      }

      if (!decision.file_path) {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'Quyết định này chưa có file đính kèm',
        };
      }

      // Kiểm tra file có tồn tại không
      // file_path có thể là: "uploads/decisions/filename.pdf" hoặc đường dẫn đầy đủ
      let filePath = decision.file_path;

      // Nếu là đường dẫn tương đối, tạo đường dẫn đầy đủ
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(__dirname, '..', '..', filePath);
      }

      try {
        await fs.access(filePath);
        // File tồn tại, lấy filename từ path
        const filename = path.basename(filePath);

        return {
          success: true,
          filePath: filePath,
          filename: filename,
          error: null,
        };
      } catch (accessError) {
        return {
          success: false,
          filePath: null,
          filename: null,
          error: 'File không tồn tại trong hệ thống',
        };
      }
    } catch (error) {
      console.error('Get decision file for download error:', error);
      return {
        success: false,
        filePath: null,
        filename: null,
        error: error.message || 'Có lỗi xảy ra khi lấy file quyết định',
      };
    }
  }

  /**
   * Lấy file paths từ nhiều số quyết định
   * @param {string[]} soQuyetDinhs - Mảng các số quyết định
   * @returns {Promise<Object.<string, {success: boolean, file_path: string|null, decision: object|null, error: string|null}>>}
   */
  async getFilePathsBySoQuyetDinhs(soQuyetDinhs) {
    if (!Array.isArray(soQuyetDinhs) || soQuyetDinhs.length === 0) {
      return {};
    }

    // Lọc các số quyết định hợp lệ
    const validSoQDs = soQuyetDinhs.filter(sq => sq && sq.trim() !== '').map(sq => sq.trim());

    if (validSoQDs.length === 0) {
      return {};
    }

    // Query tất cả quyết định cùng lúc
    const decisions = await prisma.fileQuyetDinh.findMany({
      where: {
        so_quyet_dinh: {
          in: validSoQDs,
        },
      },
    });

    // Tạo map từ số quyết định -> decision
    const decisionMap = {};
    decisions.forEach(d => {
      decisionMap[d.so_quyet_dinh] = d;
    });

    // Tạo kết quả cho mỗi số quyết định
    const result = {};
    validSoQDs.forEach(soQD => {
      const decision = decisionMap[soQD];
      if (!decision) {
        result[soQD] = {
          success: false,
          file_path: null,
          decision: null,
          error: 'Không tìm thấy quyết định',
        };
      } else if (!decision.file_path) {
        result[soQD] = {
          success: false,
          file_path: null,
          decision: decision,
          error: 'Chưa có file đính kèm',
        };
      } else {
        result[soQD] = {
          success: true,
          file_path: decision.file_path,
          decision: decision,
          error: null,
        };
      }
    });

    return result;
  }

  /**
   * Tạo quyết định mới
   * @param {Object} data - Dữ liệu quyết định
   */
  async createDecision(data) {
    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, file_path, loai_khen_thuong, ghi_chu } = data;

    // Kiểm tra số quyết định đã tồn tại chưa
    const existingDecision = await prisma.fileQuyetDinh.findUnique({
      where: { so_quyet_dinh },
    });

    if (existingDecision) {
      throw new Error('Số quyết định đã tồn tại');
    }

    // Validate dữ liệu
    if (!so_quyet_dinh || !nam || !ngay_ky || !nguoi_ky) {
      throw new Error('Thiếu thông tin bắt buộc: số quyết định, năm, ngày ký, người ký');
    }

    // Tạo quyết định mới
    const newDecision = await prisma.fileQuyetDinh.create({
      data: {
        so_quyet_dinh: so_quyet_dinh.trim(),
        nam: parseInt(nam),
        ngay_ky: new Date(ngay_ky),
        nguoi_ky: nguoi_ky.trim(),
        file_path: file_path || null,
        loai_khen_thuong: loai_khen_thuong || null,
        ghi_chu: ghi_chu || null,
      },
    });

    return newDecision;
  }

  /**
   * Cập nhật quyết định
   * @param {string} id - UUID của quyết định
   * @param {Object} data - Dữ liệu cập nhật
   */
  async updateDecision(id, data) {
    // Kiểm tra quyết định có tồn tại không
    const existingDecision = await prisma.fileQuyetDinh.findUnique({
      where: { id },
    });

    if (!existingDecision) {
      throw new Error('Quyết định không tồn tại');
    }

    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, file_path, loai_khen_thuong, ghi_chu } = data;

    // Nếu thay đổi số quyết định, kiểm tra trùng
    if (so_quyet_dinh && so_quyet_dinh !== existingDecision.so_quyet_dinh) {
      const duplicateDecision = await prisma.fileQuyetDinh.findUnique({
        where: { so_quyet_dinh },
      });

      if (duplicateDecision) {
        throw new Error('Số quyết định đã tồn tại');
      }
    }

    // Build update data
    const updateData = {};
    if (so_quyet_dinh !== undefined) updateData.so_quyet_dinh = so_quyet_dinh.trim();
    if (nam !== undefined) updateData.nam = parseInt(nam);
    if (ngay_ky !== undefined) updateData.ngay_ky = new Date(ngay_ky);
    if (nguoi_ky !== undefined) updateData.nguoi_ky = nguoi_ky.trim();
    if (file_path !== undefined) updateData.file_path = file_path;
    if (loai_khen_thuong !== undefined) updateData.loai_khen_thuong = loai_khen_thuong;
    if (ghi_chu !== undefined) updateData.ghi_chu = ghi_chu;

    // Cập nhật
    const updatedDecision = await prisma.fileQuyetDinh.update({
      where: { id },
      data: updateData,
    });

    return updatedDecision;
  }

  /**
   * Xóa quyết định
   * @param {string} id - UUID của quyết định
   */
  async deleteDecision(id) {
    // Kiểm tra quyết định có tồn tại không
    const existingDecision = await prisma.fileQuyetDinh.findUnique({
      where: { id },
    });

    if (!existingDecision) {
      throw new Error('Quyết định không tồn tại');
    }

    // Kiểm tra quyết định có đang được sử dụng trong bảng khen thưởng nào không
    const soQuyetDinh = existingDecision.so_quyet_dinh;
    const [danhHieu, congHien, hccsvv, dotXuat, huanChuong, kyNiem, thanhTich] = await Promise.all([
      prisma.danhHieuHangNam.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      prisma.khenThuongCongHien.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      prisma.khenThuongHCCSVV.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      prisma.khenThuongDotXuat.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      prisma.huanChuongQuanKyQuyetThang.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      prisma.kyNiemChuongVSNXDQDNDVN.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
      prisma.thanhTichKhoaHoc.findFirst({ where: { so_quyet_dinh: soQuyetDinh } }),
    ]);

    const isInUse = danhHieu || congHien || hccsvv || dotXuat || huanChuong || kyNiem || thanhTich;
    if (isInUse) {
      throw new Error(
        `Không thể xóa quyết định "${soQuyetDinh}" vì đang được sử dụng trong dữ liệu khen thưởng.`
      );
    }

    // Xóa quyết định
    await prisma.fileQuyetDinh.delete({
      where: { id },
    });

    return { message: 'Xóa quyết định thành công' };
  }

  /**
   * Lấy danh sách năm có quyết định
   */
  async getAvailableYears() {
    const years = await prisma.fileQuyetDinh.findMany({
      select: {
        nam: true,
      },
      distinct: ['nam'],
      orderBy: {
        nam: 'desc',
      },
    });

    return years.map(y => y.nam);
  }

  /**
   * Lấy danh sách loại khen thưởng
   */
  async getAwardTypes() {
    const types = await prisma.fileQuyetDinh.findMany({
      select: {
        loai_khen_thuong: true,
      },
      distinct: ['loai_khen_thuong'],
      where: {
        loai_khen_thuong: {
          not: null,
        },
      },
    });

    return types.map(t => t.loai_khen_thuong).filter(t => t !== null);
  }
}

module.exports = new DecisionService();
