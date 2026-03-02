const { prisma } = require('../models');
const proposalService = require('./proposal.service');
const profileService = require('./profile.service');
const notificationHelper = require('../helpers/notificationHelper');

class ScientificAchievementService {
  async getAchievements(personnelId) {
    try {
      if (!personnelId) {
        throw new Error('personnel_id là bắt buộc');
      }

      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnelId },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const achievements = await prisma.thanhTichKhoaHoc.findMany({
        where: { quan_nhan_id: personnelId },
        orderBy: { nam: 'desc' },
      });

      return achievements;
    } catch (error) {
      throw error;
    }
  }

  async createAchievement(data) {
    try {
      const { personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu, status } =
        data;

      console.log('=== CREATE ACHIEVEMENT ===');
      console.log('Received data:', data);
      console.log('cap_bac:', cap_bac);
      console.log('chuc_vu:', chuc_vu);
      console.log('so_quyet_dinh:', so_quyet_dinh);

      const personnel = await prisma.quanNhan.findUnique({
        where: { id: personnel_id },
      });

      if (!personnel) {
        throw new Error('Quân nhân không tồn tại');
      }

      const validLoai = ['DTKH', 'SKKH'];
      if (!validLoai.includes(loai)) {
        throw new Error('Loại thành tích không hợp lệ. Loại hợp lệ: ' + validLoai.join(', '));
      }

      const validStatus = ['APPROVED', 'PENDING'];
      if (status && !validStatus.includes(status)) {
        throw new Error('Trạng thái không hợp lệ. Trạng thái hợp lệ: ' + validStatus.join(', '));
      }

      const createData = {
        quan_nhan_id: personnel_id,
        nam,
        loai,
        mo_ta,
        cap_bac: cap_bac || null,
        chuc_vu: chuc_vu || null,
        so_quyet_dinh: so_quyet_dinh || null,
        ghi_chu: ghi_chu || null,
        status: status || 'PENDING',
      };

      console.log('Create data:', createData);

      const newAchievement = await prisma.thanhTichKhoaHoc.create({
        data: createData,
      });

      console.log('Created achievement:', newAchievement);

      // Tự động cập nhật lại hồ sơ hằng năm (chỉ khi status = APPROVED)
      const finalStatus = status || 'PENDING';
      if (finalStatus === 'APPROVED') {
        try {
          await profileService.recalculateAnnualProfile(personnel_id);
        } catch (recalcError) {
          console.error(
            `⚠️ Failed to auto-recalculate annual profile for personnel ${personnel_id}:`,
            recalcError.message
          );
          // Không throw error, chỉ log để không ảnh hưởng đến việc tạo thành tích
        }
      }

      return newAchievement;
    } catch (error) {
      throw error;
    }
  }

  async updateAchievement(id, data) {
    try {
      const { nam, loai, mo_ta, cap_bac, chuc_vu, ghi_chu, status } = data;

      const achievement = await prisma.thanhTichKhoaHoc.findUnique({
        where: { id },
      });

      if (!achievement) {
        throw new Error('Thành tích không tồn tại');
      }

      if (loai) {
        const validLoai = ['DTKH', 'SKKH'];
        if (!validLoai.includes(loai)) {
          throw new Error('Loại thành tích không hợp lệ');
        }
      }

      if (status) {
        const validStatus = ['APPROVED', 'PENDING'];
        if (!validStatus.includes(status)) {
          throw new Error('Trạng thái không hợp lệ');
        }
      }

      const updateData = {};
      if (nam !== undefined) updateData.nam = nam;
      if (loai !== undefined) updateData.loai = loai;
      if (mo_ta !== undefined) updateData.mo_ta = mo_ta;
      if (cap_bac !== undefined) updateData.cap_bac = cap_bac;
      if (chuc_vu !== undefined) updateData.chuc_vu = chuc_vu;
      if (ghi_chu !== undefined) updateData.ghi_chu = ghi_chu;
      if (status !== undefined) updateData.status = status;

      const updatedAchievement = await prisma.thanhTichKhoaHoc.update({
        where: { id },
        data: updateData,
      });

      // Tự động cập nhật lại hồ sơ hằng năm (chỉ khi status = APPROVED)
      const finalStatus = status || achievement.status;
      if (finalStatus === 'APPROVED') {
        try {
          await profileService.recalculateAnnualProfile(achievement.quan_nhan_id);
        } catch (recalcError) {
          console.error(
            `⚠️ Failed to auto-recalculate annual profile for personnel ${achievement.quan_nhan_id}:`,
            recalcError.message
          );
          // Không throw error, chỉ log để không ảnh hưởng đến việc cập nhật thành tích
        }
      }

      return updatedAchievement;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa thành tích khoa học
   * @param {string} id - ID của thành tích
   * @param {string} adminUsername - Username của admin thực hiện xóa
   */
  async deleteAchievement(id, adminUsername = 'Admin') {
    try {
      const achievement = await prisma.thanhTichKhoaHoc.findUnique({
        where: { id },
        include: {
          QuanNhan: true,
        },
      });

      if (!achievement) {
        throw new Error('Thành tích không tồn tại');
      }

      const personnelId = achievement.quan_nhan_id;
      const personnel = achievement.QuanNhan;
      const wasApproved = achievement.status === 'APPROVED';

      await prisma.thanhTichKhoaHoc.delete({
        where: { id },
      });

      // Tự động cập nhật lại hồ sơ hằng năm (chỉ khi thành tích đã được duyệt)
      if (wasApproved) {
        try {
          await profileService.recalculateAnnualProfile(personnelId);
          console.log(`✅ Auto-recalculated annual profile for personnel ${personnelId}`);
        } catch (recalcError) {
          console.error(
            `⚠️ Failed to auto-recalculate annual profile for personnel ${personnelId}:`,
            recalcError.message
          );
        }
      }

      // Gửi thông báo cho Manager và quân nhân
      try {
        await notificationHelper.notifyOnAwardDeleted(
          achievement,
          personnel,
          'NCKH',
          adminUsername
        );
        console.log(`✅ Sent notification for deleted scientific achievement`);
      } catch (notifyError) {
        console.error(`⚠️ Failed to send notification:`, notifyError.message);
      }

      return {
        message: 'Xóa thành tích thành công',
        personnelId,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xuất danh sách thành tích khoa học ra Excel
   */
  async exportToExcel(filters = {}) {
    const ExcelJS = require('exceljs');
    const { nam, loai, don_vi_id } = filters;

    const where = {};
    if (nam) where.nam = nam;
    if (loai) where.loai = loai;
    if (don_vi_id) {
      where.QuanNhan = {
        OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
      };
    }

    const achievements = await prisma.thanhTichKhoaHoc.findMany({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: 10000,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Thành tích khoa học');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Họ tên', key: 'ho_ten', width: 25 },
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Loại', key: 'loai', width: 15 },
      { header: 'Mô tả', key: 'mo_ta', width: 40 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    achievements.forEach((achievement, index) => {
      const quanNhan = achievement.QuanNhan;
      const donVi = quanNhan?.DonViTrucThuoc?.ten_don_vi || quanNhan?.CoQuanDonVi?.ten_don_vi || '';
      const loaiText =
        achievement.loai === 'DTKH'
          ? 'Đề tài khoa học'
          : achievement.loai === 'SKKH'
          ? 'Sáng kiến khoa học'
          : achievement.loai;
      const statusText =
        achievement.status === 'APPROVED'
          ? 'Đã duyệt'
          : achievement.status === 'PENDING'
          ? 'Chờ duyệt'
          : achievement.status || '';

      worksheet.addRow({
        stt: index + 1,
        ho_ten: quanNhan?.ho_ten || '',
        cccd: quanNhan?.cccd || '',
        cap_bac: achievement.cap_bac || quanNhan?.cap_bac || '',
        chuc_vu: achievement.chuc_vu || quanNhan?.ChucVu?.ten_chuc_vu || '',
        don_vi: donVi,
        nam: achievement.nam,
        loai: loaiText,
        mo_ta: achievement.mo_ta || '',
        status: statusText,
        so_quyet_dinh: achievement.so_quyet_dinh || '',
        ghi_chu: achievement.ghi_chu || '',
      });
    });

    return workbook;
  }

  /**
   * Generate Excel template for importing scientific achievements
   */
  async generateTemplate(userRole = 'MANAGER') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Thành tích khoa học');

    // Define columns - ADMIN có số quyết định, MANAGER không có
    const columns = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Họ tên (*)', key: 'ho_ten', width: 25 },
      { header: 'Ngày sinh', key: 'ngay_sinh', width: 15 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Loại (*)', key: 'loai', width: 30 },
      { header: 'Mô tả (*)', key: 'mo_ta', width: 40 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
    ];

    // Chỉ ADMIN mới có cột số quyết định
    if (userRole === 'ADMIN') {
      columns.splice(8, 0, { header: 'Ghi chú', key: 'ghi_chu', width: 30 });
      columns.splice(9, 0, { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 });
    }

    worksheet.columns = columns;

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    const sampleRow = {
      stt: 1,
      ho_ten: 'Nguyễn Văn A',
      ngay_sinh: '15/05/1990',
      nam: 2024,
      loai: 'DTKH',
      mo_ta: 'Mô tả đề tài khoa học',
      cap_bac: 'Trung úy',
      chuc_vu: 'Phó phòng',
      ghi_chu: 'Ghi chú mẫu',
    };

    // Chỉ ADMIN mới có trường số quyết định trong sample
    if (userRole === 'ADMIN') {
      sampleRow.so_quyet_dinh = '123/QĐ-BQP';
    }

    worksheet.addRow(sampleRow);

    worksheet.addRow([]);
    worksheet.addRow(['Ghi chú:']);
    worksheet.addRow(['- Các cột có dấu (*) là bắt buộc']);
    worksheet.addRow(['- Loại hợp lệ: NCKH (Nghiên cứu khoa học), SKKH (Sáng kiến khoa học)']);
    worksheet.addRow(['- Năm phải là số nguyên dương']);
    worksheet.addRow(['- Họ tên phải tồn tại trong hệ thống']);
    worksheet.addRow([
      '- Ngày sinh dùng để phân biệt khi có nhiều người trùng tên (định dạng: DD/MM/YYYY)',
    ]);

    return workbook;
  }

  /**
   * Import scientific achievements from Excel
   */
  async importFromExcel(buffer) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    const errors = [];
    const imported = [];
    let total = 0;
    const selectedPersonnelIds = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const ho_ten = row.getCell(2).value?.toString().trim();

      if (!ho_ten) break;

      total++;
      const ngay_sinh_raw = row.getCell(3).value;
      const nam = parseInt(row.getCell(4).value);
      const loai = row.getCell(5).value?.toString().trim().toUpperCase();
      const mo_ta = row.getCell(6).value?.toString().trim();
      const cap_bac = row.getCell(7).value?.toString().trim();
      const chuc_vu = row.getCell(8).value?.toString().trim();
      const ghi_chu = row.getCell(9).value?.toString().trim();
      const so_quyet_dinh = row.getCell(10).value?.toString().trim();

      try {
        if (!ho_ten || !nam || !loai || !mo_ta) {
          throw new Error('Thiếu thông tin bắt buộc (họ tên, năm, loại, mô tả)');
        }

        if (!['DTKH', 'SKKH'].includes(loai)) {
          throw new Error('Loại không hợp lệ (chỉ chấp nhận DTKH hoặc SKKH)');
        }

        if (!Number.isInteger(nam) || nam < 1900 || nam > 2100) {
          throw new Error('Năm không hợp lệ');
        }

        // Tìm quân nhân theo tên
        const personnelList = await prisma.quanNhan.findMany({
          where: { ho_ten },
        });

        if (personnelList.length === 0) {
          throw new Error(`Không tìm thấy quân nhân với tên ${ho_ten}`);
        }

        let personnel;
        if (personnelList.length === 1) {
          personnel = personnelList[0];
        } else {
          // Có nhiều người trùng tên, dùng ngày sinh để phân biệt
          if (!ngay_sinh_raw) {
            throw new Error(
              `Có ${personnelList.length} người trùng tên "${ho_ten}". Vui lòng cung cấp ngày sinh để phân biệt`
            );
          }

          // Parse ngày sinh
          let ngay_sinh;
          if (ngay_sinh_raw instanceof Date) {
            ngay_sinh = ngay_sinh_raw;
          } else {
            const dateStr = String(ngay_sinh_raw).trim();
            // Hỗ trợ format DD/MM/YYYY
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2]);
              ngay_sinh = new Date(year, month, day);
            } else {
              throw new Error('Ngày sinh không đúng định dạng (DD/MM/YYYY)');
            }
          }

          // Tìm quân nhân có cùng ngày sinh
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
            throw new Error(`Không tìm thấy quân nhân tên "${ho_ten}" với ngày sinh ${dateStr}`);
          }
        }

        // Check for duplicate awards in proposals
        try {
          const duplicateCheck = await proposalService.checkDuplicateAward(
            personnel.id,
            nam,
            loai,
            'NCKH'
          );
          if (duplicateCheck.isDuplicate) {
            throw new Error(duplicateCheck.message);
          }
        } catch (checkError) {
          if (checkError.message.includes('duplicate')) {
            throw checkError;
          }
          console.error('Error checking duplicates:', checkError);
          // Continue processing but log the error
        }

        const achievement = await prisma.thanhTichKhoaHoc.create({
          data: {
            quan_nhan_id: personnel.id,
            nam,
            loai,
            mo_ta,
            cap_bac: cap_bac || null,
            chuc_vu: chuc_vu || null,
            so_quyet_dinh: so_quyet_dinh || null,
            ghi_chu: ghi_chu || null,
            status: 'APPROVED',
          },
        });
        imported.push(achievement);
        selectedPersonnelIds.push(personnel.id);
      } catch (error) {
        errors.push(`Dòng ${i}: ${error.message}`);
      }
    }

    return {
      total,
      imported: imported.length,
      errors,
      selectedPersonnelIds,
      titleData: imported,
    };
  }
}

module.exports = new ScientificAchievementService();
