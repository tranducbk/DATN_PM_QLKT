const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const proposalService = require('./proposal.service');
const profileService = require('./profile.service');
const notificationHelper = require('../helpers/notificationHelper');
const { getDanhHieuName } = require('../constants/danhHieu.constants');
const { ROLES } = require('../constants/roles');

class ContributionAwardService {
  /**
   * Export template Excel for Contribution Awards (HCBVTQ) import
   */
  async exportTemplate(userRole = ROLES.MANAGER) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HCBVTQ');

    // Define columns - MANAGER chỉ có các trường cơ bản
    const columns = [
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'Ngày sinh', key: 'ngay_sinh', width: 15 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 30 },
      {
        header: 'Danh hiệu',
        key: 'danh_hieu',
        width: 40,
      },
    ];

    // ADMIN có thêm các cột chi tiết
    if (userRole === ROLES.ADMIN) {
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
      danh_hieu: 'HCBVTQ_HANG_BA',
    });

    // Thêm sample data cho ADMIN
    if (userRole === ROLES.ADMIN) {
      worksheet.addRow({
        ho_ten: 'Trần Thị B',
        ngay_sinh: '20/08/1985',
        nam: 2024,
        danh_hieu: 'HCBVTQ_HANG_NHI',
        cap_bac: 'Thiếu tá',
        chuc_vu: 'Phó Chỉ huy trưởng',
        ghi_chu: 'Ghi chú mẫu',
        so_quyet_dinh: '123/QĐ-BQP',
      });
    }

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Import Contribution Awards from Excel
   */
  async importFromExcel(excelBuffer, adminId) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(excelBuffer);
    const worksheet = workbook.getWorksheet('HCBVTQ');

    if (!worksheet) {
      throw new Error('Không tìm thấy sheet "HCBVTQ" trong file Excel');
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
        const cap_bac = row.getCell(4).value?.toString().trim();
        const chuc_vu = row.getCell(5).value?.toString().trim();
        const danh_hieu = row.getCell(6).value?.toString().trim();
        const ghi_chu = row.getCell(7).value?.toString().trim();
        const so_quyet_dinh = row.getCell(8).value?.toString().trim();

        if (!ho_ten || !nam || !danh_hieu) {
          results.errors.push(`Dòng ${rowNumber}: Thiếu thông tin bắt buộc`);
          results.failed++;
          continue;
        }

        // Validate danh_hieu
        const validDanhHieu = ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'];
        if (!validDanhHieu.includes(danh_hieu)) {
          results.errors.push(
            `Dòng ${rowNumber}: Danh hiệu không hợp lệ. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`
          );
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
            danh_hieu,
            'CONG_HIEN',
            'APPROVED'
          );
          if (duplicateCheck.isDuplicate) {
            const { getDanhHieuName } = require('../constants/danhHieu.constants');
            results.errors.push(
              `Dòng ${rowNumber}: ${
                duplicateCheck.message
              } (Quân nhân: ${ho_ten}, Năm: ${nam}, Danh hiệu: ${getDanhHieuName(danh_hieu)})`
            );
            results.failed++;
            continue;
          }
        } catch (checkError) {
          console.error('Error checking duplicates:', checkError);
          // Continue processing but log the error
        }

        // Upsert (mỗi quân nhân chỉ có 1 bản ghi)
        const upsertedRecord = await prisma.khenThuongCongHien.upsert({
          where: { quan_nhan_id: personnel.id },
          create: {
            quan_nhan_id: personnel.id,
            danh_hieu,
            nam,
            cap_bac: cap_bac || null,
            chuc_vu: chuc_vu || null,
            ghi_chu: ghi_chu || null,
            so_quyet_dinh: so_quyet_dinh || null,
          },
          update: {
            danh_hieu,
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
          danh_hieu: upsertedRecord.danh_hieu,
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
   * Get all Contribution Awards with filters and pagination
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

    if (filters.danh_hieu) {
      where.danh_hieu = filters.danh_hieu;
    }

    const [data, total] = await Promise.all([
      prisma.khenThuongCongHien.findMany({
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
      prisma.khenThuongCongHien.count({ where }),
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
   * Export Contribution Awards to Excel
   */
  async exportToExcel(filters = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('HCBVTQ');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 5 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 30 },
      { header: 'TG nhóm 0.7 (tháng)', key: 'thoi_gian_nhom_0_7', width: 18 },
      { header: 'TG nhóm 0.8 (tháng)', key: 'thoi_gian_nhom_0_8', width: 18 },
      { header: 'TG nhóm 0.9-1.0 (tháng)', key: 'thoi_gian_nhom_0_9_1_0', width: 20 },
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
        danh_hieu: getDanhHieuName(item.danh_hieu),
        cap_bac: item.cap_bac,
        chuc_vu: item.chuc_vu,
        thoi_gian_nhom_0_7: convertThoiGian(item.thoi_gian_nhom_0_7),
        thoi_gian_nhom_0_8: convertThoiGian(item.thoi_gian_nhom_0_8),
        thoi_gian_nhom_0_9_1_0: convertThoiGian(item.thoi_gian_nhom_0_9_1_0),
        so_quyet_dinh: item.so_quyet_dinh,
        ghi_chu: item.ghi_chu || '',
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get Contribution Awards statistics
   */
  async getStatistics() {
    const byRank = await prisma.khenThuongCongHien.groupBy({
      by: ['danh_hieu'],
      _count: { id: true },
    });

    const byYear = await prisma.khenThuongCongHien.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });

    const total = await prisma.khenThuongCongHien.count();

    return {
      total,
      byRank,
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
   * Delete Contribution Award
   * @param {string} id - Award ID
   * @param {string} adminUsername - Username của admin thực hiện xóa
   * @returns {Promise<Object>}
   */
  async deleteAward(id, adminUsername = 'Admin') {
    const award = await prisma.khenThuongCongHien.findUnique({
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
    await prisma.khenThuongCongHien.delete({
      where: { id },
    });

    // Tự động cập nhật lại hồ sơ cống hiến (giống như khi thêm mới)
    try {
      await profileService.recalculateContributionProfile(personnelId);
      console.log(`✅ Auto-recalculated contribution profile for personnel ${personnelId}`);
    } catch (recalcError) {
      console.error(
        `⚠️ Failed to auto-recalculate contribution profile for personnel ${personnelId}:`,
        recalcError.message
      );
    }

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCBVTQ', adminUsername);
      console.log(`✅ Sent notification for deleted HCBVTQ award`);
    } catch (notifyError) {
      console.error(`⚠️ Failed to send notification:`, notifyError.message);
    }

    return {
      message: 'Xóa khen thưởng HCBVTQ thành công',
      personnelId,
    };
  }
}

module.exports = new ContributionAwardService();
