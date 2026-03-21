const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const proposalService = require('./proposal');
const { checkDuplicateAward } = require('./proposal/validation');
const profileService = require('./profile.service');
const notificationHelper = require('../helpers/notification');
const { getDanhHieuName } = require('../constants/danhHieu.constants');
const { ROLES } = require('../constants/roles');
const { NotFoundError, ValidationError } = require('../middlewares/errorHandler');
const { parseHeaderMap, getHeaderCol, parseBooleanValue } = require('../helpers/excelHelper');

class AnnualRewardService {
  /**
   * Lấy nhật ký danh hiệu của 1 quân nhân
   */
  async getAnnualRewards(personnelId) {
    if (!personnelId) {
      throw new ValidationError('personnel_id là bắt buộc');
    }

    // Kiểm tra quân nhân có tồn tại không
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const rewards = await prisma.danhHieuHangNam.findMany({
      where: { quan_nhan_id: personnelId },
      orderBy: {
        nam: 'desc',
      },
    });

    return rewards;
  }

  /**
   * Thêm danh hiệu cho quân nhân
   */
  async createAnnualReward(data) {
    const {
      personnel_id,
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    } = data;

    // Kiểm tra quân nhân có tồn tại không
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnel_id },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Validate danh hiệu (cho phép null = không đạt)
    const validDanhHieu = ['CSTDCS', 'CSTT'];
    if (danh_hieu && !validDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(
        'Danh hiệu không hợp lệ. Danh hiệu hợp lệ: ' +
          validDanhHieu.join(', ') +
          ' (hoặc null = không đạt)'
      );
    }

    // Kiểm tra đã có bản ghi cho năm này chưa
    const existingReward = await prisma.danhHieuHangNam.findFirst({
      where: {
        quan_nhan_id: personnel_id,
        nam,
      },
    });

    if (existingReward) {
      throw new ValidationError(`Quân nhân đã có danh hiệu cho năm ${nam}`);
    }

    // Tạo bản ghi mới
    const newReward = await prisma.danhHieuHangNam.create({
      data: {
        quan_nhan_id: personnel_id,
        nam,
        danh_hieu,
        cap_bac: cap_bac || null,
        chuc_vu: chuc_vu || null,
        ghi_chu: ghi_chu || null,
        nhan_bkbqp: nhan_bkbqp || false,
        so_quyet_dinh_bkbqp: so_quyet_dinh_bkbqp || null,
        nhan_cstdtq: nhan_cstdtq || false,
        so_quyet_dinh_cstdtq: so_quyet_dinh_cstdtq || null,
        nhan_bkttcp: nhan_bkttcp || false,
        so_quyet_dinh_bkttcp: so_quyet_dinh_bkttcp || null,
      },
    });

    // Tự động cập nhật lại hồ sơ hằng năm
    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (recalcError) {
      // Không throw error, chỉ log để không ảnh hưởng đến việc tạo danh hiệu
    }

    return newReward;
  }

  /**
   * Sửa một bản ghi danh hiệu
   */
  async updateAnnualReward(id, data) {
    const {
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    } = data;

    // Kiểm tra bản ghi có tồn tại không
    const reward = await prisma.danhHieuHangNam.findUnique({
      where: { id },
    });

    if (!reward) {
      throw new NotFoundError('Bản ghi danh hiệu');
    }

    // Validate danh hiệu nếu có (cho phép null = không đạt)
    if (danh_hieu) {
      const validDanhHieu = ['CSTDCS', 'CSTT'];
      if (!validDanhHieu.includes(danh_hieu)) {
        throw new ValidationError(
          'Danh hiệu không hợp lệ. Danh hiệu hợp lệ: ' +
            validDanhHieu.join(', ') +
            ' (hoặc null = không đạt)'
        );
      }
    }

    // Cập nhật
    const updatedReward = await prisma.danhHieuHangNam.update({
      where: { id },
      data: {
        nam: nam || reward.nam,
        danh_hieu: danh_hieu || reward.danh_hieu,
        cap_bac: cap_bac !== undefined ? cap_bac : reward.cap_bac,
        chuc_vu: chuc_vu !== undefined ? chuc_vu : reward.chuc_vu,
        ghi_chu: ghi_chu !== undefined ? ghi_chu : reward.ghi_chu,
        nhan_bkbqp: nhan_bkbqp !== undefined ? nhan_bkbqp : reward.nhan_bkbqp,
        so_quyet_dinh_bkbqp:
          so_quyet_dinh_bkbqp !== undefined ? so_quyet_dinh_bkbqp : reward.so_quyet_dinh_bkbqp,
        nhan_cstdtq: nhan_cstdtq !== undefined ? nhan_cstdtq : reward.nhan_cstdtq,
        so_quyet_dinh_cstdtq:
          so_quyet_dinh_cstdtq !== undefined ? so_quyet_dinh_cstdtq : reward.so_quyet_dinh_cstdtq,
        nhan_bkttcp: nhan_bkttcp !== undefined ? nhan_bkttcp : reward.nhan_bkttcp,
        so_quyet_dinh_bkttcp:
          so_quyet_dinh_bkttcp !== undefined ? so_quyet_dinh_bkttcp : reward.so_quyet_dinh_bkttcp,
      },
    });

    // Tự động cập nhật lại hồ sơ hằng năm
    try {
      await profileService.recalculateAnnualProfile(reward.quan_nhan_id);
    } catch (recalcError) {
      // Không throw error, chỉ log để không ảnh hưởng đến việc cập nhật danh hiệu
    }

    return updatedReward;
  }

  /**
   * Xóa một bản ghi danh hiệu
   * @param {string} id - ID của bản ghi danh hiệu
   * @param {string} adminUsername - Username của admin thực hiện xóa
   */
  async deleteAnnualReward(id, adminUsername = 'Admin') {
    // Kiểm tra bản ghi có tồn tại không và lấy thông tin quân nhân
    const reward = await prisma.danhHieuHangNam.findUnique({
      where: { id },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
          },
        },
      },
    });

    if (!reward) {
      throw new NotFoundError('Bản ghi danh hiệu');
    }

    const personnelId = reward.quan_nhan_id;
    const personnel = reward.QuanNhan;

    // Xóa
    await prisma.danhHieuHangNam.delete({
      where: { id },
    });

    // Tự động cập nhật lại hồ sơ hằng năm
    try {
      await profileService.recalculateAnnualProfile(personnelId);
    } catch (recalcError) {}

    // Gửi thông báo cho Manager và quân nhân
    try {
      await notificationHelper.notifyOnAwardDeleted(
        reward,
        personnel,
        'CA_NHAN_HANG_NAM',
        adminUsername
      );
    } catch (notifyError) {}

    return {
      message: 'Xóa bản ghi danh hiệu thành công',
      personnelId,
      personnel,
      reward,
    };
  }

  /**
   * Import danh hiệu hằng năm từ Excel buffer
   * Cột bắt buộc: Họ tên, Năm, Danh hiệu (CSTDCS hoặc CSTT)
   * Khóa: quan_nhan_id + nam (nếu đã có sẽ cập nhật; nếu chưa có sẽ tạo mới)
   */
  async importFromExcelBuffer(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ValidationError('File Excel không hợp lệ');
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);
    const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
    const cstdtqCol = getHeaderCol(headerMap, ['nhan_cstdtq', 'cstdtq']);
    const bkttcpCol = getHeaderCol(headerMap, ['nhan_bkttcp', 'bkttcp']);

    if (!idCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(
          ', '
        )}`
      );
    }

    // Verify đúng loại file bằng tên sheet
    if (worksheet.name === 'Khen thưởng đơn vị') {
      throw new ValidationError(
        'File Excel không đúng loại. Đây là file khen thưởng đơn vị, không phải cá nhân hằng năm.'
      );
    }

    const validDanhHieu = ['CSTDCS', 'CSTT'];
    const errors = [];
    const selectedPersonnelIds = [];
    const titleData = [];
    let total = 0;

    // Phase 1: Parse và validate tất cả rows từ Excel, thu thập dữ liệu cần ghi
    const rowsToProcess = [];
    // [Fix #1] Theo dõi trùng lặp trong cùng file Excel (personnel_id + năm)
    const seenInFile = new Set();

    const currentYear = new Date().getFullYear();

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value || '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;
      const nhan_bkbqp = bkbqpCol ? parseBooleanValue(row.getCell(bkbqpCol).value) : false;
      const nhan_cstdtq = cstdtqCol ? parseBooleanValue(row.getCell(cstdtqCol).value) : false;
      const nhan_bkttcp = bkttcpCol ? parseBooleanValue(row.getCell(bkttcpCol).value) : false;

      if (!idValue && !namVal && !danh_hieu_raw) continue; // dòng trống

      total++; // Đếm tổng số dòng có data

      // Kiểm tra dòng thiếu trường bắt buộc
      const missingFields = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!danh_hieu_raw) missingFields.push('Danh hiệu');
      if (missingFields.length > 0) {
        errors.push(`Dòng ${rowNumber}: Thiếu ${missingFields.join(', ')}`);
        continue;
      }

      // Tìm quân nhân theo ID
      const personnelId = String(idValue).trim();
      if (!personnelId) {
        errors.push(`Dòng ${rowNumber}: ID không hợp lệ: ${idValue}`);
        continue;
      }
      const personnel = await prisma.quanNhan.findUnique({ where: { id: personnelId } });
      if (!personnel) {
        errors.push(`Dòng ${rowNumber}: Không tìm thấy quân nhân với ID ${personnelId}`);
        continue;
      }

      const nam = parseInt(namVal);
      if (!Number.isInteger(nam)) {
        errors.push(`Dòng ${rowNumber}: Giá trị năm không hợp lệ`);
        continue;
      }

      // Validate phạm vi năm
      if (nam < 1900 || nam > currentYear) {
        errors.push(`Dòng ${rowNumber}: Năm phải từ 1900 đến ${currentYear} (nhận được: ${nam})`);
        continue;
      }

      // Validate danh_hieu
      const danhHieuUpper = danh_hieu_raw.toUpperCase();
      if (!validDanhHieu.includes(danhHieuUpper)) {
        errors.push(
          `Dòng ${rowNumber}: Danh hiệu không hợp lệ: "${danh_hieu_raw}". Chỉ chấp nhận: ${validDanhHieu.join(', ')}`
        );
        continue;
      }
      const danh_hieu = danhHieuUpper;

      // [Fix #1] Kiểm tra trùng lặp trong cùng file Excel
      const fileKey = `${personnel.id}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push(
          `Dòng ${rowNumber}: Quân nhân "${ho_ten}" đã xuất hiện ở dòng trước cho năm ${nam} (trùng lặp trong file)`
        );
        continue;
      }
      seenInFile.add(fileKey);

      // Check for duplicate awards in DB (proposals đã APPROVED)
      if (danh_hieu) {
        try {
          const duplicateCheck = await proposalService.checkDuplicateAward(
            personnel.id,
            nam,
            danh_hieu,
            'CA_NHAN_HANG_NAM',
            'APPROVED'
          );
          if (duplicateCheck.isDuplicate) {
            errors.push(
              `Dòng ${rowNumber}: ${ho_ten} đã có ${getDanhHieuName(danh_hieu)} năm ${nam} (đã được duyệt trước đó)`
            );
            continue;
          }
        } catch (checkError) {
          // Bỏ qua lỗi check duplicate, tiếp tục xử lý
        }
      }

      // Đã validate xong, thêm vào danh sách cần xử lý
      rowsToProcess.push({
        personnel,
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        ho_ten,
        nhan_bkbqp,
        nhan_cstdtq,
        nhan_bkttcp,
      });
    }

    // Phase 2: Sử dụng transaction để ghi tất cả dữ liệu atomically
    const { created, updated } = await prisma.$transaction(async tx => {
      const txCreated = [];
      const txUpdated = [];

      for (const rowData of rowsToProcess) {
        const {
          personnel,
          nam,
          danh_hieu,
          cap_bac,
          chuc_vu,
          ghi_chu,
          nhan_bkbqp,
          nhan_cstdtq,
          nhan_bkttcp,
        } = rowData;

        // Tìm bản ghi danh hiệu theo khóa (quan_nhan_id + nam)
        const existing = await tx.danhHieuHangNam.findFirst({
          where: { quan_nhan_id: personnel.id, nam },
        });

        if (!existing) {
          const createdReward = await tx.danhHieuHangNam.create({
            data: {
              quan_nhan_id: personnel.id,
              nam,
              danh_hieu,
              cap_bac: cap_bac || null,
              chuc_vu: chuc_vu || null,
              ghi_chu: ghi_chu || null,
              nhan_bkbqp: nhan_bkbqp || false,
              nhan_cstdtq: nhan_cstdtq || false,
              nhan_bkttcp: nhan_bkttcp || false,
            },
          });
          txCreated.push(createdReward.id);
        } else {
          await tx.danhHieuHangNam.update({
            where: { id: existing.id },
            data: {
              danh_hieu,
              cap_bac: cap_bac !== undefined ? cap_bac : existing.cap_bac,
              chuc_vu: chuc_vu !== undefined ? chuc_vu : existing.chuc_vu,
              ghi_chu: ghi_chu !== undefined ? ghi_chu : existing.ghi_chu,
              nhan_bkbqp: nhan_bkbqp !== undefined ? nhan_bkbqp : existing.nhan_bkbqp,
              nhan_cstdtq: nhan_cstdtq !== undefined ? nhan_cstdtq : existing.nhan_cstdtq,
              nhan_bkttcp: nhan_bkttcp !== undefined ? nhan_bkttcp : existing.nhan_bkttcp,
            },
          });
          txUpdated.push(existing.id);
        }

        // Add to selectedPersonnelIds if not already added
        if (!selectedPersonnelIds.includes(personnel.id)) {
          selectedPersonnelIds.push(personnel.id);
        }

        // Add to titleData with full information from Excel
        titleData.push({
          personnelId: personnel.id,
          quan_nhan_id: personnel.id,
          danh_hieu: danh_hieu,
          nam: nam,
          cap_bac: cap_bac || null,
          chuc_vu: chuc_vu || null,
          ghi_chu: ghi_chu || null,
          nhan_bkbqp: nhan_bkbqp || false,
          nhan_cstdtq: nhan_cstdtq || false,
          nhan_bkttcp: nhan_bkttcp || false,
          so_quyet_dinh: null,
        });
      }

      return { created: txCreated, updated: txUpdated };
    });

    // Phase 3: Tự động cập nhật lại hồ sơ hằng năm cho các quân nhân (ngoài transaction)
    for (const personnelId of selectedPersonnelIds) {
      try {
        await profileService.recalculateAnnualProfile(personnelId);
      } catch {
        // Không throw error — profile sẽ được cập nhật lại bởi cron job hàng tháng
      }
    }

    const imported = created.length + updated.length;
    console.log(
      `[Import danh hiệu] Hoàn tất: ${imported}/${total} thành công, ${errors.length} lỗi`
    );
    if (errors.length > 0) {
      console.log(`[Import danh hiệu] Lỗi:`, errors.slice(0, 10).join(' | '));
    }

    return {
      imported,
      total,
      errors,
      selectedPersonnelIds,
      titleData,
    };
  }

  /**
   * Preview import danh hiệu hằng năm từ Excel (chỉ validate, không ghi DB)
   * Trả về danh sách valid items kèm lịch sử khen thưởng, và danh sách lỗi
   */
  async previewImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new ValidationError('File Excel không hợp lệ');
    }

    // Header map
    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);
    const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
    const cstdtqCol = getHeaderCol(headerMap, ['nhan_cstdtq', 'cstdtq']);
    const bkttcpCol = getHeaderCol(headerMap, ['nhan_bkttcp', 'bkttcp']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const soQdBkbqpCol = getHeaderCol(headerMap, ['so_quyet_dinh_bkbqp', 'so_qd_bkbqp']);
    const soQdCstdtqCol = getHeaderCol(headerMap, ['so_quyet_dinh_cstdtq', 'so_qd_cstdtq']);
    const soQdBkttcpCol = getHeaderCol(headerMap, ['so_quyet_dinh_bkttcp', 'so_qd_bkttcp']);

    if (!idCol || !namCol || !danhHieuCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(
          ', '
        )}`
      );
    }

    // Verify đúng loại file bằng tên sheet
    if (worksheet.name === 'Khen thưởng đơn vị') {
      throw new ValidationError(
        'File Excel không đúng loại. Đây là file khen thưởng đơn vị, không phải cá nhân hằng năm.'
      );
    }

    const validDanhHieu = ['CSTDCS', 'CSTT'];
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
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value || '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const danh_hieu_raw = String(row.getCell(danhHieuCol).value || '').trim();
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value || '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value || '').trim() : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;

      // Đọc cột BKBQP/CSTDTQ/BKTTCP để kiểm tra — chỉ dùng cho export, không cho import
      const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value ?? '').trim() : '';
      const cstdtqRaw = cstdtqCol ? String(row.getCell(cstdtqCol).value ?? '').trim() : '';
      const bkttcpRaw = bkttcpCol ? String(row.getCell(bkttcpCol).value ?? '').trim() : '';

      if (!idValue && !namVal && !danh_hieu_raw) continue;

      // Dòng có ID nhưng không có danh hiệu → bỏ qua, báo lý do
      if (idValue && !danh_hieu_raw) {
        const skipName = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
        errors.push({
          row: rowNumber,
          ho_ten: skipName,
          nam: namVal,
          danh_hieu: '',
          message: 'Bỏ qua — không có danh hiệu nào được điền',
        });
        continue;
      }

      total++;

      // Chặn nếu điền BKBQP/CSTDTQ/BKTTCP qua Excel
      if (parseBooleanValue(bkbqpRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: 'BKBQP không được import qua Excel. Vui lòng thêm trên giao diện.',
        });
        continue;
      }
      if (parseBooleanValue(cstdtqRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: 'CSTDTQ không được import qua Excel. Vui lòng thêm trên giao diện.',
        });
        continue;
      }
      if (parseBooleanValue(bkttcpRaw)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
          message: 'BKTTCP không được import qua Excel. Vui lòng thêm trên giao diện.',
        });
        continue;
      }

      // Validate required fields
      const missingFields = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!danh_hieu_raw) missingFields.push('Danh hiệu');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          danh_hieu: danh_hieu_raw,
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
          danh_hieu: danh_hieu_raw,
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
          danh_hieu: danh_hieu_raw,
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
          danh_hieu: danh_hieu_raw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu: danh_hieu_raw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      // Validate danh_hieu
      const danhHieuUpper = danh_hieu_raw.toUpperCase();
      if (!validDanhHieu.includes(danhHieuUpper)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu: danh_hieu_raw,
          message: `Danh hiệu "${danh_hieu_raw}" không tồn tại. Chỉ chấp nhận: ${validDanhHieu.join(', ')}`,
        });
        continue;
      }
      const danh_hieu = danhHieuUpper;

      // Validate số quyết định — bắt buộc + phải có trên hệ thống
      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, danh_hieu, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      // Check duplicate in file
      const fileKey = `${personnel.id}_${nam}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      // Check duplicate in DB — chỉ chặn nếu đã có danh hiệu cơ bản (CSTT/CSTDCS)
      const existingReward = await prisma.danhHieuHangNam.findFirst({
        where: { quan_nhan_id: personnel.id, nam },
      });
      if (existingReward && existingReward.danh_hieu) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          danh_hieu,
          message: `Đã có danh hiệu ${existingReward.danh_hieu} năm ${nam} trên hệ thống`,
        });
        continue;
      }

      // Query existing award history (last 5)
      const history = await prisma.danhHieuHangNam.findMany({
        where: { quan_nhan_id: personnel.id },
        orderBy: { nam: 'desc' },
        take: 5,
        select: {
          nam: true,
          danh_hieu: true,
          nhan_bkbqp: true,
          nhan_cstdtq: true,
          nhan_bkttcp: true,
          so_quyet_dinh: true,
        },
      });

      valid.push({
        row: rowNumber,
        personnel_id: personnel.id,
        ho_ten: ho_ten ?? personnel.ho_ten,
        cap_bac,
        chuc_vu,
        nam,
        danh_hieu,
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
  async confirmImport(validItems) {
    return await prisma.$transaction(
      async tx => {
        const results = [];
        for (const item of validItems) {
          const result = await tx.danhHieuHangNam.upsert({
            where: {
              quan_nhan_id_nam: {
                quan_nhan_id: item.personnel_id,
                nam: item.nam,
              },
            },
            update: {
              danh_hieu: item.danh_hieu,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              danh_hieu: item.danh_hieu,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
          });
          results.push(result);
        }
        return { imported: results.length };
      },
      { timeout: 30000 }
    );
  }

  /**
   * Kiểm tra quân nhân đã có khen thưởng hoặc đề xuất cho năm đó chưa
   */
  async checkAnnualRewards(personnelIds, nam, danhHieu) {
    const results = [];

    for (const personnelId of personnelIds) {
      // Chuyển đổi personnelId sang string nếu cần
      const personnelIdStr = String(personnelId);

      if (!personnelIdStr) {
        continue;
      }

      const result = {
        personnel_id: personnelId,
        has_reward: false,
        has_proposal: false,
        reward: null,
        proposal: null,
      };

      // Kiểm tra đã có khen thưởng cho năm này chưa
      const existingReward = await prisma.danhHieuHangNam.findFirst({
        where: {
          quan_nhan_id: personnelIdStr,
          nam: parseInt(nam),
        },
      });

      if (existingReward) {
        result.has_reward = true;
        result.reward = {
          id: existingReward.id,
          nam: existingReward.nam,
          danh_hieu: existingReward.danh_hieu,
          nhan_bkbqp: existingReward.nhan_bkbqp,
          nhan_cstdtq: existingReward.nhan_cstdtq,
          nhan_bkttcp: existingReward.nhan_bkttcp,
        };
      }

      // Kiểm tra có đề xuất đang chờ hoặc đã duyệt cho năm này không
      const proposals = await prisma.bangDeXuat.findMany({
        where: {
          loai_de_xuat: 'CA_NHAN_HANG_NAM',
          nam: parseInt(nam),
          status: {
            in: ['PENDING', 'APPROVED'],
          },
        },
        select: {
          id: true,
          nam: true,
          status: true,
          data_danh_hieu: true,
        },
      });

      // Kiểm tra xem quân nhân có trong đề xuất nào không
      for (const proposal of proposals) {
        if (proposal.data_danh_hieu) {
          const dataList = Array.isArray(proposal.data_danh_hieu) ? proposal.data_danh_hieu : [];

          const found = dataList.some(
            item => String(item.personnel_id) === personnelIdStr && item.danh_hieu === danhHieu
          );

          if (found) {
            result.has_proposal = true;
            result.proposal = {
              id: proposal.id,
              nam: proposal.nam,
              status: proposal.status,
            };
            break;
          }
        }
      }

      results.push(result);
    }

    return {
      results,
      summary: {
        total: personnelIds.length,
        has_reward: results.filter(r => r.has_reward).length,
        has_proposal: results.filter(r => r.has_proposal).length,
        can_add: results.filter(r => !r.has_reward && !r.has_proposal).length,
      },
    };
  }

  /**
   * Thêm danh hiệu đồng loạt cho nhiều quân nhân
   */
  async bulkCreateAnnualRewards(data) {
    const {
      personnel_ids,
      personnel_rewards_data, // Mảng chứa thông tin riêng cho từng quân nhân
      nam,
      danh_hieu,
      ghi_chu,
      so_quyet_dinh, // Giữ lại để tương thích ngược
      cap_bac, // Giữ lại để tương thích ngược
      chuc_vu, // Giữ lại để tương thích ngược
    } = data;

    // Validate danh hiệu - mở rộng để hỗ trợ tất cả các loại
    const validDanhHieu = ['CSTDCS', 'CSTT', 'BKBQP', 'CSTDTQ', 'BKTTCP'];
    if (!validDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(
        'Danh hiệu không hợp lệ. Danh hiệu hợp lệ: ' + validDanhHieu.join(', ')
      );
    }

    const errors = [];
    const skipped = [];

    // Tạo map từ personnel_rewards_data để tra cứu nhanh
    const personnelDataMap = {};
    if (personnel_rewards_data && Array.isArray(personnel_rewards_data)) {
      personnel_rewards_data.forEach(item => {
        if (item.personnel_id) {
          personnelDataMap[item.personnel_id] = item;
        }
      });
    }

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu cho bulk create
    const created = await prisma.$transaction(async tx => {
      const txCreated = [];

      for (const personnelId of personnel_ids) {
        // Chuyển đổi personnelId sang string nếu cần
        const personnelIdStr = String(personnelId);

        if (!personnelIdStr) {
          errors.push({
            personnelId,
            error: 'ID quân nhân không hợp lệ',
          });
          continue;
        }

        // Lấy thông tin riêng cho quân nhân này (ưu tiên personnel_rewards_data)
        const personnelData = personnelDataMap[personnelIdStr] || {};
        const individualSoQuyetDinh = personnelData.so_quyet_dinh || so_quyet_dinh;
        const individualCapBac = personnelData.cap_bac || cap_bac;
        const individualChucVu = personnelData.chuc_vu || chuc_vu;

        // Kiểm tra quân nhân có tồn tại không
        const personnel = await tx.quanNhan.findUnique({
          where: { id: personnelIdStr },
        });

        if (!personnel) {
          errors.push({
            personnelId,
            error: 'Quân nhân không tồn tại',
          });
          continue;
        }

        // Kiểm tra duplicate award (cùng năm, cùng danh hiệu, đã được duyệt)
        try {
          const duplicateResult = await checkDuplicateAward(
            personnelIdStr,
            parseInt(nam),
            danh_hieu,
            'CA_NHAN_HANG_NAM',
            'APPROVED'
          );
          if (duplicateResult.exists) {
            errors.push({
              personnelId,
              error: duplicateResult.message,
            });
            continue;
          }
        } catch (dupError) {
          // Log but don't block - fall through to existing logic
        }

        // Kiểm tra đã có danh hiệu cho năm này chưa
        const existingReward = await tx.danhHieuHangNam.findFirst({
          where: {
            quan_nhan_id: personnelIdStr,
            nam: parseInt(nam),
          },
        });

        // Xử lý danh hiệu: CSTDCS/CSTT lưu vào trường danh_hieu, BKBQP/CSTDTQ/BKTTCP lưu vào boolean fields
        let finalDanhHieu = null;
        let nhanBKBQP = false;
        let nhanCSTDTQ = false;
        let nhanBKTTCP = false;

        if (danh_hieu === 'CSTDCS' || danh_hieu === 'CSTT') {
          finalDanhHieu = danh_hieu;
        } else if (danh_hieu === 'BKBQP') {
          nhanBKBQP = true;
        } else if (danh_hieu === 'CSTDTQ') {
          nhanCSTDTQ = true;
        } else if (danh_hieu === 'BKTTCP') {
          nhanBKTTCP = true;
        }

        let rewardRecord;

        if (existingReward) {
          // Nếu đã có bản ghi, cập nhật thêm các trường boolean nếu chọn BKBQP/CSTDTQ/BKTTCP
          if (danh_hieu === 'BKBQP' || danh_hieu === 'CSTDTQ' || danh_hieu === 'BKTTCP') {
            // Cập nhật các trường boolean
            const updateData = {};
            if (danh_hieu === 'BKBQP') {
              updateData.nhan_bkbqp = true;
            } else if (danh_hieu === 'CSTDTQ') {
              updateData.nhan_cstdtq = true;
            } else if (danh_hieu === 'BKTTCP') {
              updateData.nhan_bkttcp = true;
            }

            // Cập nhật các trường khác nếu có
            if (individualCapBac) updateData.cap_bac = individualCapBac;
            if (individualChucVu) updateData.chuc_vu = individualChucVu;
            if (individualSoQuyetDinh) updateData.so_quyet_dinh = individualSoQuyetDinh;
            if (ghi_chu) updateData.ghi_chu = ghi_chu;

            rewardRecord = await tx.danhHieuHangNam.update({
              where: { id: existingReward.id },
              data: updateData,
            });
          } else {
            // Nếu chọn CSTDCS/CSTT mà đã có bản ghi thì bỏ qua
            skipped.push({
              personnelId,
              reason: `Đã có danh hiệu cho năm ${nam}`,
            });
            continue;
          }
        } else {
          // Tạo bản ghi mới
          rewardRecord = await tx.danhHieuHangNam.create({
            data: {
              quan_nhan_id: personnelIdStr,
              nam: parseInt(nam),
              danh_hieu: finalDanhHieu,
              cap_bac: individualCapBac || null,
              chuc_vu: individualChucVu || null,
              so_quyet_dinh: individualSoQuyetDinh || null,
              ghi_chu: ghi_chu || null,
              nhan_bkbqp: nhanBKBQP,
              nhan_cstdtq: nhanCSTDTQ,
              nhan_bkttcp: nhanBKTTCP,
            },
          });
        }

        txCreated.push(rewardRecord);
      }

      return txCreated;
    });

    // Tự động cập nhật lại hồ sơ hằng năm cho các quân nhân đã tạo/cập nhật (ngoài transaction)
    for (const rewardRecord of created) {
      try {
        await profileService.recalculateAnnualProfile(rewardRecord.quan_nhan_id);
      } catch (recalcError) {}
    }

    console.log(
      `[Bulk tạo danh hiệu] ${danh_hieu} năm ${nam}: ${created.length} thành công, ${skipped.length} bỏ qua, ${errors.length} lỗi`
    );

    return {
      success: created.length,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        created,
        skipped,
        errors,
      },
    };
  }

  /**
   * Xuất file mẫu Excel để import (pre-filled với danh sách quân nhân)
   */
  async exportTemplate(personnelIds = [], userRole = 'MANAGER') {
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh hiệu hằng năm');

    // Định nghĩa các cột
    const columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm (*)', key: 'nam', width: 10 },
      { header: 'Danh hiệu (*)', key: 'danh_hieu', width: 15 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
      // Các cột dưới chỉ dùng cho export, KHÔNG được điền khi import
      { header: 'BKBQP (không điền)', key: 'nhan_bkbqp', width: 18 },
      { header: 'CSTDTQ (không điền)', key: 'nhan_cstdtq', width: 18 },
      { header: 'BKTTCP (không điền)', key: 'nhan_bkttcp', width: 18 },
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
        ho_ten: person.ho_ten || '',
        cap_bac: person.cap_bac || '',
        chuc_vu: person.ChucVu ? person.ChucVu.ten_chuc_vu : '',
      };
      worksheet.addRow(rowData);
    });

    // Light yellow background for readonly columns (STT, ID, Họ và tên)
    // Cấp bậc và Chức vụ pre-fill nhưng cho phép sửa
    const readonlyColIndices = [1, 2, 3]; // columns: STT, ID, Họ và tên
    const yellowFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFCC' },
    };

    // Nền đỏ nhạt cho cột BKBQP/CSTDTQ/BKTTCP (không điền khi import)
    const redFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCCCC' },
    };
    const bkColIndices = [10, 11, 12]; // BKBQP, CSTDTQ, BKTTCP

    for (let rowNum = 1; rowNum <= Math.max(personnelList.length + 1, 2); rowNum++) {
      const row = worksheet.getRow(rowNum);
      if (rowNum >= 2) {
        readonlyColIndices.forEach(colIdx => {
          row.getCell(colIdx).fill = yellowFill;
        });
      }
      bkColIndices.forEach(colIdx => {
        row.getCell(colIdx).fill = redFill;
      });
    }

    // Data validation for Cấp bậc column (col 4) — dropdown
    const capBacOptions =
      'Binh nhì,Binh nhất,Hạ sĩ,Trung sĩ,Thượng sĩ,Thiếu úy,Trung úy,Thượng úy,Đại úy,Thiếu tá,Trung tá,Thượng tá,Đại tá,Thiếu tướng,Trung tướng,Thượng tướng,Đại tướng';
    // Quá dài cho inline → dùng sheet ẩn
    const capBacSheet = workbook.addWorksheet('_CapBac', { state: 'veryHidden' });
    capBacOptions.split(',').forEach((cb, idx) => {
      capBacSheet.getCell(`A${idx + 1}`).value = cb;
    });
    const capBacCount = capBacOptions.split(',').length;
    for (let rowNum = 2; rowNum <= Math.max(personnelList.length + 1, 50); rowNum++) {
      worksheet.getRow(rowNum).getCell(4).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`_CapBac!$A$1:$A$${capBacCount}`],
      };
    }

    // Data validation for Danh hiệu column (col 7)
    const danhHieuColNumber = 7;
    worksheet.getColumn(danhHieuColNumber).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"CSTT,CSTDCS"'],
        };
      }
    });

    // Data validation cho cột số quyết định — dropdown từ DB
    if (decisionNumbers.length > 0) {
      const soQdKeys = ['so_quyet_dinh'];
      const decisionListStr = decisionNumbers.join(',');
      const maxRows = Math.max(personnelList.length + 1, 50);

      if (decisionListStr.length <= 250) {
        // Inline dropdown
        soQdKeys.forEach(key => {
          const colNumber = columns.findIndex(c => c.key === key) + 1;
          if (colNumber > 0) {
            for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
              worksheet.getRow(rowNum).getCell(colNumber).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`"${decisionListStr}"`],
              };
            }
          }
        });
      } else {
        // Quá nhiều → sheet ẩn làm source
        const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
        decisionNumbers.forEach((sqd, idx) => {
          refSheet.getCell(`A${idx + 1}`).value = sqd;
        });
        soQdKeys.forEach(key => {
          const colNumber = columns.findIndex(c => c.key === key) + 1;
          if (colNumber > 0) {
            for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
              worksheet.getRow(rowNum).getCell(colNumber).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`_QuyetDinh!$A$1:$A$${decisionNumbers.length}`],
              };
            }
          }
        });
      }
    }

    return workbook;
  }

  /**
   * Xuất danh sách khen thưởng ra Excel
   */
  async exportToExcel(filters = {}) {
    const { nam, danh_hieu, don_vi_id, personnel_ids } = filters;

    const where = {};
    if (nam) where.nam = nam;
    if (danh_hieu) where.danh_hieu = danh_hieu;
    if (personnel_ids?.length > 0) {
      where.quan_nhan_id = { in: personnel_ids };
    }

    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: 10000,
    });

    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        award =>
          award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
          award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh hiệu hằng năm');

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Họ và tên', key: 'ho_ten', width: 25 },
      { header: 'Cấp bậc', key: 'cap_bac', width: 15 },
      { header: 'Chức vụ', key: 'chuc_vu', width: 20 },
      { header: 'Năm', key: 'nam', width: 10 },
      { header: 'Danh hiệu', key: 'danh_hieu', width: 15 },
      { header: 'Số quyết định', key: 'so_quyet_dinh', width: 20 },
      { header: 'Ghi chú', key: 'ghi_chu', width: 25 },
      { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
      { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
      { header: 'CSTDTQ', key: 'nhan_cstdtq', width: 10 },
      { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
      { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
      { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    // Thêm dữ liệu
    filteredAwards.forEach((award, index) => {
      worksheet.addRow({
        stt: index + 1,
        id: award.QuanNhan?.id ?? '',
        ho_ten: award.QuanNhan?.ho_ten ?? '',
        cap_bac: award.cap_bac ?? '',
        chuc_vu: award.chuc_vu ?? '',
        nam: award.nam,
        danh_hieu: award.danh_hieu ?? '',
        so_quyet_dinh: award.so_quyet_dinh ?? '',
        ghi_chu: award.ghi_chu ?? '',
        nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
        so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp ?? '',
        nhan_cstdtq: award.nhan_cstdtq ? 'Có' : '',
        so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq ?? '',
        nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
        so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp ?? '',
      });
    });

    return workbook;
  }

  /**
   * Thống kê khen thưởng theo danh hiệu và năm
   */
  async getStatistics(filters = {}) {
    const { nam, don_vi_id } = filters;

    const where = {};
    if (nam) where.nam = nam;

    const awards = await prisma.danhHieuHangNam.findMany({
      where,
      include: {
        QuanNhan: {
          select: {
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });

    // Filter theo đơn vị nếu có
    let filteredAwards = awards;
    if (don_vi_id) {
      filteredAwards = awards.filter(
        award =>
          award.QuanNhan?.co_quan_don_vi_id === don_vi_id ||
          award.QuanNhan?.don_vi_truc_thuoc_id === don_vi_id
      );
    }

    // Thống kê theo danh hiệu
    const byDanhHieu = filteredAwards.reduce((acc, award) => {
      const key = award.danh_hieu;
      if (!acc[key]) {
        acc[key] = { danh_hieu: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    // Thống kê theo năm
    const byNam = filteredAwards.reduce((acc, award) => {
      const key = award.nam;
      if (!acc[key]) {
        acc[key] = { nam: key, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});

    return {
      total: filteredAwards.length,
      byDanhHieu: Object.values(byDanhHieu),
      byNam: Object.values(byNam).sort((a, b) => b.nam - a.nam),
    };
  }
}

module.exports = new AnnualRewardService();
