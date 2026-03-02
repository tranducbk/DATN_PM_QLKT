const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const proposalService = require('./proposal.service');
const notificationHelper = require('../helpers/notificationHelper');

class CommemorativeMedalService {
  /**
   * Export template Excel for Commemorative Medal (KNC VSNXD) import
   */
  async exportTemplate(userRole = 'MANAGER') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KNC_VSNXD');

    // Define columns - MANAGER chỉ có các trường cơ bản
    const columns = [
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'Ngày sinh', key: 'ngay_sinh', width: 15 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 30 },
    ];

    // ADMIN có thêm các cột chi tiết
    if (userRole === 'ADMIN') {
      columns.push(
        { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
        { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 }
      );
    }

    worksheet.columns = columns;

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    worksheet.addRow({
      ho_ten: 'Nguyễn Văn A',
      ngay_sinh: '15/05/1990',
      nam: 2024,
    });

    // Thêm sample data cho ADMIN
    if (userRole === 'ADMIN') {
      worksheet.addRow({
        ho_ten: 'Trần Thị B',
        ngay_sinh: '20/08/1985',
        nam: 2024,
        cap_bac: 'Thiếu tá',
        chuc_vu: 'Phó Chỉ huy trưởng',
        ghi_chu: 'Ghi chú mẫu',
        so_quyet_dinh: '123/QĐ-BQP',
      });
    }

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Import Commemorative Medals from Excel
   */
  async importFromExcel(excelBuffer, adminId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);
    const worksheet = workbook.getWorksheet('KNC_VSNXD');

    if (!worksheet) {
      throw new Error('Không tìm thấy sheet "KNC_VSNXD" trong file Excel');
    }

    const results = {
      success: 0,
      total: 0,
      imported: 0,
      failed: 0,
      errors: [],
      selectedPersonnelIds: [],
      titleData: [],
    };

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        rows.push({ row, rowNumber });
      }
    });

    for (const { row, rowNumber } of rows) {
      try {
        const ho_ten = row.getCell(1).value?.toString().trim();
        const ngay_sinh_raw = row.getCell(2).value;
        const nam = parseInt(row.getCell(3).value);
        const cap_bac = row.getCell(4).value?.toString() || null;
        const chuc_vu = row.getCell(5).value?.toString() || null;
        const ghi_chu = row.getCell(6).value?.toString() || null;
        const so_quyet_dinh = row.getCell(7).value?.toString() || null;

        if (!ho_ten || !nam) {
          results.errors.push(`Dòng ${rowNumber}: Thiếu thông tin bắt buộc`);
          results.failed++;
          continue;
        }

        // Tìm quân nhân theo tên
        const personnelList = await prisma.quanNhan.findMany({ where: { ho_ten } });
        if (personnelList.length === 0) {
          results.errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân với tên ${ho_ten}`);
          results.failed++;
          continue;
        }

        let personnel;
        if (personnelList.length === 1) {
          personnel = personnelList[0];
        } else {
          if (!ngay_sinh_raw) {
            results.errors.push(
              `Dòng ${rowNumber}: Có ${personnelList.length} người trùng tên "${ho_ten}". Vui lòng cung cấp ngày sinh`
            );
            results.failed++;
            continue;
          }

          let ngay_sinh;
          if (ngay_sinh_raw instanceof Date) {
            ngay_sinh = ngay_sinh_raw;
          } else {
            const dateStr = String(ngay_sinh_raw).trim();
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              ngay_sinh = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
              results.errors.push(`Dòng ${rowNumber}: Ngày sinh không đúng định dạng (DD/MM/YYYY)`);
              results.failed++;
              continue;
            }
          }

          personnel = personnelList.find(p => {
            if (!p.ngay_sinh) return false;
            const pDate = new Date(p.ngay_sinh);
            return (
              pDate.getDate() === ngay_sinh.getDate() &&
              pDate.getMonth() === ngay_sinh.getMonth() &&
              pDate.getFullYear() === ngay_sinh.getFullYear()
            );
          });

          if (!personnel) {
            results.errors.push(
              `Dòng ${rowNumber}: Không tìm thấy quân nhân tên "${ho_ten}" với ngày sinh đã cung cấp`
            );
            results.failed++;
            continue;
          }
        }

        // Check for duplicate awards in proposals
        try {
          const duplicateCheck = await proposalService.checkDuplicateAward(
            personnel.id,
            nam,
            'KNC_VSNXD_QDNDVN',
            'KNC_VSNXD_QDNDVN',
            'APPROVED'
          );
          if (duplicateCheck.isDuplicate) {
            results.errors.push(
              `Dòng ${rowNumber}: ${duplicateCheck.message} (Quân nhân: ${ho_ten}, Năm: ${nam})`
            );
            results.failed++;
            continue;
          }
        } catch (checkError) {
          console.error('Error checking duplicates:', checkError);
          // Continue processing but log the error
        }

        // Upsert (mỗi quân nhân chỉ có 1 bản ghi)
        const upsertedRecord = await prisma.kyNiemChuongVSNXDQDNDVN.upsert({
          where: { quan_nhan_id: personnel.id },
          create: {
            quan_nhan_id: personnel.id,
            nam,
            cap_bac: cap_bac || null,
            chuc_vu: chuc_vu || null,
            ghi_chu: ghi_chu || null,
            so_quyet_dinh: so_quyet_dinh || null,
          },
          update: {
            nam,
            cap_bac: cap_bac || null,
            chuc_vu: chuc_vu || null,
            ghi_chu: ghi_chu || null,
            so_quyet_dinh: so_quyet_dinh || null,
          },
        });

        results.success++;
        results.imported++;
        results.total++;
        results.selectedPersonnelIds.push(personnel.id);
        results.titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu: 'KNC_VSNXD_QDNDVN',
          nam: upsertedRecord.nam,
          cap_bac: upsertedRecord.cap_bac,
          chuc_vu: upsertedRecord.chuc_vu,
          ghi_chu: upsertedRecord.ghi_chu,
          so_quyet_dinh: upsertedRecord.so_quyet_dinh,
        });
      } catch (error) {
        results.errors.push(`Dòng ${rowNumber}: ${error.message}`);
        results.failed++;
        results.total++;
      }
    }

    return results;
  }

  /**
   * Get all Commemorative Medals with filters and pagination
   */
  async getAll(filters = {}, page = 1, limit = 50) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const where = {};

    // Filter theo họ tên
    const quanNhanFilter = {};
    if (filters.ho_ten) {
      quanNhanFilter.ho_ten = { contains: filters.ho_ten, mode: 'insensitive' };
    }

    if (filters.don_vi_id) {
      if (filters.include_sub_units) {
        // Nếu có flag include_sub_units, lấy tất cả đơn vị trực thuộc của cơ quan đơn vị
        const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
          where: { co_quan_don_vi_id: filters.don_vi_id },
          select: { id: true },
        });
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);
        where.QuanNhan = {
          ...quanNhanFilter,
          OR: [
            { co_quan_don_vi_id: filters.don_vi_id },
            { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
          ],
        };
      } else {
        where.QuanNhan = {
          ...quanNhanFilter,
          OR: [
            { co_quan_don_vi_id: filters.don_vi_id },
            { don_vi_truc_thuoc_id: filters.don_vi_id },
          ],
        };
      }
    } else if (Object.keys(quanNhanFilter).length > 0) {
      // Nếu không có filter don_vi_id nhưng có filter ho_ten
      where.QuanNhan = quanNhanFilter;
    }

    if (filters.nam) {
      where.nam = parseInt(filters.nam);
    }

    const [data, total] = await Promise.all([
      prisma.kyNiemChuongVSNXDQDNDVN.findMany({
        where,
        include: {
          QuanNhan: {
            select: {
              cccd: true,
              ho_ten: true,
              cap_bac: true,
              ngay_sinh: true,
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { nam: 'desc' },
      }),
      prisma.kyNiemChuongVSNXDQDNDVN.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Export Commemorative Medals to Excel
   */
  async exportToExcel(filters = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('KNC_VSNXD');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 30 },
      { header: 'Thời gian (tháng)', key: 'thoi_gian', width: 18 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };

    // Helper function để convert thoi_gian từ object {years, months} sang số tháng
    const convertThoiGian = thoiGian => {
      if (!thoiGian) return '';
      if (typeof thoiGian === 'object') {
        const years = thoiGian.years || 0;
        const months = thoiGian.months || 0;
        return years * 12 + months;
      } else if (typeof thoiGian === 'number') {
        return thoiGian;
      } else if (typeof thoiGian === 'string') {
        try {
          const parsed = JSON.parse(thoiGian);
          const years = parsed.years || 0;
          const months = parsed.months || 0;
          return years * 12 + months;
        } catch {
          return thoiGian;
        }
      }
      return '';
    };

    data.forEach((item, index) => {
      worksheet.addRow({
        stt: index + 1,
        cccd: item.QuanNhan.cccd,
        ho_ten: item.QuanNhan.ho_ten,
        don_vi:
          item.QuanNhan.CoQuanDonVi?.ten_don_vi || item.QuanNhan.DonViTrucThuoc?.ten_don_vi || '',
        nam: item.nam,
        cap_bac: item.cap_bac,
        chuc_vu: item.chuc_vu,
        thoi_gian: convertThoiGian(item.thoi_gian),
        so_quyet_dinh: item.so_quyet_dinh,
        ghi_chu: item.ghi_chu || '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get Commemorative Medals statistics
   */
  async getStatistics() {
    const byYear = await prisma.kyNiemChuongVSNXDQDNDVN.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });

    const total = await prisma.kyNiemChuongVSNXDQDNDVN.count();

    return {
      total,
      byYear,
    };
  }

  /**
   * Get user with unit info (helper method)
   */
  async getUserWithUnit(userId) {
    return await prisma.taiKhoan.findUnique({
      where: { id: userId },
      include: {
        QuanNhan: {
          select: {
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });
  }

  /**
   * Get Commemorative Medal by personnel ID
   */
  async getByPersonnelId(personnelId) {
    const result = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
      where: { quan_nhan_id: personnelId },
      include: {
        QuanNhan: {
          select: {
            cccd: true,
            ho_ten: true,
            cap_bac: true,
            ngay_sinh: true,
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    return result ? [result] : [];
  }

  /**
   * Get personnel by ID (helper method)
   */
  async getPersonnelById(personnelId) {
    return await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
      },
    });
  }

  /**
   * Delete Commemorative Medal
   * @param {string} id - Award ID
   * @param {string} adminUsername - Username của admin thực hiện xóa
   * @returns {Promise<Object>}
   */
  async deleteAward(id, adminUsername = 'Admin') {
    try {
      const award = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
        where: { id },
        include: {
          QuanNhan: true,
        },
      });

      if (!award) {
        throw new Error('Bản ghi khen thưởng không tồn tại');
      }

      const personnelId = award.quan_nhan_id;
      const personnel = award.QuanNhan;

      // Xóa bản ghi (không xóa đề xuất - proposal)
      await prisma.kyNiemChuongVSNXDQDNDVN.delete({
        where: { id },
      });

      // KNC VSNXD không ảnh hưởng đến hồ sơ hằng năm, niên hạn hay cống hiến
      // Không cần recalculate

      // Gửi thông báo cho Manager và quân nhân
      try {
        await notificationHelper.notifyOnAwardDeleted(award, personnel, 'KNC_VSNXD', adminUsername);
        console.log(`✅ Sent notification for deleted KNC VSNXD award`);
      } catch (notifyError) {
        console.error(`⚠️ Failed to send notification:`, notifyError.message);
      }

      return {
        message: 'Xóa khen thưởng KNC VSNXD thành công',
        personnelId,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new CommemorativeMedalService();
