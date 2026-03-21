const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const proposalService = require('./proposal');
const profileService = require('./profile.service');
const notificationHelper = require('../helpers/notification');
const { ROLES } = require('../constants/roles');
const { ValidationError } = require('../middlewares/errorHandler');
const { parseHeaderMap, getHeaderCol } = require('../helpers/excelHelper');

class ScientificAchievementService {
  async getAchievements(personnelId) {
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
  }

  async createAchievement(data) {
    const { personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu, status } =
      data;

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

    const newAchievement = await prisma.thanhTichKhoaHoc.create({
      data: createData,
    });

    // Tự động cập nhật lại hồ sơ hằng năm (chỉ khi status = APPROVED)
    const finalStatus = status || 'PENDING';
    if (finalStatus === 'APPROVED') {
      try {
        await profileService.recalculateAnnualProfile(personnel_id);
      } catch (recalcError) {
        // Không throw error, chỉ log để không ảnh hưởng đến việc tạo thành tích
      }
    }

    return newAchievement;
  }

  async updateAchievement(id, data) {
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
        // Không throw error, chỉ log để không ảnh hưởng đến việc cập nhật thành tích
      }
    }

    return updatedAchievement;
  }

  /**
   * Xóa thành tích khoa học
   * @param {string} id - ID của thành tích
   * @param {string} adminUsername - Username của admin thực hiện xóa
   */
  async deleteAchievement(id, adminUsername = 'Admin') {
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
      } catch (recalcError) {}
    }

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(achievement, personnel, 'NCKH', adminUsername);
    } catch (notifyError) {}

    return {
      message: 'Xóa thành tích thành công',
      personnelId,
    };
  }

  /**
   * Xuất danh sách thành tích khoa học ra Excel
   */
  async exportToExcel(filters = {}) {
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
    const worksheet = workbook.addWorksheet('NCKH');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Đơn vị', key: 'don_vi', width: 30 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Loại', key: 'loai', width: 15 },
      { header: 'Mô tả', key: 'mo_ta', width: 40 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    achievements.forEach((achievement, index) => {
      const quanNhan = achievement.QuanNhan;
      const donVi = quanNhan?.DonViTrucThuoc?.ten_don_vi ?? quanNhan?.CoQuanDonVi?.ten_don_vi ?? '';
      const statusText =
        achievement.status === 'APPROVED'
          ? 'Đã duyệt'
          : achievement.status === 'PENDING'
            ? 'Chờ duyệt'
            : (achievement.status ?? '');

      worksheet.addRow({
        stt: index + 1,
        id: quanNhan?.id ?? '',
        ho_ten: quanNhan?.ho_ten ?? '',
        cap_bac: achievement.cap_bac ?? quanNhan?.cap_bac ?? '',
        chuc_vu: achievement.chuc_vu ?? quanNhan?.ChucVu?.ten_chuc_vu ?? '',
        don_vi: donVi,
        nam: achievement.nam,
        loai: achievement.loai ?? '',
        mo_ta: achievement.mo_ta ?? '',
        so_quyet_dinh: achievement.so_quyet_dinh ?? '',
        status: statusText,
        ghi_chu: achievement.ghi_chu ?? '',
      });
    });

    return workbook;
  }

  /**
   * Generate Excel template for importing scientific achievements
   */
  async generateTemplate(personnelIds = [], userRole = ROLES.MANAGER) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('NCKH');

    // Query personnel by IDs
    const personnelList =
      personnelIds.length > 0
        ? await prisma.quanNhan.findMany({
            where: { id: { in: personnelIds } },
            include: { ChucVu: true },
          })
        : [];

    // Query danh sách số quyết định hiện có để tạo dropdown
    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
      orderBy: { nam: 'desc' },
      take: 200,
    });
    const decisionNumbers = existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean);

    const columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Loại (*)', key: 'loai', width: 15 },
      { header: 'Mô tả (*)', key: 'mo_ta', width: 40 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
    ];

    worksheet.columns = columns;

    // Style cho header row: bold + gray background
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Pre-fill rows with personnel data
    personnelList.forEach((person, index) => {
      const rowData = {
        stt: index + 1,
        id: person.id,
        ho_ten: person.ho_ten ?? '',
        cap_bac: person.cap_bac ?? '',
        chuc_vu: person.ChucVu ? person.ChucVu.ten_chuc_vu : '',
      };
      worksheet.addRow(rowData);
    });

    // Light yellow background for readonly columns (STT, ID, Họ và tên)
    const readonlyColIndices = [1, 2, 3];
    const yellowFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFCC' },
    };

    for (let rowNum = 2; rowNum <= Math.max(personnelList.length + 1, 2); rowNum++) {
      const row = worksheet.getRow(rowNum);
      readonlyColIndices.forEach(colIdx => {
        row.getCell(colIdx).fill = yellowFill;
      });
    }

    // Data validation for Cấp bậc column (col 4) — dropdown
    const capBacOptions =
      'Binh nhì,Binh nhất,Hạ sĩ,Trung sĩ,Thượng sĩ,Thiếu úy,Trung úy,Thượng úy,Đại úy,Thiếu tá,Trung tá,Thượng tá,Đại tá,Thiếu tướng,Trung tướng,Thượng tướng,Đại tướng';
    const capBacSheet = workbook.addWorksheet('_CapBac', { state: 'veryHidden' });
    capBacOptions.split(',').forEach((cb, idx) => {
      capBacSheet.getCell(`A${idx + 1}`).value = cb;
    });
    const capBacCount = capBacOptions.split(',').length;
    const maxRows = Math.max(personnelList.length + 1, 50);
    for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
      worksheet.getRow(rowNum).getCell(4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_CapBac!$A$1:$A$${capBacCount}`],
      };
    }

    // Data validation for Loại column (col 7) — dropdown DTKH, SKKH
    for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
      worksheet.getRow(rowNum).getCell(7).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"DTKH,SKKH"'],
      };
    }

    // Data validation cho cột số quyết định — dropdown từ DB
    if (decisionNumbers.length > 0) {
      const soQdColNumber = columns.findIndex(c => c.key === 'so_quyet_dinh') + 1;
      const decisionListStr = decisionNumbers.join(',');

      if (decisionListStr.length <= 250) {
        for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
          worksheet.getRow(rowNum).getCell(soQdColNumber).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${decisionListStr}"`],
          };
        }
      } else {
        const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
        decisionNumbers.forEach((sqd, idx) => {
          refSheet.getCell(`A${idx + 1}`).value = sqd;
        });
        for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
          worksheet.getRow(rowNum).getCell(soQdColNumber).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`_QuyetDinh!$A$1:$A$${decisionNumbers.length}`],
          };
        }
      }
    }

    return workbook;
  }

  /**
   * Preview import: parse + validate file Excel, trả về kết quả preview (KHÔNG lưu DB)
   */
  async previewImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ValidationError('File Excel không hợp lệ');
    }

    // Verify đúng loại file bằng tên sheet
    if (worksheet.name !== 'NCKH') {
      throw new ValidationError(
        `File Excel không đúng loại. Sheet "${worksheet.name}" không phải "NCKH".`
      );
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const loaiCol = getHeaderCol(headerMap, ['loai', 'loại']);
    const moTaCol = getHeaderCol(headerMap, ['mo_ta', 'mota', 'mo_t']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol || !loaiCol || !moTaCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Loại, Mô tả. Tìm thấy headers: ${Object.keys(headerMap).join(
          ', '
        )}`
      );
    }

    const validLoai = ['DTKH', 'SKKH'];
    const errors = [];
    const valid = [];
    let total = 0;
    const seenInFile = new Set();
    const currentYear = new Date().getFullYear();

    // Query danh sách số quyết định hợp lệ trên hệ thống
    const existingDecisions = await prisma.fileQuyetDinh.findMany({
      select: { so_quyet_dinh: true },
    });
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const loai_raw = loaiCol ? String(row.getCell(loaiCol).value ?? '').trim() : '';
      const mo_ta = moTaCol ? String(row.getCell(moTaCol).value ?? '').trim() : '';
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      if (!idValue && !namVal && !loai_raw) continue;

      // Dòng có ID nhưng không có loại → bỏ qua, báo lý do
      if (idValue && !loai_raw) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: '',
          message: 'Bỏ qua — không có loại thành tích nào được điền',
        });
        continue;
      }

      total++;

      // Validate required fields
      const missingFields = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!loai_raw) missingFields.push('Loại');
      if (!mo_ta) missingFields.push('Mô tả');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Thiếu ${missingFields.join(', ')}`,
        });
        continue;
      }

      // Validate personnel ID
      const personnelId = String(idValue).trim();
      if (!personnelId) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `ID không hợp lệ: ${idValue}`,
        });
        continue;
      }
      const personnel = await prisma.quanNhan.findUnique({ where: { id: personnelId } });
      if (!personnel) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Không tìm thấy quân nhân với ID ${personnelId}`,
        });
        continue;
      }

      // Validate year
      const nam = parseInt(namVal);
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Validate loai
      const loaiUpper = loai_raw.toUpperCase();
      if (!validLoai.includes(loaiUpper)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Loại "${loai_raw}" không hợp lệ. Chỉ chấp nhận: ${validLoai.join(', ')}`,
        });
        continue;
      }
      const loai = loaiUpper;

      // Validate số quyết định — bắt buộc + phải có trên hệ thống
      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, loai, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // Check duplicate in file (same person + year + loai + mo_ta)
      const fileKey = `${personnel.id}_${nam}_${loai}_${mo_ta}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}, loại ${loai}, mô tả "${mo_ta}"`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      // Query existing NCKH history (last 5)
      const history = await prisma.thanhTichKhoaHoc.findMany({
        where: { quan_nhan_id: personnel.id },
        orderBy: { nam: 'desc' },
        take: 5,
        select: { nam: true, loai: true, mo_ta: true, so_quyet_dinh: true, status: true },
      });

      valid.push({
        row: rowNumber,
        personnel_id: personnel.id,
        ho_ten: ho_ten ?? personnel.ho_ten,
        cap_bac,
        chuc_vu,
        nam,
        loai,
        mo_ta,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

  /**
   * Confirm import: lưu dữ liệu đã validate vào DB
   */
  async confirmImport(validItems, adminId) {
    return await prisma.$transaction(
      async tx => {
        const results = [];
        for (const item of validItems) {
          const result = await tx.thanhTichKhoaHoc.create({
            data: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              loai: item.loai,
              mo_ta: item.mo_ta,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
              status: 'APPROVED',
            },
          });
          results.push(result);
        }
        return { imported: results.length };
      },
      { timeout: 30000 }
    );
  }
}

module.exports = new ScientificAchievementService();
