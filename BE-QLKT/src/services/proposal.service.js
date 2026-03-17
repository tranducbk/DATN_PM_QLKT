const { prisma } = require('../models');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');
const profileService = require('./profile.service');
const unitAnnualAwardService = require('./unitAnnualAward.service');
const { getDanhHieuName } = require('../constants/danhHieu.constants');

const { v4: uuidv4 } = require('uuid');
const { ROLES } = require('../constants/roles');

// Constants
const SHEET_NAMES = {
  QUAN_NHAN: 'QuanNhan',
  DANH_HIEU_HANG_NAM: 'DanhHieuHangNam',
  THANH_TICH_KHOA_HOC: 'ThanhTichKhoaHoc',
  NIEN_HAN: 'NienHan',
};

const CELL_INDICES = {
  CCCD: 1,
  HO_TEN: 2,
  NAM: 3,
  CSTDCS: 4,
  CSTT: 5,
  BKBQP: 6,
  SO_QUYET_DINH_BKBQP: 7,
  CSTDTQ: 8,
  SO_QUYET_DINH_CSTDTQ: 9,
  LOAI: 4,
  MO_TA: 5,
  STATUS: 6,
};

const VALID_LOAI_THANH_TICH = ['DTKH', 'SKKH'];
const VALID_STATUS = ['APPROVED', 'PENDING'];
const SAMPLE_ROW_KEYWORDS = ['ví dụ', 'example'];

class ProposalService {
  /**
   * Sanitize tên file để tránh lỗi filesystem
   * Loại bỏ ký tự đặc biệt, thay thế khoảng trắng, giới hạn độ dài
   * @param {string} filename - Tên file gốc
   * @returns {string} - Tên file đã được sanitize
   */
  sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'file';
    }

    // Lấy extension trước
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);

    // Loại bỏ ký tự không hợp lệ cho filesystem: / \ : * ? " < > |
    // Thay thế khoảng trắng và ký tự đặc biệt bằng underscore
    let sanitized = baseName
      .replace(/[/\\:*?"<>|]/g, '_') // Thay ký tự không hợp lệ bằng underscore
      .replace(/\s+/g, '_') // Thay khoảng trắng bằng underscore
      .replace(/_{2,}/g, '_') // Gộp nhiều underscore liên tiếp thành một
      .replace(/^_+|_+$/g, ''); // Loại bỏ underscore ở đầu và cuối

    // Nếu sau khi sanitize rỗng, dùng tên mặc định
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'file';
    }

    // Giới hạn độ dài (tối đa 200 ký tự cho base name)
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }

    // Trả về tên file đã sanitize + extension
    return sanitized + ext;
  }

  parseCCCD(value) {
    const { parseCCCD } = require('../helpers/cccdHelper');
    return parseCCCD(value);
  }

  /**
   * Parse cell value to string safely
   * @param {*} cell - Excel cell
   * @returns {string|null} - Trimmed string or null
   */
  parseCellToString(cell) {
    return cell?.value ? String(cell.value).trim() : null;
  }

  /**
   * Parse cell value to integer safely
   * @param {*} cell - Excel cell
   * @returns {number|null} - Parsed integer or null
   */
  parseCellToInt(cell) {
    const value = cell?.value ?? null;
    if (value === null || value === undefined) return null;
    const parsed = parseInt(value);
    return !isNaN(parsed) ? parsed : null;
  }

  /**
   * Check if cell value is checked (X)
   * @param {*} cell - Excel cell
   * @returns {boolean} - True if checked
   */
  isCellChecked(cell) {
    return cell?.value ? String(cell.value).toUpperCase().trim() === 'X' : false;
  }

  /**
   * Check if row is a sample row (contains example keywords)
   * @param {string} text - Text to check
   * @returns {boolean} - True if sample row
   */
  isSampleRow(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return SAMPLE_ROW_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Log sheet information for debugging
   * @param {Worksheet} sheet - Excel worksheet
   * @param {string} sheetName - Name of the sheet
   */
  logSheetInfo(sheet, sheetName) {
  }

  /**
   * Parse danh hiệu hàng năm từ Excel row
   * @param {Row} row - Excel row
   * @param {number} rowNumber - Row number
   * @returns {Object|null} - Parsed data or null if invalid
   */
  parseDanhHieuRow(row, rowNumber) {
    const cccdCell = row.getCell(CELL_INDICES.CCCD);
    const hoTenCell = row.getCell(CELL_INDICES.HO_TEN);
    const namCell = row.getCell(CELL_INDICES.NAM);

    const cccdValue = cccdCell?.value ?? null;
    const cccd = cccdValue !== null && cccdValue !== undefined ? this.parseCCCD(cccdValue) : null;
    const ho_ten = this.parseCellToString(hoTenCell);
    const nam = this.parseCellToInt(namCell);

    // Validate required fields
    if (!cccd || !nam || isNaN(nam)) {
      return null;
    }

    // Skip sample rows
    if (this.isSampleRow(ho_ten)) {
      return null;
    }

    // Parse checkboxes and decision numbers
    const cstdcs_checked = this.isCellChecked(row.getCell(CELL_INDICES.CSTDCS));
    const cstt_checked = this.isCellChecked(row.getCell(CELL_INDICES.CSTT));
    const bkbqp_checked = this.isCellChecked(row.getCell(CELL_INDICES.BKBQP));
    const so_quyet_dinh_bkbqp = this.parseCellToString(
      row.getCell(CELL_INDICES.SO_QUYET_DINH_BKBQP)
    );
    const cstdtq_checked = this.isCellChecked(row.getCell(CELL_INDICES.CSTDTQ));
    const so_quyet_dinh_cstdtq = this.parseCellToString(
      row.getCell(CELL_INDICES.SO_QUYET_DINH_CSTDTQ)
    );
    const bkttcp_checked = this.isCellChecked(row.getCell(CELL_INDICES.BKTTCP));
    const so_quyet_dinh_bkttcp = this.parseCellToString(
      row.getCell(CELL_INDICES.SO_QUYET_DINH_BKTTCP)
    );
    // Determine main danh hieu
    let danh_hieu = null;
    if (cstdcs_checked) danh_hieu = 'CSTDCS';
    else if (cstt_checked) danh_hieu = 'CSTT';

    return {
      cccd,
      ho_ten: ho_ten || '',
      nam,
      danh_hieu,
      nhan_bkbqp: bkbqp_checked,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq: cstdtq_checked,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp: bkttcp_checked,
      so_quyet_dinh_bkttcp,
    };
  }

  /**
   * Parse thành tích khoa học từ Excel row
   * @param {Row} row - Excel row
   * @param {number} rowNumber - Row number
   * @returns {Object|null} - Parsed data or null if invalid
   */
  parseThanhTichRow(row, rowNumber) {
    const cccdCell = row.getCell(CELL_INDICES.CCCD);
    const hoTenCell = row.getCell(CELL_INDICES.HO_TEN);
    const namCell = row.getCell(CELL_INDICES.NAM);
    const loaiCell = row.getCell(CELL_INDICES.LOAI);
    const moTaCell = row.getCell(CELL_INDICES.MO_TA);
    const statusCell = row.getCell(CELL_INDICES.STATUS);

    const cccdValue = cccdCell?.value ?? null;
    const cccd = cccdValue !== null && cccdValue !== undefined ? this.parseCCCD(cccdValue) : null;
    const ho_ten = this.parseCellToString(hoTenCell);
    const nam = this.parseCellToInt(namCell);
    const loai = this.parseCellToString(loaiCell);
    const mo_ta = this.parseCellToString(moTaCell);
    const status = this.parseCellToString(statusCell) || 'PENDING';

    // Validate required fields
    if (!cccd || !nam || isNaN(nam) || !loai || !mo_ta) {
      return null;
    }

    // Skip sample rows
    if (this.isSampleRow(mo_ta)) {
      return null;
    }

    // Validate loại
    if (!VALID_LOAI_THANH_TICH.includes(loai)) {
      throw new Error(
        `Loại thành tích không hợp lệ: ${loai} (chỉ chấp nhận ${VALID_LOAI_THANH_TICH.join(
          ' hoặc '
        )})`
      );
    }

    // Validate status
    if (!VALID_STATUS.includes(status)) {
      throw new Error(
        `Trạng thái không hợp lệ: ${status} (chỉ chấp nhận ${VALID_STATUS.join(' hoặc ')})`
      );
    }

    return {
      cccd,
      ho_ten: ho_ten || '',
      nam,
      loai,
      mo_ta,
      status,
    };
  }

  /**
   * Parse danh hiệu hàng năm từ Excel sheet
   * @param {Worksheet} sheet - Excel worksheet
   * @returns {Array} - Array of parsed danh hiệu data
   */
  parseDanhHieuSheet(sheet) {
    this.logSheetInfo(sheet, SHEET_NAMES.DANH_HIEU_HANG_NAM);

    const danhHieuData = [];
    let rowCount = 0;
    let skippedCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 1) return; // Skip header

      rowCount++;
      const parsed = this.parseDanhHieuRow(row, rowNumber);

      if (parsed) {
        danhHieuData.push(parsed);
      } else {
        skippedCount++;
      }
    });

    return danhHieuData;
  }

  /**
   * Parse thành tích khoa học từ Excel sheet
   * @param {Worksheet} sheet - Excel worksheet
   * @returns {Array} - Array of parsed thành tích data
   */
  parseThanhTichSheet(sheet) {
    this.logSheetInfo(sheet, SHEET_NAMES.THANH_TICH_KHOA_HOC);

    const thanhTichData = [];
    let rowCount = 0;
    let skippedCount = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 1) return; // Skip header

      rowCount++;
      const parsed = this.parseThanhTichRow(row, rowNumber);

      if (parsed) {
        thanhTichData.push(parsed);
      } else {
        skippedCount++;
      }
    });

    return thanhTichData;
  }

  /**
   * Tính số năm CSTDCS liên tục TRƯỚC năm đang xét
   * Lưu ý: Khi xét khen thưởng năm N, chỉ tính các năm CSTDCS từ (N-1) trở về trước
   * Ví dụ: Xét BKBQP năm 2024 cần 5 năm CSTDCS liên tục từ 2019-2023
   *
   * @param {Array} danhHieuList - Danh sách danh hiệu đã có
   * @param {number} currentYear - Năm đang xét khen thưởng
   * @returns {number} Số năm CSTDCS liên tục TRƯỚC năm đang xét
   */
  calculateContinuousCSTDCS(danhHieuList, currentYear) {
    if (!danhHieuList || danhHieuList.length === 0) {
      return 0;
    }

    // Sắp xếp theo năm giảm dần
    const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);

    let count = 0;
    // BẮT ĐẦU từ năm TRƯỚC năm đang xét, không bao gồm năm đang xét
    let expectedYear = (currentYear || new Date().getFullYear()) - 1;

    // Đếm ngược từ năm trước năm hiện tại
    for (const reward of sortedRewards) {
      // Nếu năm này là CSTDCS và đúng năm mong đợi
      if (reward.danh_hieu === 'CSTDCS' && reward.nam === expectedYear) {
        count++;
        expectedYear--; // Tiếp tục kiểm tra năm trước đó
      } else if (reward.nam < expectedYear) {
        // Nếu bỏ qua năm nào đó thì dừng (chuỗi bị gián đoạn)
        break;
      }
    }

    return count;
  }
  /**
   * Lấy thông tin user với đơn vị (helper method)
   * @param {number} userId - ID của tài khoản
   * @returns {Promise<Object>} - User object với QuanNhan
   */
  async getUserWithUnit(userId) {
    return await prisma.taiKhoan.findUnique({
      where: { id: userId },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Xuất file mẫu Excel cho Manager
   * @param {number} userId - ID của tài khoản Manager
   * @param {string} type - Loại đề xuất: 'HANG_NAM' hoặc 'NIEN_HAN'
   * @returns {Promise<Buffer>} - Buffer của file Excel
   */
  async exportTemplate(userId, type = 'HANG_NAM') {
    try {
      // Lấy thông tin user và đơn vị
      const user = await prisma.taiKhoan.findUnique({
        where: { id: userId },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.QuanNhan) {
        throw new Error('Không tìm thấy thông tin quân nhân của tài khoản này');
      }

      const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;

      // Lấy danh sách quân nhân thuộc đơn vị
      const quanNhanList = await prisma.quanNhan.findMany({
        where: {
          OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          ChucVu: true,
        },
        orderBy: { ho_ten: 'asc' },
      });

      // Tạo workbook mới
      const workbook = new ExcelJS.Workbook();

      if (type === 'NIEN_HAN' || type === 'HC_QKQT' || type === 'KNC_VSNXD_QDNDVN') {
        return await this.exportTemplateNienHan(workbook, quanNhanList);
      }

      // ============================================
      // TEMPLATE CHO ĐỀ XUẤT HẰNG NĂM
      // ============================================

      // ============================================
      // TAB 1: QuanNhan (Danh sách tham khảo)
      // ============================================
      const sheetQuanNhan = workbook.addWorksheet('QuanNhan');

      // Header row với style
      sheetQuanNhan.columns = [
        { header: 'CCCD', key: 'cccd', width: 15 },
        { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
        { header: 'Mã Đơn Vị', key: 'ma_don_vi', width: 15 },
        { header: 'Tên Chức Vụ', key: 'ten_chuc_vu', width: 25 },
      ];

      // Style cho header
      sheetQuanNhan.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      sheetQuanNhan.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      sheetQuanNhan.getRow(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      // Format cột CCCD thành Text (để giữ số 0 đầu tiên)
      sheetQuanNhan.getColumn(1).numFmt = '@';

      // Thêm dữ liệu quân nhân
      quanNhanList.forEach(qn => {
        sheetQuanNhan.addRow({
          cccd: qn.cccd,
          ho_ten: qn.ho_ten,
          ma_don_vi: (qn.DonViTrucThuoc || qn.CoQuanDonVi)?.ma_don_vi || '',
          ten_chuc_vu: qn.ChucVu.ten_chuc_vu,
        });
      });

      // ============================================
      // TAB 2: DanhHieuHangNam (Đề xuất danh hiệu)
      // ============================================
      const sheetDanhHieu = workbook.addWorksheet('DanhHieuHangNam');

      sheetDanhHieu.columns = [
        { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
        { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
        { header: 'Năm (Bắt buộc)', key: 'nam', width: 12 },
        { header: 'CSTDCS (Đánh X)', key: 'cstdcs', width: 18 },
        { header: 'CSTT (Đánh X)', key: 'cstt', width: 15 },
        { header: 'BKBQP (Đánh X)', key: 'bkbqp', width: 18 },
        { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
        { header: 'CSTDTQ (Đánh X)', key: 'cstdtq', width: 18 },
        { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
      ];

      // Style cho header
      sheetDanhHieu.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      sheetDanhHieu.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' },
      };
      sheetDanhHieu.getRow(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      // Format cột CCCD thành Text (để giữ số 0 đầu tiên)
      sheetDanhHieu.getColumn(1).numFmt = '@';

      // Thêm 1 hàng mẫu
      sheetDanhHieu.addRow({
        cccd: 'Ví dụ: 001234567890',
        ho_ten: 'Nguyễn Văn A',
        nam: 2024,
        cstdcs: 'X',
        cstt: '',
        bkbqp: 'X',
        so_quyet_dinh_bkbqp: '123/QĐ-BQP',
        cstdtq: '',
        so_quyet_dinh_cstdtq: '',
      });

      // ============================================
      // TAB 3: ThanhTichKhoaHoc (Đề xuất thành tích)
      // ============================================
      const sheetThanhTich = workbook.addWorksheet('ThanhTichKhoaHoc');

      sheetThanhTich.columns = [
        { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
        { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
        { header: 'Năm (Bắt buộc)', key: 'nam', width: 12 },
        { header: 'Loại (ĐTKH/SKKH)', key: 'loai', width: 18 },
        { header: 'Mô tả (Bắt buộc)', key: 'mo_ta', width: 40 },
        { header: 'Trạng thái (APPROVED/PENDING)', key: 'status', width: 25 },
      ];

      // Style cho header
      sheetThanhTich.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      sheetThanhTich.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC000' },
      };
      sheetThanhTich.getRow(1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      // Format cột CCCD thành Text (để giữ số 0 đầu tiên)
      sheetThanhTich.getColumn(1).numFmt = '@';

      // Thêm 1 hàng mẫu
      sheetThanhTich.addRow({
        cccd: 'Ví dụ: 001234567890',
        ho_ten: 'Nguyễn Văn A',
        nam: 2024,
        loai: 'NCKH',
        mo_ta: 'Nghiên cứu về trí tuệ nhân tạo trong quân sự',
        status: 'APPROVED',
      });

      // Thêm data validation cho cột Loại (D) - từ row 2 trở đi
      sheetThanhTich.getColumn(4).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber > 1) {
          // Skip header
          cell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"NCKH,SKKH"'],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Giá trị không hợp lệ',
            error: 'Vui lòng chọn NCKH hoặc SKKH',
          };
        }
      });

      // Thêm data validation cho cột Trạng thái (F) - từ row 2 trở đi
      sheetThanhTich.getColumn(6).eachCell({ includeEmpty: true }, (cell, rowNumber) => {
        if (rowNumber > 1) {
          // Skip header
          cell.dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['"APPROVED,PENDING"'],
            showErrorMessage: true,
            errorStyle: 'error',
            errorTitle: 'Giá trị không hợp lệ',
            error: 'Vui lòng chọn APPROVED hoặc PENDING',
          };
        }
      });

      // Xuất file ra buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error('Export template error:', error);
      throw error;
    }
  }

  /**
   * Xuất file mẫu Excel cho Đề xuất Niên hạn
   * @param {ExcelJS.Workbook} workbook - Workbook
   * @param {Array} quanNhanList - Danh sách quân nhân
   * @returns {Promise<Buffer>} - Buffer của file Excel
   */
  async exportTemplateNienHan(workbook, quanNhanList) {
    // ============================================
    // TAB 1: QuanNhan (Danh sách tham khảo)
    // ============================================
    const sheetQuanNhan = workbook.addWorksheet('QuanNhan');

    sheetQuanNhan.columns = [
      { header: 'CCCD', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'Ngày nhập ngũ', key: 'ngay_nhap_ngu', width: 15 },
      { header: 'Mã Đơn Vị', key: 'ma_don_vi', width: 15 },
      { header: 'Tên Chức Vụ', key: 'ten_chuc_vu', width: 25 },
    ];

    sheetQuanNhan.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheetQuanNhan.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    sheetQuanNhan.getRow(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheetQuanNhan.getColumn(1).numFmt = '@';

    quanNhanList.forEach(qn => {
      sheetQuanNhan.addRow({
        cccd: qn.cccd,
        ho_ten: qn.ho_ten,
        ngay_nhap_ngu: qn.ngay_nhap_ngu
          ? new Date(qn.ngay_nhap_ngu).toLocaleDateString('vi-VN')
          : '',
        ma_don_vi: qn.DonVi.ma_don_vi,
        ten_chuc_vu: qn.ChucVu.ten_chuc_vu,
      });
    });

    // ============================================
    // TAB 2: NienHan (Đề xuất khen thưởng niên hạn)
    // ============================================
    const sheetNienHan = workbook.addWorksheet('NienHan');

    sheetNienHan.columns = [
      { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
      { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
      { header: 'HCCSVV Hạng Ba (X)', key: 'hccsvv_hang_ba', width: 20 },
      { header: 'HCCSVV Hạng Nhì (X)', key: 'hccsvv_hang_nhi', width: 20 },
      { header: 'HCCSVV Hạng Nhất (X)', key: 'hccsvv_hang_nhat', width: 20 },
      { header: 'HCBVTQ Hạng Ba (X)', key: 'hcbvtq_hang_ba', width: 20 },
      { header: 'HCBVTQ Hạng Nhì (X)', key: 'hcbvtq_hang_nhi', width: 20 },
      { header: 'HCBVTQ Hạng Nhất (X)', key: 'hcbvtq_hang_nhat', width: 20 },
    ];

    sheetNienHan.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheetNienHan.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFED7D31' },
    };
    sheetNienHan.getRow(1).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    sheetNienHan.getColumn(1).numFmt = '@';

    // Thêm 1 hàng mẫu
    sheetNienHan.addRow({
      cccd: 'Ví dụ: 001234567890',
      ho_ten: 'Nguyễn Văn A',
      hccsvv_hang_ba: 'X',
      hccsvv_hang_nhi: '',
      hccsvv_hang_nhat: '',
      hcbvtq_hang_ba: '',
      hcbvtq_hang_nhi: '',
      hcbvtq_hang_nhat: '',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  /**
   * Lưu đề xuất khen thưởng với nhiều file đính kèm
   * @param {Array} titleData - Dữ liệu danh hiệu/thành tích từ frontend
   * @param {Array} attachedFiles - Array các file đính kèm (multer file objects)
   * @param {string} soQuyetDinh - Số quyết định gốc
   * @param {string} userId - ID của tài khoản Manager
   * @param {string} type - Loại đề xuất
   * @param {number} nam - Năm đề xuất
   * @returns {Promise<Object>} - Kết quả lưu đề xuất
   */
  async submitProposal(
    titleData,
    attachedFiles,
    soQuyetDinh,
    userId,
    type = 'CA_NHAN_HANG_NAM',
    nam,
    ghiChu = null
  ) {
    try {
      // Lấy thông tin user và đơn vị
      const user = await prisma.taiKhoan.findUnique({
        where: { id: userId },
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.QuanNhan) {
        throw new Error('Không tìm thấy thông tin quân nhân của tài khoản này');
      }

      const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;

      // ============================================
      // LƯU NHIỀU FILE ĐÍNH KÈM VÀO SERVER
      // ============================================
      const filesInfo = [];

      if (attachedFiles && attachedFiles.length > 0) {
        // Đảm bảo uuid đã được load (nếu chưa thì load ngay)
        if (!uuidv4) {
          const uuidModule = await import('uuid');
          uuidv4 = uuidModule.v4;
        }

        // Đường dẫn lưu file
        const storagePath = path.join(__dirname, '../../storage/proposals');
        await fs.mkdir(storagePath, { recursive: true });

        // Loop qua từng file và lưu
        for (const file of attachedFiles) {
          if (file && file.buffer) {
            // Xử lý tên file gốc (có thể có ký tự đặc biệt, Unicode)
            let originalName = file.originalname || 'file';
            // Xử lý encoding nếu cần (từ latin1 sang utf8)
            try {
              if (Buffer.isBuffer(originalName)) {
                originalName = originalName.toString('utf8');
              } else if (typeof originalName === 'string') {
                // Đảm bảo string là UTF-8
                originalName = Buffer.from(originalName, 'latin1').toString('utf8');
              }
            } catch (e) {
              // Nếu lỗi encoding, dùng tên mặc định
              originalName = 'file';
            }

            // Sanitize tên file gốc để tránh lỗi
            const sanitizedOriginalName = this.sanitizeFilename(originalName);

            // Tạo tên file unique: timestamp_uuid_sanitizedname
            const timestamp = Date.now();
            const uniqueId = uuidv4().slice(0, 8);
            const fileExtension = path.extname(sanitizedOriginalName);
            const baseFilename = path.basename(sanitizedOriginalName, fileExtension);
            const savedFilename = `${timestamp}_${uniqueId}_${baseFilename}${fileExtension}`;

            // Lưu file
            const filePath = path.join(storagePath, savedFilename);
            await fs.writeFile(filePath, file.buffer);

            // Thêm thông tin file vào array
            // Lưu originalName gốc (có thể có Unicode) để hiển thị cho user
            filesInfo.push({
              filename: savedFilename,
              originalName: originalName, // Tên file gốc (có thể có Unicode)
              size: file.size,
              uploadedAt: new Date().toISOString(),
            });
          }
        }
      }

      // ============================================
      // XỬ LÝ DỮ LIỆU TỪ FRONTEND
      // ============================================
      if (!titleData || !Array.isArray(titleData)) {
        throw new Error('Dữ liệu đề xuất không hợp lệ');
      }

      // Fetch thông tin quân nhân để lấy họ tên, đơn vị (chỉ cho đề xuất cá nhân)
      // Với DON_VI_HANG_NAM, titleData sẽ có don_vi_id thay vì personnel_id
      let personnelList = [];
      if (type !== 'DON_VI_HANG_NAM') {
        const personnelIds = titleData
          .map(item => item.personnel_id)
          .filter(id => id !== undefined && id !== null); // Filter out undefined/null

        if (personnelIds.length > 0) {
          // Đối với NIEN_HAN, HC_QKQT, KNC_VSNXD_QDNDVN cần thêm ngay_nhap_ngu và ngay_xuat_ngu để tính thoi_gian
          const needsTimeData = ['NIEN_HAN', 'HC_QKQT', 'KNC_VSNXD_QDNDVN'].includes(type);

          personnelList = await prisma.quanNhan.findMany({
            where: {
              id: {
                in: personnelIds,
              },
            },
            select: {
              id: true,
              ho_ten: true,
              cap_bac: true,
              co_quan_don_vi_id: true,
              don_vi_truc_thuoc_id: true,
              ...(needsTimeData && {
                ngay_nhap_ngu: true,
                ngay_xuat_ngu: true,
              }),
              CoQuanDonVi: {
                select: {
                  id: true,
                  ten_don_vi: true,
                  ma_don_vi: true,
                },
              },
              DonViTrucThuoc: {
                select: {
                  id: true,
                  ten_don_vi: true,
                  ma_don_vi: true,
                  co_quan_don_vi_id: true,
                  CoQuanDonVi: {
                    select: {
                      id: true,
                      ten_don_vi: true,
                      ma_don_vi: true,
                    },
                  },
                },
              },
              ChucVu: {
                select: {
                  id: true,
                  ten_chuc_vu: true,
                },
              },
            },
          });
        }
      }

      // Tạo map để lookup nhanh và đảm bảo load đầy đủ thông tin đơn vị
      const personnelMap = {};
      const missingDonViIds = new Set();

      personnelList.forEach(p => {
        // Nếu có don_vi_truc_thuoc_id nhưng DonViTrucThuoc chưa được load, cần fetch lại
        if (p.don_vi_truc_thuoc_id && !p.DonViTrucThuoc) {
          missingDonViIds.add(p.don_vi_truc_thuoc_id);
        }
        personnelMap[p.id] = p;
      });

      // Fetch lại các đơn vị trực thuộc bị thiếu
      if (missingDonViIds.size > 0) {
        const missingDonVis = await prisma.donViTrucThuoc.findMany({
          where: {
            id: {
              in: Array.from(missingDonViIds),
            },
          },
          include: {
            CoQuanDonVi: {
              select: {
                id: true,
                ten_don_vi: true,
                ma_don_vi: true,
              },
            },
          },
        });

        const donViMap = {};
        missingDonVis.forEach(dv => {
          donViMap[dv.id] = dv;
        });

        // Cập nhật lại personnelMap với thông tin đơn vị đã fetch
        Object.keys(personnelMap).forEach(personnelId => {
          const personnel = personnelMap[personnelId];
          if (personnel.don_vi_truc_thuoc_id && !personnel.DonViTrucThuoc) {
            personnel.DonViTrucThuoc = donViMap[personnel.don_vi_truc_thuoc_id] || null;
          }
        });
      }

      // Format titleData theo type và enrich với thông tin quân nhân/đơn vị
      let dataDanhHieu = null;
      let dataThanhTich = null;
      let dataNienHan = null;
      let dataCongHien = null;

      if (type === 'NCKH') {
        // NCKH: titleData = [{ personnel_id, loai: 'NCKH'|'SKKH', mo_ta, cap_bac, chuc_vu }]
        // Không lưu cccd, thêm thông tin đơn vị
        // Lấy cap_bac và chuc_vu từ titleData (đã được sửa ở bước 3)
        // KHÔNG fallback về personnel (giống khen thưởng đột xuất)
        dataThanhTich = titleData.map(item => {
          const personnel = personnelMap[item.personnel_id];
          return {
            personnel_id: item.personnel_id,
            ho_ten: personnel?.ho_ten || '',
            nam: nam,
            loai: item.loai,
            mo_ta: item.mo_ta,
            status: item.status || 'PENDING',
            so_quyet_dinh: item.so_quyet_dinh || null,
            file_quyet_dinh: item.file_quyet_dinh || null,
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            co_quan_don_vi: personnel?.CoQuanDonVi
              ? {
                  id: personnel.CoQuanDonVi.id,
                  ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                  ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
                }
              : null,
            don_vi_truc_thuoc: personnel?.DonViTrucThuoc
              ? {
                  id: personnel.DonViTrucThuoc.id,
                  ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                  ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                  co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                    ? {
                        id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                        ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                        ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                      }
                    : null,
                }
              : null,
          };
        });
      } else if (type === 'DON_VI_HANG_NAM') {
        // DON_VI_HANG_NAM: titleData = [{ don_vi_id, don_vi_type, danh_hieu }]
        // don_vi_type: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC'
        // danh_hieu: 'ĐVQT' | 'ĐVTT' | 'BKBQP' | 'BKTTCP'
        dataDanhHieu = await Promise.all(
          titleData.map(async item => {
            let donViInfo = null;
            let coQuanDonViCha = null;

            if (item.don_vi_type === 'CO_QUAN_DON_VI') {
              const donVi = await prisma.coQuanDonVi.findUnique({
                where: { id: item.don_vi_id },
                select: {
                  id: true,
                  ten_don_vi: true,
                  ma_don_vi: true,
                },
              });
              donViInfo = donVi;
            } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC') {
              const donVi = await prisma.donViTrucThuoc.findUnique({
                where: { id: item.don_vi_id },
                include: {
                  CoQuanDonVi: {
                    select: {
                      id: true,
                      ten_don_vi: true,
                      ma_don_vi: true,
                    },
                  },
                },
              });
              donViInfo = {
                id: donVi.id,
                ten_don_vi: donVi.ten_don_vi,
                ma_don_vi: donVi.ma_don_vi,
              };
              coQuanDonViCha = donVi.CoQuanDonVi;
            }

            return {
              don_vi_id: item.don_vi_id,
              don_vi_type: item.don_vi_type,
              ten_don_vi: donViInfo?.ten_don_vi || '',
              ma_don_vi: donViInfo?.ma_don_vi || '',
              nam: nam,
              danh_hieu: item.danh_hieu,
              co_quan_don_vi_cha: coQuanDonViCha,
              so_quyet_dinh: item.so_quyet_dinh || null,
              file_quyet_dinh: item.file_quyet_dinh || null,
              nhan_bkbqp: item.danh_hieu === 'BKBQP' ? true : false,
              nhan_bkttcp: item.danh_hieu === 'BKTTCP' ? true : false,
            };
          })
        );
      } else if (type === 'CA_NHAN_HANG_NAM') {
        // Standard: titleData = [{ personnel_id, danh_hieu }]
        // Không lưu cccd, thêm thông tin đơn vị
        // Luôn lưu cả co_quan_don_vi và don_vi_truc_thuoc nếu quân nhân có dữ liệu
        dataDanhHieu = titleData.map(item => {
          const personnel = personnelMap[item.personnel_id];

          // Xác định đơn vị của quân nhân
          const personnelCoQuanDonVi = personnel?.CoQuanDonVi;
          const personnelDonViTrucThuoc = personnel?.DonViTrucThuoc;

          // Luôn lưu cả hai nếu có dữ liệu
          let coQuanDonVi = null;
          let donViTrucThuoc = null;

          if (personnelCoQuanDonVi) {
            coQuanDonVi = {
              id: personnelCoQuanDonVi.id,
              ten_co_quan_don_vi: personnelCoQuanDonVi.ten_don_vi,
              ma_co_quan_don_vi: personnelCoQuanDonVi.ma_don_vi,
            };
          }

          // Kiểm tra cả don_vi_truc_thuoc_id và DonViTrucThuoc để đảm bảo lưu đúng
          // Nếu có don_vi_truc_thuoc_id, phải có DonViTrucThuoc (đã được fetch ở trên nếu thiếu)
          if (personnel?.don_vi_truc_thuoc_id && personnelDonViTrucThuoc) {
            donViTrucThuoc = {
              id: personnelDonViTrucThuoc.id,
              ten_don_vi: personnelDonViTrucThuoc.ten_don_vi,
              ma_don_vi: personnelDonViTrucThuoc.ma_don_vi,
              co_quan_don_vi: personnelDonViTrucThuoc.CoQuanDonVi
                ? {
                    id: personnelDonViTrucThuoc.CoQuanDonVi.id,
                    ten_don_vi_truc: personnelDonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                    ma_don_vi: personnelDonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                  }
                : null,
            };
          }

          return {
            personnel_id: item.personnel_id,
            ho_ten: personnel?.ho_ten || '',
            nam: nam,
            danh_hieu: item.danh_hieu,
            // Lấy cap_bac và chuc_vu từ titleData (đã được sửa ở bước 3)
            // KHÔNG fallback về personnel (giống khen thưởng đột xuất)
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            co_quan_don_vi: coQuanDonVi,
            don_vi_truc_thuoc: donViTrucThuoc,
            nhan_bkbqp: item.danh_hieu === 'BKBQP' ? true : false,
            nhan_cstdtq: item.danh_hieu === 'CSTDTQ' ? true : false,
            nhan_bkttcp: item.danh_hieu === 'BKTTCP' ? true : false,
          };
        });
      } else if (type === 'NIEN_HAN' || type === 'HC_QKQT' || type === 'KNC_VSNXD_QDNDVN') {
        // NIEN_HAN, HC_QKQT, KNC_VSNXD_QDNDVN: titleData = [{ personnel_id, danh_hieu }]
        // Không lưu cccd, thêm thông tin đơn vị và tính toán thời gian
        dataNienHan = titleData.map(item => {
          const personnel = personnelMap[item.personnel_id];

          // Tính thời gian từ ngày nhập ngũ
          let thoiGian = null;
          if (personnel?.ngay_nhap_ngu) {
            const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
            const ngayKetThuc = personnel.ngay_xuat_ngu
              ? new Date(personnel.ngay_xuat_ngu)
              : new Date();

            let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
            months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
            if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
              months--;
            }
            months = Math.max(0, months);

            const years = Math.floor(months / 12);
            const remainingMonths = months % 12;
            thoiGian = {
              total_months: months,
              years: years,
              months: remainingMonths,
              display:
                months === 0
                  ? '-'
                  : years > 0 && remainingMonths > 0
                    ? `${years} năm ${remainingMonths} tháng`
                    : years > 0
                      ? `${years} năm`
                      : `${remainingMonths} tháng`,
            };
          }

          return {
            personnel_id: item.personnel_id,
            ho_ten: personnel?.ho_ten || '',
            nam: nam,
            danh_hieu: item.danh_hieu,
            so_quyet_dinh: item.so_quyet_dinh || null,
            file_quyet_dinh: item.file_quyet_dinh || null,
            thoi_gian: thoiGian, // Lưu mốc thời gian vào JSON
            // Lấy cap_bac và chuc_vu từ titleData (đã được sửa ở bước 3)
            // KHÔNG fallback về personnel (giống khen thưởng đột xuất)
            cap_bac: item.cap_bac || null,
            chuc_vu: item.chuc_vu || null,
            co_quan_don_vi: personnel?.CoQuanDonVi
              ? {
                  id: personnel.CoQuanDonVi.id,
                  ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                  ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
                }
              : null,
            don_vi_truc_thuoc: personnel?.DonViTrucThuoc
              ? {
                  id: personnel.DonViTrucThuoc.id,
                  ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                  ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                  co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                    ? {
                        id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                        ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                        ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                      }
                    : null,
                }
              : null,
          };
        });
      } else if (type === 'CONG_HIEN') {
        // CONG_HIEN: titleData = [{ personnel_id, danh_hieu }]
        // Lưu vào data_cong_hien thay vì data_danh_hieu
        dataCongHien = await Promise.all(
          titleData.map(async item => {
            const personnel = personnelMap[item.personnel_id];
            const baseData = {
              personnel_id: item.personnel_id,
              ho_ten: personnel?.ho_ten || '',
              nam: nam,
              danh_hieu: item.danh_hieu,
              // Lấy cap_bac và chuc_vu từ titleData (đã được sửa ở bước 3)
              // KHÔNG fallback về personnel (giống khen thưởng đột xuất)
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
              co_quan_don_vi: personnel?.CoQuanDonVi
                ? {
                    id: personnel.CoQuanDonVi.id,
                    ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                    ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
                  }
                : null,
              don_vi_truc_thuoc: personnel?.DonViTrucThuoc
                ? {
                    id: personnel.DonViTrucThuoc.id,
                    ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                    ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                    co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                      ? {
                          id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                          ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                          ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                        }
                      : null,
                  }
                : null,
            };

            // Nếu là CONG_HIEN, thêm thông tin thời gian 3 nhóm
            if (type === 'CONG_HIEN' && item.personnel_id) {
              try {
                const histories = await prisma.lichSuChucVu.findMany({
                  where: { quan_nhan_id: item.personnel_id },
                  select: {
                    he_so_chuc_vu: true,
                    so_thang: true,
                    ngay_bat_dau: true,
                    ngay_ket_thuc: true,
                  },
                });

                // Tính số tháng cho chức vụ hiện tại (chưa có ngày kết thúc)
                const today = new Date();
                const updatedHistories = histories.map(history => {
                  if (history.so_thang === null || history.so_thang === undefined) {
                    if (history.ngay_bat_dau && !history.ngay_ket_thuc) {
                      const ngayBatDau = new Date(history.ngay_bat_dau);
                      let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
                      months += today.getMonth() - ngayBatDau.getMonth();
                      if (today.getDate() < ngayBatDau.getDate()) {
                        months--;
                      }
                      return {
                        ...history,
                        so_thang: Math.max(0, months),
                      };
                    }
                  }
                  return history;
                });

                // Hàm tính tổng tháng theo nhóm hệ số
                const getTotalMonthsByGroup = group => {
                  let totalMonths = 0;
                  updatedHistories.forEach(history => {
                    const heSo = Number(history.he_so_chuc_vu) || 0;
                    let belongsToGroup = false;

                    if (group === '0.7') {
                      belongsToGroup = heSo >= 0.7 && heSo < 0.8;
                    } else if (group === '0.8') {
                      belongsToGroup = heSo >= 0.8 && heSo < 0.9;
                    } else if (group === '0.9-1.0') {
                      belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
                    }

                    if (
                      belongsToGroup &&
                      history.so_thang !== null &&
                      history.so_thang !== undefined
                    ) {
                      totalMonths += Number(history.so_thang);
                    }
                  });
                  return totalMonths;
                };

                // Tính thời gian cho 3 nhóm
                const months0_7 = getTotalMonthsByGroup('0.7');
                const months0_8 = getTotalMonthsByGroup('0.8');
                const months0_9_1_0 = getTotalMonthsByGroup('0.9-1.0');

                // Format thời gian (năm và tháng)
                const formatTime = totalMonths => {
                  const years = Math.floor(totalMonths / 12);
                  const remainingMonths = totalMonths % 12;
                  return {
                    total_months: totalMonths,
                    years: years,
                    months: remainingMonths,
                    display:
                      totalMonths === 0
                        ? '-'
                        : years > 0 && remainingMonths > 0
                          ? `${years} năm ${remainingMonths} tháng`
                          : years > 0
                            ? `${years} năm`
                            : `${remainingMonths} tháng`,
                  };
                };

                return {
                  ...baseData,
                  thoi_gian_nhom_0_7: formatTime(months0_7),
                  thoi_gian_nhom_0_8: formatTime(months0_8),
                  thoi_gian_nhom_0_9_1_0: formatTime(months0_9_1_0),
                };
              } catch (error) {
                // Nếu có lỗi khi fetch lịch sử, vẫn trả về dữ liệu cơ bản
                console.error(
                  `Lỗi khi fetch lịch sử chức vụ cho personnel_id ${item.personnel_id}:`,
                  error
                );
                return baseData;
              }
            }

            return baseData;
          })
        );
      }

      // ============================================
      // VALIDATION: Đảm bảo không mix CSTDCS/CSTT với BKBQP/CSTDTQ
      // BKBQP và CSTDTQ có thể đề xuất cùng nhau
      // ============================================
      if (type === 'CA_NHAN_HANG_NAM' && dataDanhHieu && dataDanhHieu.length > 0) {
        // Kiểm tra xem có CSTDCS/CSTT không
        const hasChinh = dataDanhHieu.some(
          item => item.danh_hieu === 'CSTDCS' || item.danh_hieu === 'CSTT'
        );
        const hasBKBQP = dataDanhHieu.some(item => item.danh_hieu === 'BKBQP');
        const hasCSTDTQ = dataDanhHieu.some(item => item.danh_hieu === 'CSTDTQ');

        // Không cho phép mix CSTDCS/CSTT với BKBQP/CSTDTQ
        // BKBQP và CSTDTQ có thể đề xuất cùng nhau
        if (hasChinh && (hasBKBQP || hasCSTDTQ)) {
          throw new Error(
            'Không thể đề xuất CSTDCS/CSTT cùng với BKBQP/CSTDTQ trong một đề xuất. ' +
              'Vui lòng tách thành các đề xuất riêng: một đề xuất cho CSTDCS/CSTT, và một đề xuất riêng cho BKBQP/CSTDTQ.'
          );
        }
      }

      // ============================================
      // VALIDATION cho NIEN_HAN: Chỉ cho phép các hạng HCCSVV
      // ============================================
      if (type === 'NIEN_HAN' && dataNienHan && dataNienHan.length > 0) {
        const danhHieus = dataNienHan.map(item => item.danh_hieu).filter(Boolean);

        // Chỉ cho phép các hạng HCCSVV
        const allowedDanhHieus = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
        const invalidDanhHieus = danhHieus.filter(dh => !allowedDanhHieus.includes(dh));

        if (invalidDanhHieus.length > 0) {
          throw new Error(
            `Loại đề xuất "Huy chương Chiến sĩ vẻ vang" chỉ cho phép các hạng HCCSVV. ` +
              `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}. ` +
              `Vui lòng sử dụng loại đề xuất riêng cho HC_QKQT hoặc KNC_VSNXD_QDNDVN.`
          );
        }
      }

      // ============================================
      // VALIDATION cho HC_QKQT: Chỉ cho phép danh hiệu HC_QKQT
      // Và kiểm tra điều kiện: >= 25 năm từ ngày nhập ngũ (không phân biệt nam nữ)
      // ============================================
      if (type === 'HC_QKQT' && dataNienHan && dataNienHan.length > 0) {
        const danhHieus = dataNienHan.map(item => item.danh_hieu).filter(Boolean);

        // Chỉ cho phép HC_QKQT
        const invalidDanhHieus = danhHieus.filter(dh => dh !== 'HC_QKQT');

        if (invalidDanhHieus.length > 0) {
          throw new Error(
            `Loại đề xuất "Huy chương Quân kỳ quyết thắng" chỉ cho phép danh hiệu HC_QKQT. ` +
              `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
          );
        }

        // Kiểm tra điều kiện thời gian: >= 25 năm từ ngày nhập ngũ (không phân biệt nam nữ)
        const personnelIds = dataNienHan.map(item => item.personnel_id).filter(Boolean);
        const ineligiblePersonnel = [];

        for (const personnelId of personnelIds) {
          try {
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: personnelId },
              select: {
                id: true,
                ho_ten: true,
                ngay_nhap_ngu: true,
                ngay_xuat_ngu: true,
              },
            });

            if (!quanNhan) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: 'N/A',
                reason: 'Không tìm thấy quân nhân',
              });
              continue;
            }

            // Kiểm tra ngày nhập ngũ
            if (!quanNhan.ngay_nhap_ngu) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: quanNhan.ho_ten,
                reason: 'Chưa có thông tin ngày nhập ngũ',
              });
              continue;
            }

            // Tính số năm từ ngày nhập ngũ
            const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
            const ngayKetThuc = quanNhan.ngay_xuat_ngu
              ? new Date(quanNhan.ngay_xuat_ngu)
              : new Date();

            let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
            months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
            if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
              months--;
            }
            months = Math.max(0, months);

            const years = Math.floor(months / 12);

            // Yêu cầu: >= 25 năm (không phân biệt nam nữ)
            const requiredYears = 25;

            if (years < requiredYears) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: quanNhan.ho_ten,
                reason: `Chưa đủ ${requiredYears} năm phục vụ (hiện tại: ${years} năm)`,
              });
            }
          } catch (error) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: 'N/A',
              reason: `Lỗi kiểm tra: ${error.message}`,
            });
          }
        }

        if (ineligiblePersonnel.length > 0) {
          const names = ineligiblePersonnel.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
          throw new Error(
            `Một số quân nhân chưa đủ điều kiện để đề xuất Huy chương Quân kỳ quyết thắng (yêu cầu >= 25 năm phục vụ):\n${names}`
          );
        }
      }

      // ============================================
      // VALIDATION cho KNC_VSNXD_QDNDVN: Chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN
      // Và kiểm tra điều kiện: nữ >=20 năm, nam >=25 năm từ ngày nhập ngũ
      // ============================================
      if (type === 'KNC_VSNXD_QDNDVN' && dataNienHan && dataNienHan.length > 0) {
        const danhHieus = dataNienHan.map(item => item.danh_hieu).filter(Boolean);

        // Chỉ cho phép KNC_VSNXD_QDNDVN
        const invalidDanhHieus = danhHieus.filter(dh => dh !== 'KNC_VSNXD_QDNDVN');

        if (invalidDanhHieus.length > 0) {
          throw new Error(
            `Loại đề xuất "Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN" chỉ cho phép danh hiệu KNC_VSNXD_QDNDVN. ` +
              `Các danh hiệu không hợp lệ: ${invalidDanhHieus.join(', ')}.`
          );
        }

        // Kiểm tra điều kiện thời gian: nữ >=20 năm, nam >=25 năm từ ngày nhập ngũ
        const personnelIds = dataNienHan.map(item => item.personnel_id).filter(Boolean);
        const ineligiblePersonnel = [];

        for (const personnelId of personnelIds) {
          try {
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: personnelId },
              select: {
                id: true,
                ho_ten: true,
                gioi_tinh: true,
                ngay_nhap_ngu: true,
                ngay_xuat_ngu: true,
              },
            });

            if (!quanNhan) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: 'N/A',
                reason: 'Không tìm thấy quân nhân',
              });
              continue;
            }

            // Kiểm tra giới tính
            if (
              !quanNhan.gioi_tinh ||
              (quanNhan.gioi_tinh !== 'NAM' && quanNhan.gioi_tinh !== 'NU')
            ) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: quanNhan.ho_ten,
                reason: 'Chưa cập nhật thông tin giới tính',
              });
              continue;
            }

            // Kiểm tra ngày nhập ngũ
            if (!quanNhan.ngay_nhap_ngu) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: quanNhan.ho_ten,
                reason: 'Chưa có thông tin ngày nhập ngũ',
              });
              continue;
            }

            // Tính số năm từ ngày nhập ngũ
            const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
            const ngayKetThuc = quanNhan.ngay_xuat_ngu
              ? new Date(quanNhan.ngay_xuat_ngu)
              : new Date();

            let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
            months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
            if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
              months--;
            }
            months = Math.max(0, months);

            const years = Math.floor(months / 12);

            // Yêu cầu: nữ >=20 năm, nam >=25 năm
            const requiredYears = quanNhan.gioi_tinh === 'NU' ? 20 : 25;

            if (years < requiredYears) {
              ineligiblePersonnel.push({
                id: personnelId,
                ho_ten: quanNhan.ho_ten,
                reason: `Chưa đủ ${requiredYears} năm phục vụ (hiện tại: ${years} năm)`,
              });
            }
          } catch (error) {
            ineligiblePersonnel.push({
              id: personnelId,
              ho_ten: 'N/A',
              reason: `Lỗi kiểm tra: ${error.message}`,
            });
          }
        }

        if (ineligiblePersonnel.length > 0) {
          const names = ineligiblePersonnel.map(p => `${p.ho_ten} (${p.reason})`).join(', ');
          throw new Error(
            `Một số quân nhân chưa đủ điều kiện để đề xuất Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN:\n${names}`
          );
        }
      }

      // ============================================
      // VALIDATION cho CONG_HIEN: Kiểm tra điều kiện 10 năm trở lên
      // Hạng nhất (0.9-1.0): >= 10 năm từ nhóm 0.9-1.0
      // Hạng nhì (0.8): >= 10 năm từ nhóm 0.8 + 0.9-1.0 (hạng cao cộng vào)
      // Hạng ba (0.7): >= 10 năm từ nhóm 0.7 + 0.8 + 0.9-1.0 (tất cả hạng cao cộng vào)
      // Lưu ý: Nữ giảm 1/3 thời gian (chỉ cần 2/3), làm tròn tới tháng
      // ============================================
      if (type === 'CONG_HIEN' && dataDanhHieu && dataDanhHieu.length > 0) {
        const baseRequiredMonths = 10 * 12; // 10 năm = 120 tháng (cho nam)
        const femaleRequiredMonths = Math.round(baseRequiredMonths * (2 / 3)); // Nữ: 80 tháng (làm tròn)

        // Fetch thông tin quân nhân và lịch sử chức vụ
        const personnelIds = dataDanhHieu.map(item => item.personnel_id).filter(Boolean);
        const positionHistoriesMap = {};
        const personnelGenderMap = {}; // Map để lưu giới tính của quân nhân

        for (const personnelId of personnelIds) {
          try {
            // Fetch thông tin quân nhân để lấy giới tính
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: personnelId },
              select: {
                id: true,
                gioi_tinh: true,
              },
            });

            if (quanNhan) {
              personnelGenderMap[personnelId] = quanNhan.gioi_tinh;
            }

            // Fetch lịch sử chức vụ
            const histories = await prisma.lichSuChucVu.findMany({
              where: { quan_nhan_id: personnelId },
              select: {
                he_so_chuc_vu: true,
                so_thang: true,
                ngay_bat_dau: true,
                ngay_ket_thuc: true,
              },
            });

            // Tính số tháng cho chức vụ hiện tại (chưa có ngày kết thúc)
            const today = new Date();
            const updatedHistories = histories.map(item => {
              if (item.so_thang === null || item.so_thang === undefined) {
                // Nếu không có so_thang, tính từ ngày bắt đầu đến hôm nay
                if (item.ngay_bat_dau && !item.ngay_ket_thuc) {
                  const ngayBatDau = new Date(item.ngay_bat_dau);
                  let months = (today.getFullYear() - ngayBatDau.getFullYear()) * 12;
                  months += today.getMonth() - ngayBatDau.getMonth();
                  // Nếu ngày hôm nay < ngày bắt đầu trong tháng thì trừ 1 tháng
                  if (today.getDate() < ngayBatDau.getDate()) {
                    months--;
                  }
                  return {
                    ...item,
                    so_thang: Math.max(0, months),
                  };
                }
              }
              return item;
            });

            positionHistoriesMap[personnelId] = updatedHistories;
          } catch (error) {
            // Ignore errors for individual personnel
            positionHistoriesMap[personnelId] = [];
          }
        }

        // Hàm tính tổng tháng theo nhóm hệ số
        const getTotalMonthsByGroup = (personnelId, group) => {
          const histories = positionHistoriesMap[personnelId] || [];
          let totalMonths = 0;

          histories.forEach(history => {
            const heSo = Number(history.he_so_chuc_vu) || 0;
            let belongsToGroup = false;

            if (group === '0.7') {
              belongsToGroup = heSo >= 0.7 && heSo < 0.8;
            } else if (group === '0.8') {
              belongsToGroup = heSo >= 0.8 && heSo < 0.9;
            } else if (group === '0.9-1.0') {
              belongsToGroup = heSo >= 0.9 && heSo <= 1.0;
            }

            if (belongsToGroup && history.so_thang !== null && history.so_thang !== undefined) {
              totalMonths += Number(history.so_thang);
            }
          });

          return totalMonths;
        };

        // Hàm tính số tháng yêu cầu dựa trên giới tính
        const getRequiredMonths = personnelId => {
          const gioiTinh = personnelGenderMap[personnelId];
          // Nữ giảm 1/3 thời gian (chỉ cần 2/3), làm tròn tới tháng
          return gioiTinh === 'NU' ? femaleRequiredMonths : baseRequiredMonths;
        };

        // Hàm kiểm tra đủ điều kiện cho hạng
        const checkEligibleForRank = (personnelId, rank) => {
          const months0_9_1_0 = getTotalMonthsByGroup(personnelId, '0.9-1.0');
          const months0_8 = getTotalMonthsByGroup(personnelId, '0.8');
          const months0_7 = getTotalMonthsByGroup(personnelId, '0.7');
          const requiredMonths = getRequiredMonths(personnelId);

          if (rank === 'HANG_NHAT') {
            // Hạng nhất: cần >= yêu cầu từ nhóm 0.9-1.0
            return months0_9_1_0 >= requiredMonths;
          } else if (rank === 'HANG_NHI') {
            // Hạng nhì: cần >= yêu cầu từ nhóm 0.8 + 0.9-1.0 (hạng cao cộng vào)
            return months0_8 + months0_9_1_0 >= requiredMonths;
          } else if (rank === 'HANG_BA') {
            // Hạng ba: cần >= yêu cầu từ nhóm 0.7 + 0.8 + 0.9-1.0 (tất cả hạng cao cộng vào)
            return months0_7 + months0_8 + months0_9_1_0 >= requiredMonths;
          }

          return false;
        };

        // Kiểm tra từng quân nhân trong đề xuất
        for (const item of dataDanhHieu) {
          if (!item.danh_hieu || !item.personnel_id) continue;

          const personnel = personnelMap[item.personnel_id];
          const hoTen = personnel?.ho_ten || item.personnel_id;
          const gioiTinh = personnelGenderMap[item.personnel_id];
          const requiredMonths = getRequiredMonths(item.personnel_id);

          let eligible = false;
          let rankName = '';

          if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
            eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHAT');
            rankName = 'Hạng Nhất';
          } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
            eligible = checkEligibleForRank(item.personnel_id, 'HANG_NHI');
            rankName = 'Hạng Nhì';
          } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
            eligible = checkEligibleForRank(item.personnel_id, 'HANG_BA');
            rankName = 'Hạng Ba';
          }

          if (!eligible) {
            const months0_9_1_0 = getTotalMonthsByGroup(item.personnel_id, '0.9-1.0');
            const months0_8 = getTotalMonthsByGroup(item.personnel_id, '0.8');
            const months0_7 = getTotalMonthsByGroup(item.personnel_id, '0.7');

            let totalMonths = 0;
            if (item.danh_hieu === 'HCBVTQ_HANG_NHAT') {
              totalMonths = months0_9_1_0;
            } else if (item.danh_hieu === 'HCBVTQ_HANG_NHI') {
              totalMonths = months0_8 + months0_9_1_0;
            } else if (item.danh_hieu === 'HCBVTQ_HANG_BA') {
              totalMonths = months0_7 + months0_8 + months0_9_1_0;
            }

            const totalYears = Math.floor(totalMonths / 12);
            const remainingMonths = totalMonths % 12;
            const totalYearsText =
              totalYears > 0 && remainingMonths > 0
                ? `${totalYears} năm ${remainingMonths} tháng`
                : totalYears > 0
                  ? `${totalYears} năm`
                  : `${remainingMonths} tháng`;

            const requiredYears = Math.floor(requiredMonths / 12);
            const requiredRemainingMonths = requiredMonths % 12;
            const requiredYearsText =
              requiredYears > 0 && requiredRemainingMonths > 0
                ? `${requiredYears} năm ${requiredRemainingMonths} tháng`
                : requiredYears > 0
                  ? `${requiredYears} năm`
                  : `${requiredRemainingMonths} tháng`;

            const genderText = gioiTinh === 'NU' ? ' (Nữ giảm 1/3 thời gian)' : '';

            throw new Error(
              `Quân nhân "${hoTen}" không đủ điều kiện đề xuất Huân chương Bảo vệ Tổ quốc ${rankName}. ` +
                `Yêu cầu: ít nhất ${requiredYearsText}${genderText}. Hiện tại: ${totalYearsText}. ` +
                `Vui lòng kiểm tra lại lịch sử chức vụ của quân nhân này.`
            );
          }
        }
      }

      // ============================================
      // LƯU VÀO CSDL
      // ============================================
      // Xác định loại đơn vị và set đúng foreign key
      const isCoQuanDonVi = !!user.QuanNhan.co_quan_don_vi_id;
      const proposalData = {
        nguoi_de_xuat_id: userId,
        loai_de_xuat: type,
        nam: parseInt(nam) || new Date().getFullYear(),
        status: 'PENDING',
        data_danh_hieu: dataDanhHieu,
        data_thanh_tich: dataThanhTich,
        data_nien_han: dataNienHan,
        data_cong_hien: dataCongHien,
        files_attached: filesInfo.length > 0 ? filesInfo : null,
        ghi_chu: ghiChu || null,
      };

      if (isCoQuanDonVi) {
        proposalData.co_quan_don_vi_id = donViId;
        proposalData.don_vi_truc_thuoc_id = null;
      } else {
        proposalData.co_quan_don_vi_id = null;
        proposalData.don_vi_truc_thuoc_id = donViId;
      }

      const proposal = await prisma.bangDeXuat.create({
        data: proposalData,
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: {
              QuanNhan: true,
            },
          },
        },
      });

      return {
        message: 'Đã gửi đề xuất khen thưởng thành công',
        proposal: {
          id: proposal.id,
          loai_de_xuat: proposal.loai_de_xuat,
          don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
          nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
          status: proposal.status,
          so_personnel: titleData.length,
          createdAt: proposal.createdAt,
        },
      };
    } catch (error) {
      console.error('Submit proposal error:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách đề xuất
   * @param {number} userId - ID của tài khoản
   * @param {string} userRole - Role của user (ADMIN, MANAGER)
   * @param {number} page - Trang hiện tại
   * @param {number} limit - Số bản ghi mỗi trang
   * @returns {Promise<Object>} - Danh sách đề xuất
   */
  async getProposals(userId, userRole, page = 1, limit = 10) {
    try {
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      // Xây dựng điều kiện where
      let whereCondition = {};

      if (userRole === ROLES.MANAGER) {
        // Manager chỉ xem đề xuất của đơn vị mình
        const user = await prisma.taiKhoan.findUnique({
          where: { id: userId },
          include: {
            QuanNhan: {
              include: {
                CoQuanDonVi: true,
                DonViTrucThuoc: true,
              },
            },
          },
        });

        if (!user || !user.QuanNhan) {
          throw new Error('Không tìm thấy thông tin quân nhân');
        }

        const donViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
        if (user.QuanNhan.co_quan_don_vi_id) {
          whereCondition.co_quan_don_vi_id = donViId;
        } else {
          whereCondition.don_vi_truc_thuoc_id = donViId;
        }
      }
      // ADMIN xem tất cả

      // Lấy danh sách và tổng số
      const [proposals, total] = await Promise.all([
        prisma.bangDeXuat.findMany({
          where: whereCondition,
          skip,
          take,
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
            NguoiDeXuat: {
              include: {
                QuanNhan: true,
              },
            },
            NguoiDuyet: {
              include: {
                QuanNhan: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.bangDeXuat.count({ where: whereCondition }),
      ]);

      return {
        proposals: proposals.map(p => ({
          id: p.id,
          loai_de_xuat: p.loai_de_xuat,
          nam: p.nam,
          don_vi: (p.DonViTrucThuoc || p.CoQuanDonVi)?.ten_don_vi || '-',
          nguoi_de_xuat: p.NguoiDeXuat.QuanNhan?.ho_ten || p.NguoiDeXuat.username,
          status: p.status,
          so_danh_hieu: Array.isArray(p.data_danh_hieu) ? p.data_danh_hieu.length : 0,
          so_thanh_tich: Array.isArray(p.data_thanh_tich) ? p.data_thanh_tich.length : 0,
          so_nien_han: Array.isArray(p.data_nien_han) ? p.data_nien_han.length : 0,
          so_cong_hien: Array.isArray(p.data_cong_hien) ? p.data_cong_hien.length : 0,
          nguoi_duyet: p.NguoiDuyet?.QuanNhan?.ho_ten || null,
          ngay_duyet: p.ngay_duyet,
          ghi_chu: p.ghi_chu,
          createdAt: p.createdAt,
        })),
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / take),
        },
      };
    } catch (error) {
      console.error('Get proposals error:', error);
      throw error;
    }
  }

  /**
   * Lấy chi tiết 1 đề xuất
   * @param {number} proposalId - ID của đề xuất
   * @param {number} userId - ID của tài khoản
   * @param {string} userRole - Role của user
   * @returns {Promise<Object>} - Chi tiết đề xuất
   */
  async getProposalById(proposalId, userId, userRole) {
    try {
      const proposal = await prisma.bangDeXuat.findUnique({
        where: { id: proposalId },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: {
              QuanNhan: {
                include: {
                  CoQuanDonVi: true,
                  DonViTrucThuoc: {
                    include: {
                      CoQuanDonVi: true,
                    },
                  },
                },
              },
            },
          },
          NguoiDuyet: {
            include: {
              QuanNhan: true,
            },
          },
        },
      });

      if (!proposal) {
        throw new Error('Không tìm thấy đề xuất');
      }

      // Kiểm tra quyền truy cập
      if (userRole === ROLES.MANAGER) {
        const user = await prisma.taiKhoan.findUnique({
          where: { id: userId },
          include: {
            QuanNhan: {
              include: {
                CoQuanDonVi: true,
                DonViTrucThuoc: true,
              },
            },
          },
        });

        if (user && user.QuanNhan) {
          const userDonViId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
          const proposalDonViId = proposal.co_quan_don_vi_id || proposal.don_vi_truc_thuoc_id;

          if (userDonViId !== proposalDonViId) {
            throw new Error('Bạn không có quyền xem đề xuất này');
          }
        }
      }

      // Đảm bảo data_danh_hieu, data_thanh_tich và data_nien_han luôn là array
      let dataDanhHieu = Array.isArray(proposal.data_danh_hieu)
        ? proposal.data_danh_hieu
        : proposal.data_danh_hieu
          ? [proposal.data_danh_hieu]
          : [];

      let dataThanhTich = Array.isArray(proposal.data_thanh_tich)
        ? proposal.data_thanh_tich
        : proposal.data_thanh_tich
          ? [proposal.data_thanh_tich]
          : [];

      let dataNienHan = Array.isArray(proposal.data_nien_han)
        ? proposal.data_nien_han
        : proposal.data_nien_han
          ? [proposal.data_nien_han]
          : [];

      let dataCongHien = Array.isArray(proposal.data_cong_hien)
        ? proposal.data_cong_hien
        : proposal.data_cong_hien
          ? [proposal.data_cong_hien]
          : [];

      // Enrich thông tin quân nhân/đơn vị nếu thiếu (dữ liệu cũ)
      // Xử lý riêng cho DON_VI_HANG_NAM (khen thưởng tập thể)
      if (proposal.loai_de_xuat === 'DON_VI_HANG_NAM') {
        // Enrich dataDanhHieu cho khen thưởng tập thể
        dataDanhHieu = await Promise.all(
          dataDanhHieu.map(async item => {
            // Nếu đã có đầy đủ thông tin, không cần enrich
            if (item.ten_don_vi && item.ma_don_vi) {
              return {
                ...item,
                nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
              };
            }

            // Enrich thông tin đơn vị nếu thiếu
            let donViInfo = null;
            let coQuanDonViCha = null;

            if (item.don_vi_type === 'CO_QUAN_DON_VI' && item.don_vi_id) {
              const donVi = await prisma.coQuanDonVi.findUnique({
                where: { id: item.don_vi_id },
                select: {
                  id: true,
                  ten_don_vi: true,
                  ma_don_vi: true,
                },
              });
              donViInfo = donVi;
            } else if (item.don_vi_type === 'DON_VI_TRUC_THUOC' && item.don_vi_id) {
              const donVi = await prisma.donViTrucThuoc.findUnique({
                where: { id: item.don_vi_id },
                include: {
                  CoQuanDonVi: {
                    select: {
                      id: true,
                      ten_don_vi: true,
                      ma_don_vi: true,
                    },
                  },
                },
              });
              donViInfo = {
                id: donVi.id,
                ten_don_vi: donVi.ten_don_vi,
                ma_don_vi: donVi.ma_don_vi,
              };
              coQuanDonViCha = donVi.CoQuanDonVi;
            }

            return {
              ...item,
              ten_don_vi: item.ten_don_vi || donViInfo?.ten_don_vi || '',
              ma_don_vi: item.ma_don_vi || donViInfo?.ma_don_vi || '',
              nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
              co_quan_don_vi_cha: item.co_quan_don_vi_cha || coQuanDonViCha,
            };
          })
        );
      } else {
        // Xử lý cho các loại khen thưởng cá nhân
        const allPersonnelIds = [
          ...dataDanhHieu.map(d => d.personnel_id).filter(Boolean),
          ...dataThanhTich.map(d => d.personnel_id).filter(Boolean),
          ...dataNienHan.map(d => d.personnel_id).filter(Boolean),
          ...dataCongHien.map(d => d.personnel_id).filter(Boolean),
        ];

        // Khởi tạo personnelMap trước để tránh lỗi undefined
        const personnelMap = {};

        if (allPersonnelIds.length > 0) {
          // Fetch thông tin quân nhân và đơn vị
          const personnelList = await prisma.quanNhan.findMany({
            where: {
              id: {
                in: allPersonnelIds,
              },
            },
            select: {
              id: true,
              ho_ten: true,
              cap_bac: true,
              CoQuanDonVi: {
                select: {
                  id: true,
                  ten_don_vi: true,
                  ma_don_vi: true,
                },
              },
              DonViTrucThuoc: {
                select: {
                  id: true,
                  ten_don_vi: true,
                  ma_don_vi: true,
                  co_quan_don_vi_id: true,
                  CoQuanDonVi: {
                    select: {
                      id: true,
                      ten_don_vi: true,
                      ma_don_vi: true,
                    },
                  },
                },
              },
              ChucVu: {
                select: {
                  id: true,
                  ten_chuc_vu: true,
                },
              },
            },
          });

          personnelList.forEach(p => {
            personnelMap[p.id] = p;
          });

          // Enrich dataDanhHieu nếu thiếu thông tin
          dataDanhHieu = dataDanhHieu.map(item => {
            const personnel = personnelMap[item.personnel_id];
            const enrichedItem = {
              ...item,
              ho_ten: item.ho_ten || personnel?.ho_ten || '',
              nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
              // Chỉ lấy từ dataJSON, không lấy từ personnel hiện tại (đề xuất có thể từ quá khứ)
              cap_bac: item.cap_bac || null,
              chuc_vu: item.chuc_vu || null,
            };

            // Thêm thông tin đơn vị nếu chưa có (theo cấu trúc mới)
            // Luôn lưu cả hai nếu quân nhân có dữ liệu
            if (!item.co_quan_don_vi && personnel?.CoQuanDonVi) {
              enrichedItem.co_quan_don_vi = {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              };
            }
            if (!item.don_vi_truc_thuoc && personnel?.DonViTrucThuoc) {
              enrichedItem.don_vi_truc_thuoc = {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              };
            }

            return enrichedItem;
          });

          // Enrich dataThanhTich nếu thiếu thông tin
          dataThanhTich = dataThanhTich.map(item => {
            const personnel = personnelMap[item.personnel_id];
            const enrichedItem = {
              ...item,
              ho_ten: item.ho_ten || personnel?.ho_ten || '',
              nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
              // Chỉ lấy từ dataJSON, không lấy từ personnel hiện tại (đề xuất có thể từ quá khứ)
              cap_bac: item.cap_bac !== undefined && item.cap_bac !== null ? item.cap_bac : null,
              chuc_vu: item.chuc_vu !== undefined && item.chuc_vu !== null ? item.chuc_vu : null,
            };

            // Thêm thông tin đơn vị nếu chưa có (theo cấu trúc mới)
            // Luôn lưu cả hai nếu quân nhân có dữ liệu
            if (!item.co_quan_don_vi && personnel?.CoQuanDonVi) {
              enrichedItem.co_quan_don_vi = {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              };
            }
            if (!item.don_vi_truc_thuoc && personnel?.DonViTrucThuoc) {
              enrichedItem.don_vi_truc_thuoc = {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              };
            }

            return enrichedItem;
          });

          // Enrich dataNienHan nếu thiếu thông tin
          dataNienHan = dataNienHan.map(item => {
            const personnel = personnelMap[item.personnel_id];
            const enrichedItem = {
              ...item,
              ho_ten: item.ho_ten || personnel?.ho_ten || '',
              nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
              // Chỉ lấy từ dataJSON, không lấy từ personnel hiện tại (đề xuất có thể từ quá khứ)
              cap_bac: item.cap_bac !== undefined && item.cap_bac !== null ? item.cap_bac : null,
              chuc_vu: item.chuc_vu !== undefined && item.chuc_vu !== null ? item.chuc_vu : null,
            };

            // Thêm thông tin đơn vị nếu chưa có (theo cấu trúc mới)
            // Luôn lưu cả hai nếu quân nhân có dữ liệu
            if (!item.co_quan_don_vi && personnel?.CoQuanDonVi) {
              enrichedItem.co_quan_don_vi = {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              };
            }
            if (!item.don_vi_truc_thuoc && personnel?.DonViTrucThuoc) {
              enrichedItem.don_vi_truc_thuoc = {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              };
            }

            return enrichedItem;
          });

          // Enrich dataCongHien nếu thiếu thông tin
          dataCongHien = dataCongHien.map(item => {
            const personnel = personnelMap[item.personnel_id];
            const enrichedItem = {
              ...item,
              ho_ten: item.ho_ten || personnel?.ho_ten || '',
              nam: item.nam || proposal.createdAt?.getFullYear() || new Date().getFullYear(),
              // Chỉ lấy từ dataJSON, không lấy từ personnel hiện tại (đề xuất có thể từ quá khứ)
              cap_bac: item.cap_bac !== undefined && item.cap_bac !== null ? item.cap_bac : null,
              chuc_vu: item.chuc_vu !== undefined && item.chuc_vu !== null ? item.chuc_vu : null,
            };

            // Thêm thông tin đơn vị nếu chưa có (theo cấu trúc mới)
            // Luôn lưu cả hai nếu quân nhân có dữ liệu
            if (!item.co_quan_don_vi && personnel?.CoQuanDonVi) {
              enrichedItem.co_quan_don_vi = {
                id: personnel.CoQuanDonVi.id,
                ten_co_quan_don_vi: personnel.CoQuanDonVi.ten_don_vi,
                ma_co_quan_don_vi: personnel.CoQuanDonVi.ma_don_vi,
              };
            }
            if (!item.don_vi_truc_thuoc && personnel?.DonViTrucThuoc) {
              enrichedItem.don_vi_truc_thuoc = {
                id: personnel.DonViTrucThuoc.id,
                ten_don_vi: personnel.DonViTrucThuoc.ten_don_vi,
                ma_don_vi: personnel.DonViTrucThuoc.ma_don_vi,
                co_quan_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi
                  ? {
                      id: personnel.DonViTrucThuoc.CoQuanDonVi.id,
                      ten_don_vi_truc: personnel.DonViTrucThuoc.CoQuanDonVi.ten_don_vi,
                      ma_don_vi: personnel.DonViTrucThuoc.CoQuanDonVi.ma_don_vi,
                    }
                  : null,
              };
            }

            return enrichedItem;
          });
        }
      }

      // Nếu proposal đã được approve, enrich với thông tin file PDF từ database
      // Xử lý cho dataDanhHieu (CA_NHAN_HANG_NAM, DOT_XUAT)
      // CONG_HIEN sẽ được xử lý riêng ở phần data_cong_hien
      if (
        proposal.status === 'APPROVED' &&
        dataDanhHieu.length > 0 &&
        proposal.loai_de_xuat !== 'CONG_HIEN'
      ) {
        if (proposal.loai_de_xuat === 'DON_VI_HANG_NAM') {
          // Với khen thưởng tập thể, file PDF đã được lưu trong data đề xuất khi approve
          // Không cần enrich từ database khác vì không có bảng riêng cho khen thưởng tập thể
          // File PDF đã được lưu trong item.file_quyet_dinh khi approve
        } else {
          // Lấy danh hiệu từ database dựa trên personnel_id (cho khen thưởng cá nhân)
          const personnelIds = dataDanhHieu.map(d => d.personnel_id).filter(Boolean);
          if (personnelIds.length > 0) {
            const danhHieuFromDB = await prisma.danhHieuHangNam.findMany({
              where: {
                quan_nhan_id: { in: personnelIds },
                nam: proposal.nam,
              },
              include: {
                QuanNhan: {
                  select: { id: true },
                },
              },
            });

            const danhHieuMap = {};
            danhHieuFromDB.forEach(dh => {
              const personnelId = dh.quan_nhan_id;
              if (!danhHieuMap[personnelId]) {
                danhHieuMap[personnelId] = [];
              }
              danhHieuMap[personnelId].push(dh);
            });

            // Enrich dataDanhHieu với file PDF và số quyết định
            dataDanhHieu = dataDanhHieu.map(item => {
              const dbRecords = danhHieuMap[item.personnel_id] || [];
              const matchingRecord = dbRecords.find(
                r => r.danh_hieu === item.danh_hieu && r.nam === item.nam
              );
              if (matchingRecord) {
                return {
                  ...item,
                  so_quyet_dinh: matchingRecord.so_quyet_dinh || item.so_quyet_dinh,
                  file_quyet_dinh: matchingRecord.file_quyet_dinh,
                  file_quyet_dinh_bkbqp: matchingRecord.file_quyet_dinh_bkbqp,
                  file_quyet_dinh_cstdtq: matchingRecord.file_quyet_dinh_cstdtq,
                };
              }
              return item;
            });
          }
        }
      }

      // Nếu proposal đã được approve, enrich với thông tin file PDF từ database cho dataNienHan
      if (proposal.status === 'APPROVED' && dataNienHan.length > 0) {
        const nienHanTypes = ['NIEN_HAN', 'HC_QKQT', 'KNC_VSNXD_QDNDVN'];
        if (nienHanTypes.includes(proposal.loai_de_xuat)) {
          const personnelIds = dataNienHan.map(d => d.personnel_id).filter(Boolean);
          if (personnelIds.length > 0) {
            // Lấy dữ liệu từ bảng KhenThuongHCCSVV, HuanChuongQuanKyQuyetThang, KyNiemChuongVSNXDQDNDVN
            if (proposal.loai_de_xuat === 'NIEN_HAN') {
              const hccsvvFromDB = await prisma.khenThuongHCCSVV.findMany({
                where: {
                  quan_nhan_id: { in: personnelIds },
                  nam: proposal.nam,
                },
              });

              const hccsvvMap = {};
              hccsvvFromDB.forEach(dh => {
                const key = `${dh.quan_nhan_id}_${dh.danh_hieu}`;
                hccsvvMap[key] = dh;
              });

              // Enrich dataNienHan với file PDF và số quyết định
              dataNienHan = dataNienHan.map(item => {
                const key = `${item.personnel_id}_${item.danh_hieu}`;
                const dbRecord = hccsvvMap[key];
                if (dbRecord) {
                  return {
                    ...item,
                    so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                    file_quyet_dinh: dbRecord.file_quyet_dinh,
                    thoi_gian: dbRecord.thoi_gian || item.thoi_gian,
                  };
                }
                return item;
              });
            } else if (proposal.loai_de_xuat === 'HC_QKQT') {
              const hcqkqtFromDB = await prisma.huanChuongQuanKyQuyetThang.findMany({
                where: {
                  quan_nhan_id: { in: personnelIds },
                  nam: proposal.nam,
                },
              });

              const hcqkqtMap = {};
              hcqkqtFromDB.forEach(dh => {
                hcqkqtMap[dh.quan_nhan_id] = dh;
              });

              // Enrich dataNienHan với file PDF và số quyết định
              dataNienHan = dataNienHan.map(item => {
                const dbRecord = hcqkqtMap[item.personnel_id];
                if (dbRecord) {
                  return {
                    ...item,
                    so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                    file_quyet_dinh: dbRecord.file_quyet_dinh,
                    thoi_gian: dbRecord.thoi_gian || item.thoi_gian,
                  };
                }
                return item;
              });
            } else if (proposal.loai_de_xuat === 'KNC_VSNXD_QDNDVN') {
              const kncFromDB = await prisma.kyNiemChuongVSNXDQDNDVN.findMany({
                where: {
                  quan_nhan_id: { in: personnelIds },
                  nam: proposal.nam,
                },
              });

              const kncMap = {};
              kncFromDB.forEach(dh => {
                kncMap[dh.quan_nhan_id] = dh;
              });

              // Enrich dataNienHan với file PDF và số quyết định
              dataNienHan = dataNienHan.map(item => {
                const dbRecord = kncMap[item.personnel_id];
                if (dbRecord) {
                  return {
                    ...item,
                    so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                    file_quyet_dinh: dbRecord.file_quyet_dinh,
                    thoi_gian: dbRecord.thoi_gian || item.thoi_gian,
                  };
                }
                return item;
              });
            }
          }
        }
      }

      // Nếu proposal đã được approve, enrich với thông tin file PDF từ database cho dataCongHien
      if (
        proposal.loai_de_xuat === 'CONG_HIEN' &&
        proposal.status === 'APPROVED' &&
        dataCongHien.length > 0
      ) {
        const personnelIds = dataCongHien.map(d => d.personnel_id).filter(Boolean);
        if (personnelIds.length > 0) {
          const congHienFromDB = await prisma.khenThuongCongHien.findMany({
            where: {
              quan_nhan_id: { in: personnelIds },
            },
          });

          const congHienMap = {};
          congHienFromDB.forEach(dh => {
            congHienMap[dh.quan_nhan_id] = dh;
          });

          // Enrich dataCongHien với file PDF và số quyết định
          dataCongHien = dataCongHien.map(item => {
            const dbRecord = congHienMap[item.personnel_id];
            if (dbRecord) {
              return {
                ...item,
                so_quyet_dinh: dbRecord.so_quyet_dinh || item.so_quyet_dinh,
                file_quyet_dinh: dbRecord.file_quyet_dinh,
                thoi_gian_nhom_0_7: dbRecord.thoi_gian_nhom_0_7 || item.thoi_gian_nhom_0_7,
                thoi_gian_nhom_0_8: dbRecord.thoi_gian_nhom_0_8 || item.thoi_gian_nhom_0_8,
                thoi_gian_nhom_0_9_1_0:
                  dbRecord.thoi_gian_nhom_0_9_1_0 || item.thoi_gian_nhom_0_9_1_0,
              };
            }
            return item;
          });
        }
      }

      return {
        id: proposal.id,
        loai_de_xuat: proposal.loai_de_xuat,
        nam: proposal.nam,
        don_vi: {
          id: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.id || null,
          ma_don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ma_don_vi || '',
          ten_don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '',
        },
        nguoi_de_xuat: {
          id: proposal.NguoiDeXuat.id,
          username: proposal.NguoiDeXuat.username,
          ho_ten: proposal.NguoiDeXuat.QuanNhan?.ho_ten,
        },
        status: proposal.status,
        data_danh_hieu: dataDanhHieu,
        data_thanh_tich: dataThanhTich,
        data_nien_han: dataNienHan,
        data_cong_hien: dataCongHien,
        files_attached: proposal.files_attached || [],
        ghi_chu: proposal.ghi_chu,
        rejection_reason: proposal.rejection_reason || null,
        nguoi_duyet: proposal.NguoiDuyet
          ? {
              id: proposal.NguoiDuyet.id,
              username: proposal.NguoiDuyet.username,
              ho_ten: proposal.NguoiDuyet.QuanNhan?.ho_ten,
            }
          : null,
        ngay_duyet: proposal.ngay_duyet,
        createdAt: proposal.createdAt,
        updatedAt: proposal.updatedAt,
      };
    } catch (error) {
      console.error('Get proposal by id error:', error);
      throw error;
    }
  }

  /**
   * Phê duyệt đề xuất và import vào CSDL chính
   * @param {number} proposalId - ID của đề xuất
   * @param {Object} editedData - Dữ liệu đã được chỉnh sửa từ Admin
   * @param {number} adminId - ID của Admin phê duyệt
   * @returns {Promise<Object>} - Kết quả phê duyệt
   */
  async approveProposal(
    proposalId,
    editedData,
    adminId,
    decisions = {},
    pdfFiles = {},
    ghiChu = null
  ) {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      // Lấy thông tin đề xuất
      const proposal = await prisma.bangDeXuat.findUnique({
        where: { id: proposalId },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: {
              QuanNhan: true,
            },
          },
          NguoiDuyet: {
            include: {
              QuanNhan: true,
            },
          },
        },
      });

      if (!proposal) {
        throw new Error('Không tìm thấy đề xuất');
      }

      if (proposal.status === 'APPROVED') {
        throw new Error('Đề xuất này đã được phê duyệt trước đó');
      }

      // Dữ liệu để import (ưu tiên dữ liệu đã chỉnh sửa)
      const danhHieuData = editedData.data_danh_hieu || proposal.data_danh_hieu || [];
      const thanhTichData = editedData.data_thanh_tich || proposal.data_thanh_tich || [];
      const nienHanData = editedData.data_nien_han || proposal.data_nien_han || [];
      const congHienData = editedData.data_cong_hien || proposal.data_cong_hien || [];

      // ============================================
      // VALIDATION: Kiểm tra đề xuất trùng (cùng năm và cùng danh hiệu)
      // ============================================
      const duplicateErrors = [];
      const proposalYear = proposal.nam;
      const proposalType = proposal.loai_de_xuat;

      // Kiểm tra danh hiệu hằng năm (CA_NHAN_HANG_NAM)
      if (proposalType === 'CA_NHAN_HANG_NAM' && danhHieuData && danhHieuData.length > 0) {
        for (const item of danhHieuData) {
          if (item.personnel_id && item.danh_hieu) {
            const checkResult = await this.checkDuplicateAward(
              item.personnel_id,
              proposalYear,
              item.danh_hieu,
              proposalType,
              'APPROVED',
              proposalId
            );
            if (checkResult.exists) {
              const quanNhan = await prisma.quanNhan.findUnique({
                where: { id: item.personnel_id },
                select: { ho_ten: true },
              });
              duplicateErrors.push(
                `${quanNhan?.ho_ten || item.personnel_id}: ${checkResult.message}`
              );
            }
          }
        }
      }

      // Kiểm tra niên hạn (NIEN_HAN, HC_QKQT, KNC_VSNXD_QDNDVN)
      if (
        (proposalType === 'NIEN_HAN' ||
          proposalType === 'HC_QKQT' ||
          proposalType === 'KNC_VSNXD_QDNDVN' ||
          proposalType === 'HCCSVV') &&
        nienHanData &&
        nienHanData.length > 0
      ) {
        for (const item of nienHanData) {
          if (item.personnel_id && item.danh_hieu) {
            const checkResult = await this.checkDuplicateAward(
              item.personnel_id,
              proposalYear,
              item.danh_hieu,
              proposalType,
              'APPROVED',
              proposalId
            );
            if (checkResult.exists) {
              const quanNhan = await prisma.quanNhan.findUnique({
                where: { id: item.personnel_id },
                select: { ho_ten: true },
              });
              duplicateErrors.push(
                `${quanNhan?.ho_ten || item.personnel_id}: ${checkResult.message}`
              );
            }
          }
        }
      }

      // Kiểm tra cống hiến (CONG_HIEN)
      if (proposalType === 'CONG_HIEN' && nienHanData && nienHanData.length > 0) {
        for (const item of nienHanData) {
          if (item.personnel_id && item.danh_hieu) {
            const checkResult = await this.checkDuplicateAward(
              item.personnel_id,
              proposalYear,
              item.danh_hieu,
              proposalType,
              null,
              proposalId
            );
            if (checkResult.exists) {
              const quanNhan = await prisma.quanNhan.findUnique({
                where: { id: item.personnel_id },
                select: { ho_ten: true },
              });
              duplicateErrors.push(
                `${quanNhan?.ho_ten || item.personnel_id}: ${checkResult.message}`
              );
            }
          }
        }
      }

      // Nếu có lỗi trùng, throw error
      if (duplicateErrors.length > 0) {
        throw new Error(
          `Phát hiện đề xuất trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`
        );
      }

      let importedDanhHieu = 0;
      let importedThanhTich = 0;
      let importedNienHan = 0;
      const errors = [];
      const affectedPersonnelIds = new Set(); // Track quân nhân bị ảnh hưởng

      // ============================================
      // LƯU FILE PDF VÀO UPLOADS
      // Kiểm tra xem quyết định đã có file trong DB chưa, nếu có thì dùng file đó
      // ============================================
      const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'decisions');
      await fs.mkdir(uploadsDir, { recursive: true });

      const pdfPaths = {};

      // Hàm helper để tạo tên file unique, sanitize và thêm số thứ tự nếu trùng
      const getUniqueFilename = async originalName => {
        // Xử lý encoding nếu cần
        let processedName = originalName || 'file';
        try {
          if (Buffer.isBuffer(processedName)) {
            processedName = processedName.toString('utf8');
          } else if (typeof processedName === 'string') {
            processedName = Buffer.from(processedName, 'latin1').toString('utf8');
          }
        } catch (e) {
          processedName = 'file';
        }

        // Sanitize tên file để tránh lỗi filesystem
        const sanitized = this.sanitizeFilename(processedName);
        const ext = path.extname(sanitized);
        const baseName = path.basename(sanitized, ext);
        let filename = sanitized;
        let counter = 1;

        // Kiểm tra nếu file đã tồn tại, thêm số thứ tự
        while (
          await fs
            .access(path.join(uploadsDir, filename))
            .then(() => true)
            .catch(() => false)
        ) {
          filename = `${baseName}(${counter})${ext}`;
          counter++;
        }

        return filename;
      };

      // Hàm helper để lấy file_path từ DB nếu quyết định đã tồn tại
      const getFilePathFromDB = async soQuyetDinh => {
        if (!soQuyetDinh) return null;
        try {
          const decision = await prisma.fileQuyetDinh.findUnique({
            where: { so_quyet_dinh: soQuyetDinh },
            select: { file_path: true },
          });
          return decision?.file_path || null;
        } catch (error) {
          console.error(`Lỗi khi tìm file_path cho quyết định ${soQuyetDinh}:`, error);
          return null;
        }
      };

      // Map các key trong pdfFiles với số quyết định tương ứng
      const pdfFileToDecisionMap = {
        file_pdf_ca_nhan_hang_nam: decisions.so_quyet_dinh_ca_nhan_hang_nam,
        file_pdf_don_vi_hang_nam: decisions.so_quyet_dinh_don_vi_hang_nam,
        file_pdf_nien_han: decisions.so_quyet_dinh_nien_han,
        file_pdf_cong_hien: decisions.so_quyet_dinh_cong_hien,
        file_pdf_dot_xuat: decisions.so_quyet_dinh_dot_xuat,
        file_pdf_nckh: decisions.so_quyet_dinh_nckh,
      };

      // Lưu file PDF cho từng loại danh hiệu và thành tích
      // Chỉ upload nếu chưa có file trong DB
      for (const [key, file] of Object.entries(pdfFiles)) {
        if (file && file.buffer) {
          const soQuyetDinh = pdfFileToDecisionMap[key];

          // Kiểm tra xem quyết định đã có file trong DB chưa
          const existingFilePath = await getFilePathFromDB(soQuyetDinh);

          if (existingFilePath) {
            // Nếu đã có file trong DB, dùng file đó
            console.log(`✅ Quyết định ${soQuyetDinh} đã có file trong DB: ${existingFilePath}`);
            pdfPaths[key] = existingFilePath;
          } else {
            // Nếu chưa có, upload file mới
            console.log(`📤 Upload file mới cho quyết định ${soQuyetDinh}`);
            const filename = await getUniqueFilename(file.originalname);
            const filepath = path.join(uploadsDir, filename);
            await fs.writeFile(filepath, file.buffer);
            pdfPaths[key] = `uploads/decisions/${filename}`;
          }
        }
      }

      // Lưu file PDF cho thành tích NCKH/SKKH nếu có
      if (pdfFiles.file_pdf_nckh && pdfFiles.file_pdf_nckh.buffer) {
        const soQuyetDinh = decisions.so_quyet_dinh_nckh;
        const existingFilePath = await getFilePathFromDB(soQuyetDinh);

        if (existingFilePath) {
          console.log(`✅ Quyết định NCKH ${soQuyetDinh} đã có file trong DB: ${existingFilePath}`);
          pdfPaths.file_pdf_nckh = existingFilePath;
        } else {
          console.log(`📤 Upload file mới cho quyết định NCKH ${soQuyetDinh}`);
          const filename = await getUniqueFilename(pdfFiles.file_pdf_nckh.originalname);
          const filepath = path.join(uploadsDir, filename);
          await fs.writeFile(filepath, pdfFiles.file_pdf_nckh.buffer);
          pdfPaths.file_pdf_nckh = `uploads/decisions/${filename}`;
        }
      }

      // ============================================
      // TẠO MAPPING DANH HIỆU -> QUYẾT ĐỊNH
      // ============================================
      const decisionMapping = {
        CSTT: {
          so_quyet_dinh: decisions.so_quyet_dinh_cstt,
          file_pdf: pdfPaths.file_pdf_cstt,
        },
        CSTDCS: {
          so_quyet_dinh: decisions.so_quyet_dinh_cstdcs,
          file_pdf: pdfPaths.file_pdf_cstdcs,
        },
        ĐVQT: {
          so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
          file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
        },
        ĐVTT: {
          so_quyet_dinh: decisions.so_quyet_dinh_don_vi_hang_nam,
          file_pdf: pdfPaths.file_pdf_don_vi_hang_nam,
        },
        HCCSVV_HANG_BA: {
          so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
          file_pdf: pdfPaths.file_pdf_nien_han,
        },
        HCCSVV_HANG_NHI: {
          so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
          file_pdf: pdfPaths.file_pdf_nien_han,
        },
        HCCSVV_HANG_NHAT: {
          so_quyet_dinh: decisions.so_quyet_dinh_nien_han,
          file_pdf: pdfPaths.file_pdf_nien_han,
        },
        HC_QKQT: {
          so_quyet_dinh: decisions.so_quyet_dinh_hc_qkqt || decisions.so_quyet_dinh_nien_han,
          file_pdf: pdfPaths.file_pdf_hc_qkqt || pdfPaths.file_pdf_nien_han,
        },
        KNC_VSNXD_QDNDVN: {
          so_quyet_dinh: decisions.so_quyet_dinh_knc_vsnxd || decisions.so_quyet_dinh_nien_han,
          file_pdf: pdfPaths.file_pdf_knc_vsnxd || pdfPaths.file_pdf_nien_han,
        },
      };

      const specialDecisionMapping = {
        BKBQP: {
          so_quyet_dinh: decisions.so_quyet_dinh_bkbqp,
          file_pdf: pdfPaths.file_pdf_bkbqp,
        },
        CSTDTQ: {
          so_quyet_dinh: decisions.so_quyet_dinh_cstdtq,
          file_pdf: pdfPaths.file_pdf_cstdtq,
        },
        BKTTCP: {
          so_quyet_dinh: decisions.so_quyet_dinh_bkttcp,
          file_pdf: pdfPaths.file_pdf_bkttcp,
        },
      };

      // ============================================
      // IMPORT DANH HIỆU ĐƠN VỊ HẰNG NĂM
      // ============================================
      // Với đề xuất DON_VI_HANG_NAM, lưu vào bảng `danh_hieu_don_vi_hang_nam` và cập nhật `ho_so_don_vi_hang_nam`
      if (proposal.loai_de_xuat === 'DON_VI_HANG_NAM') {
        for (const item of danhHieuData) {
          try {
            // Kiểm tra có đủ thông tin đơn vị không
            if (!item.don_vi_id || !item.don_vi_type) {
              errors.push(`Thiếu thông tin đơn vị trong dữ liệu: ${JSON.stringify(item)}`);
              continue;
            }

            // Xác định co_quan_don_vi_id và don_vi_truc_thuoc_id
            const coQuanDonViId = item.don_vi_type === 'CO_QUAN_DON_VI' ? item.don_vi_id : null;
            const donViTrucThuocId =
              item.don_vi_type === 'DON_VI_TRUC_THUOC' ? item.don_vi_id : null;

            const namValue = typeof item.nam === 'string' ? parseInt(item.nam, 10) : item.nam;

            // ============================================
            // XỬ LÝ BÌNH THƯỜNG CHO ĐVQT VÀ ĐVTT
            // ============================================
            // Chỉ lưu các đơn vị có danh hiệu
            if (!item.danh_hieu || item.danh_hieu.trim() === '') {
              continue;
            }

            // Lấy số quyết định và file từ item hoặc mapping theo danh hiệu
            // Ưu tiên lấy từ item (đã được Admin chỉnh sửa), sau đó mới fallback về decisionMapping
            const decisionInfo = decisionMapping[item.danh_hieu] || {};
            const soQuyetDinh = item.so_quyet_dinh || decisionInfo.so_quyet_dinh || null;
            const fileQuyetDinh = item.file_quyet_dinh || decisionInfo.file_pdf || null;

            // Lấy thông tin bằng khen đặc biệt (nếu có)
            const nhanBKBQP = item.nhan_bkbqp || false;
            const soQuyetDinhBKBQP =
              item.so_quyet_dinh_bkbqp ||
              (nhanBKBQP ? specialDecisionMapping.BKBQP?.so_quyet_dinh : null) ||
              (nhanBKBQP ? item.so_quyet_dinh : null);
            const fileQuyetDinhBKBQP =
              item.file_quyet_dinh_bkbqp ||
              (nhanBKBQP ? specialDecisionMapping.BKBQP?.file_pdf : null) ||
              (nhanBKBQP ? item.file_quyet_dinh : null);

            const nhanBKTTCP = item.nhan_bkttcp || false;
            const soQuyetDinhBKTTCP =
              item.so_quyet_dinh_bkttcp ||
              (nhanBKTTCP ? specialDecisionMapping.CSTDTQ?.so_quyet_dinh : null) ||
              (nhanBKTTCP ? item.so_quyet_dinh : null);
            const fileQuyetDinhBKTTCP =
              item.file_quyet_dinh_bkttcp ||
              (nhanBKTTCP ? specialDecisionMapping.CSTDTQ?.file_pdf : null) ||
              (nhanBKTTCP ? item.file_quyet_dinh : null);

            // Tìm bản ghi DanhHieuDonViHangNam hiện tại
            const whereCondition = {
              nam: namValue,
              OR: [
                ...(coQuanDonViId ? [{ co_quan_don_vi_id: coQuanDonViId }] : []),
                ...(donViTrucThuocId ? [{ don_vi_truc_thuoc_id: donViTrucThuocId }] : []),
              ],
            };

            const existingAward = await prisma.danhHieuDonViHangNam.findFirst({
              where: whereCondition,
            });

            const data = {};

            if (item.danh_hieu === 'ĐVQT' || item.danh_hieu === 'ĐVTT') {
              data.danh_hieu = item.danh_hieu;
              data.so_quyet_dinh = soQuyetDinh;
            }
            if (item.danh_hieu === 'BKBQP') {
              data.nhan_bkbqp = nhanBKBQP;
              data.so_quyet_dinh_bkbqp = soQuyetDinhBKBQP;
            }

            if (item.danh_hieu === 'BKTTCP') {
              data.nhan_bkttcp = nhanBKTTCP;
              data.so_quyet_dinh_bkttcp = soQuyetDinhBKTTCP;
            }
            data.status = 'APPROVED';
            data.nguoi_duyet_id = adminId;
            data.ngay_duyet = new Date();
            data.ghi_chu = item.ghi_chu || null;

            let savedAward;
            if (existingAward) {
              savedAward = await prisma.danhHieuDonViHangNam.update({
                where: { id: existingAward.id },
                data: data,
              });
            } else {
              savedAward = await prisma.danhHieuDonViHangNam.create({
                data: {
                  ...(coQuanDonViId && {
                    CoQuanDonVi: { connect: { id: coQuanDonViId } },
                  }),
                  ...(donViTrucThuocId && {
                    DonViTrucThuoc: { connect: { id: donViTrucThuocId } },
                  }),
                  nam: namValue,
                  danh_hieu:
                    item.danh_hieu === 'ĐVQT' || item.danh_hieu === 'ĐVTT' ? item.danh_hieu : null,
                  so_quyet_dinh:
                    item.danh_hieu === 'ĐVQT' || item.danh_hieu === 'ĐVTT' ? soQuyetDinh : null,
                  nhan_bkbqp: nhanBKBQP,
                  so_quyet_dinh_bkbqp: soQuyetDinhBKBQP,
                  nhan_bkttcp: nhanBKTTCP,
                  so_quyet_dinh_bkttcp: soQuyetDinhBKTTCP,
                  status: 'APPROVED',
                  nguoi_tao_id: adminId,
                  nguoi_duyet_id: adminId,
                  ngay_duyet: new Date(),
                  ghi_chu: item.ghi_chu || null,
                },
              });
            }
            importedDanhHieu++;
          } catch (error) {
            errors.push(
              `Lỗi import khen thưởng đơn vị ${item.ten_don_vi || item.don_vi_id}: ${error.message}`
            );
          }
        }
      } else if (proposal.loai_de_xuat === 'CONG_HIEN') {
        // Với đề xuất cống hiến, import vào bảng KhenThuongCongHien
        for (const item of congHienData) {
          try {
            // Kiểm tra có personnel_id không (bắt buộc cho đề xuất cá nhân)
            if (!item.personnel_id) {
              errors.push(`Thiếu personnel_id trong dữ liệu danh hiệu: ${JSON.stringify(item)}`);
              continue;
            }

            // Tìm quân nhân theo personnel_id
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Lấy số quyết định và file từ item hoặc decisions
            // Ưu tiên lấy từ item (đã được Admin chỉnh sửa), sau đó mới fallback về decisions
            const soQuyetDinhDanhHieu =
              item.so_quyet_dinh || decisions.so_quyet_dinh_cong_hien || null;
            const filePdfDanhHieu = item.file_quyet_dinh || pdfPaths.file_pdf_cong_hien || null;

            // Lưu vào cùng năm đề xuất (không phải năm trong item.nam)
            const namLuu = proposal.nam;

            // ============================================
            // XỬ LÝ ĐẶC BIỆT CHO CONG_HIEN
            // Mỗi quân nhân chỉ có 1 danh hiệu cống hiến (không phân biệt năm)
            // Lưu vào bảng KhenThuongCongHien riêng
            // ============================================
            // Lấy thông tin thời gian 3 nhóm từ data_cong_hien (nếu có)
            const thoiGianNhom0_7 = item.thoi_gian_nhom_0_7 || null;
            const thoiGianNhom0_8 = item.thoi_gian_nhom_0_8 || null;
            const thoiGianNhom0_9_1_0 = item.thoi_gian_nhom_0_9_1_0 || null;

            // Kiểm tra xem quân nhân đã có danh hiệu cống hiến chưa
            const existingCongHien = await prisma.khenThuongCongHien.findUnique({
              where: {
                quan_nhan_id: quanNhan.id,
              },
            });

            if (existingCongHien) {
              // Quân nhân đã có danh hiệu cống hiến
              // Chỉ cập nhật nếu hạng mới cao hơn hạng cũ
              const rankOrder = {
                HCBVTQ_HANG_BA: 1,
                HCBVTQ_HANG_NHI: 2,
                HCBVTQ_HANG_NHAT: 3,
              };

              const existingRank = rankOrder[existingCongHien.danh_hieu] || 0;
              const newRank = rankOrder[item.danh_hieu] || 0;

              if (newRank > existingRank) {
                // Hạng mới cao hơn, cập nhật
                await prisma.khenThuongCongHien.update({
                  where: { id: existingCongHien.id },
                  data: {
                    danh_hieu: item.danh_hieu,
                    nam: namLuu, // Cập nhật năm mới
                    cap_bac: item.cap_bac || null,
                    chuc_vu: item.chuc_vu || null,
                    ghi_chu: item.ghi_chu || null,
                    so_quyet_dinh: soQuyetDinhDanhHieu,
                    thoi_gian_nhom_0_7: thoiGianNhom0_7,
                    thoi_gian_nhom_0_8: thoiGianNhom0_8,
                    thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
                  },
                });
                importedDanhHieu++;
                affectedPersonnelIds.add(quanNhan.id);
              } else {
                // Hạng mới thấp hơn hoặc bằng, bỏ qua
                const existingDanhHieuName = getDanhHieuName(existingCongHien.danh_hieu);
                const newDanhHieuName = getDanhHieuName(item.danh_hieu);

                errors.push(
                  `Quân nhân "${quanNhan.ho_ten}" đã có Huân chương Bảo vệ Tổ quốc "${existingDanhHieuName}" (năm ${existingCongHien.nam}). ` +
                    `Không thể lưu danh hiệu "${newDanhHieuName}" vì hạng thấp hơn hoặc bằng.`
                );
              }
            } else {
              // Chưa có danh hiệu cống hiến, tạo mới
              await prisma.khenThuongCongHien.create({
                data: {
                  quan_nhan_id: quanNhan.id,
                  danh_hieu: item.danh_hieu,
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinhDanhHieu,
                  thoi_gian_nhom_0_7: thoiGianNhom0_7,
                  thoi_gian_nhom_0_8: thoiGianNhom0_8,
                  thoi_gian_nhom_0_9_1_0: thoiGianNhom0_9_1_0,
                },
              });
              importedDanhHieu++;
              affectedPersonnelIds.add(quanNhan.id);
            }
          } catch (error) {
            errors.push(
              `Lỗi import Huân chương Bảo vệ Tổ quốc personnel_id ${item.personnel_id || ' '}: ${error.message}`
            );
          }
        }
      } else {
        // ============================================
        // XỬ LÝ CÁC LOẠI ĐỀ XUẤT KHÁC (CA_NHAN_HANG_NAM, DOT_XUAT)
        // ============================================
        // Với đề xuất cá nhân khác, import vào bảng DanhHieuHangNam
        for (const item of danhHieuData) {
          try {
            // Kiểm tra có personnel_id không (bắt buộc cho đề xuất cá nhân)
            if (!item.personnel_id) {
              errors.push(`Thiếu personnel_id trong dữ liệu danh hiệu: ${JSON.stringify(item)}`);
              continue;
            }

            // Tìm quân nhân theo personnel_id
            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Lưu vào cùng năm đề xuất
            const namLuu = proposal.nam;

            // ============================================
            // XỬ LÝ BÌNH THƯỜNG CHO CSTDCS VÀ CSTT
            // ============================================
            // Tự động gán số quyết định và file PDF dựa trên danh_hieu
            // Ưu tiên lấy từ item (đã được Admin chỉnh sửa), sau đó mới fallback về decisionMapping
            let soQuyetDinhDanhHieu = null;
            let filePdfDanhHieu = null;

            // Các loại đề xuất khác
            // Ưu tiên lấy từ item (đã được Admin chỉnh sửa trong data_danh_hieu)
            // Nếu không có trong item, mới lấy từ decisionMapping
            const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
            soQuyetDinhDanhHieu = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
            filePdfDanhHieu = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

            // Quyết định BKBQP và CSTDTQ (từ item hoặc từ special mapping)
            // Nếu có so_quyet_dinh_bkbqp hoặc file_quyet_dinh_bkbqp, tự động set nhan_bkbqp = true
            let soQuyetDinhBKBQP = item.so_quyet_dinh_bkbqp;
            let filePdfBKBQP = item.file_quyet_dinh_bkbqp || null;
            let nhanBKBQP = item.nhan_bkbqp || false;

            // Tự động nhận diện nếu có quyết định BKBQP
            if (soQuyetDinhBKBQP || filePdfBKBQP) {
              nhanBKBQP = true;
            }

            if (nhanBKBQP) {
              soQuyetDinhBKBQP =
                soQuyetDinhBKBQP ||
                specialDecisionMapping.BKBQP.so_quyet_dinh ||
                item.so_quyet_dinh;
              filePdfBKBQP =
                filePdfBKBQP || specialDecisionMapping.BKBQP.file_pdf || item.file_quyet_dinh;
            }

            // Nếu có so_quyet_dinh_cstdtq hoặc file_quyet_dinh_cstdtq, tự động set nhan_cstdtq = true
            let soQuyetDinhCSTDTQ = item.so_quyet_dinh_cstdtq;
            let filePdfCSTDTQ = item.file_quyet_dinh_cstdtq || null;
            let nhanCSTDTQ = item.nhan_cstdtq || false;

            // Tự động nhận diện nếu có quyết định CSTDTQ
            if (soQuyetDinhCSTDTQ || filePdfCSTDTQ) {
              nhanCSTDTQ = true;
            }

            if (nhanCSTDTQ) {
              soQuyetDinhCSTDTQ =
                soQuyetDinhCSTDTQ ||
                specialDecisionMapping.CSTDTQ.so_quyet_dinh ||
                item.so_quyet_dinh;
              filePdfCSTDTQ =
                filePdfCSTDTQ || specialDecisionMapping.CSTDTQ.file_pdf || item.file_quyet_dinh;
            }

            let soQuyetDinhBKTTCP = item.so_quyet_dinh_bkttcp;
            let filePdfBKTTCP = item.file_quyet_dinh_bkttcp || null;
            let nhanBKTTCP = item.nhan_bkttcp || false;

            // Tự động nhận diện nếu có quyết định BKTTCP
            if (soQuyetDinhBKTTCP || filePdfBKTTCP) {
              nhanBKTTCP = true;
            }

            if (nhanBKTTCP) {
              soQuyetDinhBKTTCP =
                soQuyetDinhBKTTCP ||
                specialDecisionMapping.BKTTCP.so_quyet_dinh ||
                item.so_quyet_dinh;
              filePdfBKTTCP =
                filePdfBKTTCP || specialDecisionMapping.BKTTCP.file_pdf || item.file_quyet_dinh;
            }

            const data = {};

            data.cap_bac = item.cap_bac || null;
            data.chuc_vu = item.chuc_vu || null;
            data.ghi_chu = item.ghi_chu || null;

            if (item.danh_hieu === 'CSTT' || item.danh_hieu === 'CSTDCS') {
              data.danh_hieu = item.danh_hieu;
              data.so_quyet_dinh = soQuyetDinhDanhHieu;
            }

            if (item.danh_hieu === 'BKBQP') {
              data.nhan_bkbqp = nhanBKBQP;
              data.so_quyet_dinh_bkbqp = soQuyetDinhBKBQP;
            }

            if (item.danh_hieu === 'CSTDTQ') {
              data.nhan_cstdtq = nhanCSTDTQ;
              data.so_quyet_dinh_cstdtq = soQuyetDinhCSTDTQ;
            }

            if (item.danh_hieu === 'BKTTCP') {
              data.nhan_bkttcp = nhanBKTTCP;
              data.so_quyet_dinh_bkttcp = soQuyetDinhBKTTCP;
            }

            // Upsert vào bảng DanhHieuHangNam
            // file_quyet_dinh đã xóa khỏi schema - file path lấy từ bảng FileQuyetDinh qua so_quyet_dinh
            const savedDanhHieu = await prisma.danhHieuHangNam.upsert({
              where: {
                quan_nhan_id_nam: {
                  quan_nhan_id: quanNhan.id,
                  nam: namLuu,
                },
              },
              update: {
                ...data,
              },
              create: {
                quan_nhan_id: quanNhan.id,
                nam: namLuu,
                cap_bac: item.cap_bac || null,
                chuc_vu: item.chuc_vu || null,
                ghi_chu: item.ghi_chu || null,
                danh_hieu:
                  item.danh_hieu === 'CSTT' || item.danh_hieu === 'CSTDCS' ? item.danh_hieu : null,
                so_quyet_dinh:
                  item.danh_hieu === 'CSTT' || item.danh_hieu === 'CSTDCS'
                    ? soQuyetDinhDanhHieu
                    : null,
                nhan_bkbqp: nhanBKBQP,
                so_quyet_dinh_bkbqp: soQuyetDinhBKBQP,
                nhan_cstdtq: nhanCSTDTQ,
                so_quyet_dinh_cstdtq: soQuyetDinhCSTDTQ,
                nhan_bkttcp: nhanBKTTCP,
                so_quyet_dinh_bkttcp: soQuyetDinhBKTTCP,
              },
            });

            importedDanhHieu++;
            affectedPersonnelIds.add(quanNhan.id); // Track personnel bị ảnh hưởng
          } catch (error) {
            errors.push(
              `Lỗi import danh hiệu personnel_id ${item.personnel_id || 'N/A'}: ${error.message}`
            );
          }
        }
      }

      // ============================================
      // IMPORT NIÊN HẠN (chỉ các hạng HCCSVV)
      // ============================================
      if (proposal.loai_de_xuat === 'NIEN_HAN' && nienHanData && nienHanData.length > 0) {
        for (const item of nienHanData) {
          try {
            if (!item.personnel_id) {
              errors.push(
                `Huy chương Chiến sĩ vẻ vang thiếu personnel_id: ${JSON.stringify(item)}`
              );
              continue;
            }

            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            if (!item.danh_hieu) {
              errors.push(
                `Huy chương Chiến sĩ vẻ vang thiếu danh_hieu cho quân nhân ${quanNhan.id}`
              );
              continue;
            }

            // Chỉ xử lý các hạng HCCSVV
            const allowedDanhHieus = ['HCCSVV_HANG_BA', 'HCCSVV_HANG_NHI', 'HCCSVV_HANG_NHAT'];
            if (allowedDanhHieus.includes(item.danh_hieu)) {
              // Lấy số quyết định và file PDF từ decisionMapping
              const danhHieuDecision = decisionMapping[item.danh_hieu] || {};
              let soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
              let filePdf = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

              const namLuu = proposal.nam;

              // Tính thời gian từ ngày nhập ngũ
              let thoiGian = null;
              if (quanNhan.ngay_nhap_ngu) {
                const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
                const ngayKetThuc = quanNhan.ngay_xuat_ngu
                  ? new Date(quanNhan.ngay_xuat_ngu)
                  : new Date();

                let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
                months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
                if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                  months--;
                }
                months = Math.max(0, months);

                const years = Math.floor(months / 12);
                const remainingMonths = months % 12;
                thoiGian = {
                  total_months: months,
                  years: years,
                  months: remainingMonths,
                  display:
                    months === 0
                      ? '-'
                      : years > 0 && remainingMonths > 0
                        ? `${years} năm ${remainingMonths} tháng`
                        : years > 0
                          ? `${years} năm`
                          : `${remainingMonths} tháng`,
                };
              }

              // Upsert vào bảng KhenThuongHCCSVV (mỗi người có thể có tối đa 3 bản ghi: Hạng Ba, Nhì, Nhất)
              await prisma.khenThuongHCCSVV.upsert({
                where: {
                  quan_nhan_id_danh_hieu: {
                    quan_nhan_id: quanNhan.id,
                    danh_hieu: item.danh_hieu,
                  },
                },
                update: {
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinh,
                  thoi_gian: thoiGian,
                },
                create: {
                  quan_nhan_id: quanNhan.id,
                  danh_hieu: item.danh_hieu,
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinh,
                  thoi_gian: thoiGian,
                },
              });

              importedNienHan++;
              affectedPersonnelIds.add(quanNhan.id);
            }
          } catch (error) {
            errors.push(
              `Lỗi import Huy chương Chiến sĩ vẻ vang personnel_id ${item.personnel_id || 'N/A'}: ${error.message}`
            );
          }
        }
      }

      // ============================================
      // IMPORT HC_QKQT (Huy chương Quân kỳ quyết thắng)
      // ============================================
      if (proposal.loai_de_xuat === 'HC_QKQT' && nienHanData && nienHanData.length > 0) {
        for (const item of nienHanData) {
          try {
            if (!item.personnel_id) {
              errors.push(`HC_QKQT thiếu personnel_id: ${JSON.stringify(item)}`);
              continue;
            }

            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Lấy số quyết định và file PDF từ item hoặc decisionMapping
            const danhHieuDecision = decisionMapping['HC_QKQT'] || {};
            let soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
            let filePdf = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

            const namLuu = proposal.nam;

            // Tính thời gian từ ngày nhập ngũ
            let thoiGian = null;
            if (quanNhan.ngay_nhap_ngu) {
              const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
              const ngayKetThuc = quanNhan.ngay_xuat_ngu
                ? new Date(quanNhan.ngay_xuat_ngu)
                : new Date();

              let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
              months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
              if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                months--;
              }
              months = Math.max(0, months);

              const years = Math.floor(months / 12);
              const remainingMonths = months % 12;
              thoiGian = {
                total_months: months,
                years: years,
                months: remainingMonths,
                display:
                  months === 0
                    ? '-'
                    : years > 0 && remainingMonths > 0
                      ? `${years} năm ${remainingMonths} tháng`
                      : years > 0
                        ? `${years} năm`
                        : `${remainingMonths} tháng`,
              };
            }

            // Kiểm tra xem quân nhân đã có HC_QKQT chưa
            const existingHC_QKQT = await prisma.huanChuongQuanKyQuyetThang.findUnique({
              where: {
                quan_nhan_id: quanNhan.id,
              },
            });

            if (existingHC_QKQT) {
              // Đã có, cập nhật
              await prisma.huanChuongQuanKyQuyetThang.update({
                where: { id: existingHC_QKQT.id },
                data: {
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinh,
                  thoi_gian: thoiGian,
                },
              });
            } else {
              // Chưa có, tạo mới
              await prisma.huanChuongQuanKyQuyetThang.create({
                data: {
                  quan_nhan_id: quanNhan.id,
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinh,
                  thoi_gian: thoiGian,
                },
              });
            }
            importedNienHan++;
            affectedPersonnelIds.add(quanNhan.id);
          } catch (error) {
            errors.push(
              `Lỗi import HC_QKQT personnel_id ${item.personnel_id || 'N/A'}: ${error.message}`
            );
          }
        }
      }

      // ============================================
      // IMPORT KNC_VSNXD_QDNDVN (Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN)
      // ============================================
      if (proposal.loai_de_xuat === 'KNC_VSNXD_QDNDVN' && nienHanData && nienHanData.length > 0) {
        for (const item of nienHanData) {
          try {
            if (!item.personnel_id) {
              errors.push(`KNC_VSNXD_QDNDVN thiếu personnel_id: ${JSON.stringify(item)}`);
              continue;
            }

            const quanNhan = await prisma.quanNhan.findUnique({
              where: { id: item.personnel_id },
            });

            if (!quanNhan) {
              errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
              continue;
            }

            // Lấy số quyết định và file PDF từ item hoặc decisionMapping
            const danhHieuDecision = decisionMapping['KNC_VSNXD_QDNDVN'] || {};
            let soQuyetDinh = item.so_quyet_dinh || danhHieuDecision.so_quyet_dinh || null;
            let filePdf = item.file_quyet_dinh || danhHieuDecision.file_pdf || null;

            const namLuu = proposal.nam;

            // Tính thời gian từ ngày nhập ngũ
            let thoiGian = null;
            if (quanNhan.ngay_nhap_ngu) {
              const ngayNhapNgu = new Date(quanNhan.ngay_nhap_ngu);
              const ngayKetThuc = quanNhan.ngay_xuat_ngu
                ? new Date(quanNhan.ngay_xuat_ngu)
                : new Date();

              let months = (ngayKetThuc.getFullYear() - ngayNhapNgu.getFullYear()) * 12;
              months += ngayKetThuc.getMonth() - ngayNhapNgu.getMonth();
              if (ngayKetThuc.getDate() < ngayNhapNgu.getDate()) {
                months--;
              }
              months = Math.max(0, months);

              const years = Math.floor(months / 12);
              const remainingMonths = months % 12;
              thoiGian = {
                total_months: months,
                years: years,
                months: remainingMonths,
                display:
                  months === 0
                    ? '-'
                    : years > 0 && remainingMonths > 0
                      ? `${years} năm ${remainingMonths} tháng`
                      : years > 0
                        ? `${years} năm`
                        : `${remainingMonths} tháng`,
              };
            }

            // Kiểm tra xem quân nhân đã có KNC_VSNXD_QDNDVN chưa
            const existingKNC = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
              where: {
                quan_nhan_id: quanNhan.id,
              },
            });

            if (existingKNC) {
              // Đã có, cập nhật
              await prisma.kyNiemChuongVSNXDQDNDVN.update({
                where: { id: existingKNC.id },
                data: {
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinh,
                  thoi_gian: thoiGian,
                },
              });
            } else {
              // Chưa có, tạo mới
              await prisma.kyNiemChuongVSNXDQDNDVN.create({
                data: {
                  quan_nhan_id: quanNhan.id,
                  nam: namLuu,
                  cap_bac: item.cap_bac || null,
                  chuc_vu: item.chuc_vu || null,
                  ghi_chu: item.ghi_chu || null,
                  so_quyet_dinh: soQuyetDinh,
                  thoi_gian: thoiGian,
                },
              });
            }
            importedNienHan++;
            affectedPersonnelIds.add(quanNhan.id);
          } catch (error) {
            errors.push(
              `Lỗi import KNC_VSNXD_QDNDVN personnel_id ${item.personnel_id || 'N/A'}: ${
                error.message
              }`
            );
          }
        }
      }

      // ============================================
      // IMPORT THÀNH TÍCH KHOA HỌC
      // ============================================
      for (const item of thanhTichData) {
        try {
          // Chỉ tìm theo ID
          if (!item.personnel_id) {
            errors.push(`Thành tích thiếu personnel_id: ${JSON.stringify(item)}`);
            continue;
          }

          const quanNhan = await prisma.quanNhan.findUnique({
            where: { id: item.personnel_id },
          });

          if (!quanNhan) {
            errors.push(`Không tìm thấy quân nhân với ID: ${item.personnel_id}`);
            continue;
          }

          if (!item.nam) {
            errors.push(`Thành tích thiếu năm cho quân nhân ${quanNhan.id}`);
            continue;
          }

          if (!item.loai || !['DTKH', 'SKKH'].includes(item.loai)) {
            errors.push(
              `Thành tích có loại không hợp lệ cho quân nhân ${quanNhan.id}: ${item.loai}`
            );
            continue;
          }

          if (!item.mo_ta || item.mo_ta.trim() === '') {
            errors.push(`Thành tích thiếu mô tả cho quân nhân ${quanNhan.id}`);
            continue;
          }

          // Lấy số quyết định cho thành tích
          // Ưu tiên lấy từ item, nếu không có thì có thể lấy từ decisions
          const soQuyetDinhThanhTich = item.so_quyet_dinh || null;

          // Create vào bảng ThanhTichKhoaHoc
          // Khi approve đề xuất, tất cả thành tích PHẢI có status = APPROVED (đã được duyệt)
          // file_quyet_dinh đã được xóa khỏi schema - file path được lấy từ bảng FileQuyetDinh qua so_quyet_dinh
          await prisma.thanhTichKhoaHoc.create({
            data: {
              quan_nhan_id: quanNhan.id,
              nam: parseInt(item.nam, 10),
              loai: item.loai,
              mo_ta: item.mo_ta.trim(),
              status: 'APPROVED', // Luôn luôn APPROVED khi approve đề xuất
              chuc_vu: item.chuc_vu || null,
              cap_bac: item.cap_bac || null,
              ghi_chu: item.ghi_chu || null,
              so_quyet_dinh: soQuyetDinhThanhTich,
            },
          });

          importedThanhTich++;
          // Track tất cả personnel để cập nhật hồ sơ hằng năm
          // Khi approve đề xuất, tất cả thành tích đều có status = APPROVED
          affectedPersonnelIds.add(quanNhan.id);
        } catch (error) {
          console.error(
            `❌ Lỗi import thành tích ID ${item.personnel_id || 'N/A'} hoặc CCCD ${
              item.cccd || 'N/A'
            }:`,
            error
          );
          errors.push(
            `Lỗi import thành tích ID ${item.personnel_id || 'N/A'} hoặc CCCD ${
              item.cccd || 'N/A'
            }: ${error.message}`
          );
        }
      }

      // ============================================
      // ĐỒNG BỘ QUYẾT ĐỊNH VÀO BẢNG QUYETDINH KHENTHUONG
      // ============================================
      const decisionsToSync = new Set();

      // Thu thập tất cả số quyết định từ danh hiệu
      for (const item of danhHieuData) {
        if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
        if (item.so_quyet_dinh_bkbqp) decisionsToSync.add(item.so_quyet_dinh_bkbqp);
        if (item.so_quyet_dinh_cstdtq) decisionsToSync.add(item.so_quyet_dinh_cstdtq);
      }

      // Thu thập số quyết định từ thành tích
      for (const item of thanhTichData) {
        if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
      }

      // Thu thập số quyết định cho từng loại đề xuất
      if (decisions.so_quyet_dinh_ca_nhan_hang_nam)
        decisionsToSync.add(decisions.so_quyet_dinh_ca_nhan_hang_nam);
      if (decisions.so_quyet_dinh_don_vi_hang_nam)
        decisionsToSync.add(decisions.so_quyet_dinh_don_vi_hang_nam);
      if (decisions.so_quyet_dinh_nien_han) decisionsToSync.add(decisions.so_quyet_dinh_nien_han);
      if (decisions.so_quyet_dinh_cong_hien) decisionsToSync.add(decisions.so_quyet_dinh_cong_hien);
      if (decisions.so_quyet_dinh_dot_xuat) decisionsToSync.add(decisions.so_quyet_dinh_dot_xuat);
      if (decisions.so_quyet_dinh_nckh) decisionsToSync.add(decisions.so_quyet_dinh_nckh);

      // Lấy thông tin người duyệt (admin hiện tại) một lần
      const adminInfo = await prisma.taiKhoan.findUnique({
        where: { id: adminId },
        include: {
          QuanNhan: {
            select: {
              ho_ten: true,
            },
          },
        },
      });
      const ngayKy = new Date(); // Ngày ký = ngày phê duyệt
      const nguoiKy = adminInfo?.QuanNhan?.ho_ten || adminInfo?.username || 'Chưa cập nhật';

      // Đồng bộ từng quyết định vào bảng FileQuyetDinh
      console.log(`📋 Đồng bộ ${decisionsToSync.size} quyết định vào bảng FileQuyetDinh`);
      for (const soQuyetDinh of decisionsToSync) {
        if (!soQuyetDinh) continue;

        try {
          // Kiểm tra xem đã tồn tại chưa
          const existing = await prisma.fileQuyetDinh.findUnique({
            where: { so_quyet_dinh: soQuyetDinh },
          });

          if (!existing) {
            // Tìm file PDF tương ứng dựa trên loại đề xuất
            let filePath = null;
            const loaiDeXuat = proposal.loai_de_xuat;

            // Map file PDF theo loại đề xuất
            // Ưu tiên kiểm tra số quyết định từ decisions (form upload)
            if (
              loaiDeXuat === 'CA_NHAN_HANG_NAM' &&
              decisions.so_quyet_dinh_ca_nhan_hang_nam === soQuyetDinh
            ) {
              filePath = pdfPaths.file_pdf_ca_nhan_hang_nam;
            } else if (
              loaiDeXuat === 'DON_VI_HANG_NAM' &&
              decisions.so_quyet_dinh_don_vi_hang_nam === soQuyetDinh
            ) {
              filePath = pdfPaths.file_pdf_don_vi_hang_nam;
            } else if (
              loaiDeXuat === 'NIEN_HAN' &&
              decisions.so_quyet_dinh_nien_han === soQuyetDinh
            ) {
              filePath = pdfPaths.file_pdf_nien_han;
            } else if (
              loaiDeXuat === 'CONG_HIEN' &&
              decisions.so_quyet_dinh_cong_hien === soQuyetDinh
            ) {
              filePath = pdfPaths.file_pdf_cong_hien;
            } else if (
              loaiDeXuat === 'DOT_XUAT' &&
              decisions.so_quyet_dinh_dot_xuat === soQuyetDinh
            ) {
              filePath = pdfPaths.file_pdf_dot_xuat;
            } else if (loaiDeXuat === 'NCKH') {
              // Cho NCKH, kiểm tra xem số quyết định có trong thanhTichData hoặc decisions không
              const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
              if (
                (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
                pdfPaths.file_pdf_nckh
              ) {
                filePath = pdfPaths.file_pdf_nckh;
              }
            }

            // Nếu không tìm thấy file PDF từ decisions, thử tìm từ data_danh_hieu hoặc data_thanh_tich
            if (!filePath) {
              // Tìm trong danh hiệu
              const matchingDanhHieu = danhHieuData.find(
                d =>
                  d.so_quyet_dinh === soQuyetDinh ||
                  d.so_quyet_dinh_bkbqp === soQuyetDinh ||
                  d.so_quyet_dinh_cstdtq === soQuyetDinh ||
                  d.so_quyet_dinh_bkttcp === soQuyetDinh
              );
              if (matchingDanhHieu) {
                // Lấy file từ item nếu có
                filePath =
                  matchingDanhHieu.file_quyet_dinh ||
                  matchingDanhHieu.file_quyet_dinh_bkbqp ||
                  matchingDanhHieu.file_quyet_dinh_cstdtq ||
                  matchingDanhHieu.file_quyet_dinh_bkttcp ||
                  null;
              }

              // Nếu vẫn chưa có, tìm trong thành tích
              if (!filePath) {
                const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
                if (matchingThanhTich && matchingThanhTich.file_quyet_dinh) {
                  filePath = matchingThanhTich.file_quyet_dinh;
                }
              }
            }

            // Xác định loại khen thưởng dựa trên loại đề xuất
            let loaiKhenThuong = proposal.loai_de_xuat || 'CA_NHAN_HANG_NAM';

            console.log(
              `✅ Tạo quyết định: ${soQuyetDinh}, loại: ${loaiKhenThuong}, file: ${
                filePath || 'null'
              }`
            );

            await prisma.fileQuyetDinh.create({
              data: {
                so_quyet_dinh: soQuyetDinh,
                nam: proposal.nam,
                ngay_ky: ngayKy,
                nguoi_ky: nguoiKy,
                file_path: filePath,
                loai_khen_thuong: loaiKhenThuong,
                ghi_chu: `Tự động đồng bộ từ đề xuất ${proposalId}`,
              },
            });
          } else {
            // Cập nhật file_path nếu có và chưa có
            if (!existing.file_path) {
              let filePath = null;
              const loaiDeXuat = proposal.loai_de_xuat;

              // Map file PDF theo loại đề xuất (giống logic tạo mới)
              if (
                loaiDeXuat === 'CA_NHAN_HANG_NAM' &&
                decisions.so_quyet_dinh_ca_nhan_hang_nam === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_ca_nhan_hang_nam;
              } else if (
                loaiDeXuat === 'DON_VI_HANG_NAM' &&
                decisions.so_quyet_dinh_don_vi_hang_nam === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_don_vi_hang_nam;
              } else if (
                loaiDeXuat === 'NIEN_HAN' &&
                decisions.so_quyet_dinh_nien_han === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_nien_han;
              } else if (
                loaiDeXuat === 'CONG_HIEN' &&
                decisions.so_quyet_dinh_cong_hien === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_cong_hien;
              } else if (
                loaiDeXuat === 'DOT_XUAT' &&
                decisions.so_quyet_dinh_dot_xuat === soQuyetDinh
              ) {
                filePath = pdfPaths.file_pdf_dot_xuat;
              } else if (loaiDeXuat === 'NCKH') {
                const matchingThanhTich = thanhTichData.find(t => t.so_quyet_dinh === soQuyetDinh);
                if (
                  (matchingThanhTich || decisions.so_quyet_dinh_nckh === soQuyetDinh) &&
                  pdfPaths.file_pdf_nckh
                ) {
                  filePath = pdfPaths.file_pdf_nckh;
                }
              }

              if (filePath) {
                await prisma.fileQuyetDinh.update({
                  where: { so_quyet_dinh: soQuyetDinh },
                  data: { file_path: filePath },
                });
              }
            }
          }
        } catch (error) {
          console.error(`⚠️ Lỗi khi đồng bộ quyết định ${soQuyetDinh}:`, error.message);
          // Không throw error để không làm gián đoạn quá trình approve
        }
      }

      // ============================================
      // KIỂM TRA LỖI TRƯỚC KHI CẬP NHẬT TRẠNG THÁI
      // ============================================
      // Nếu có lỗi khi import, không cho phép phê duyệt
      if (errors.length > 0) {
        throw new Error(
          `Không thể phê duyệt đề xuất do có ${
            errors.length
          } lỗi khi thêm khen thưởng:\n${errors.join('\n')}`
        );
      }

      // ============================================
      // CẬP NHẬT TRẠNG THÁI ĐỀ XUẤT
      // ============================================
      const updateData = {
        status: 'APPROVED',
        nguoi_duyet_id: adminId,
        ngay_duyet: new Date(),
        data_danh_hieu: danhHieuData, // Lưu lại dữ liệu đã chỉnh sửa
        data_thanh_tich: thanhTichData,
        data_nien_han: nienHanData,
        data_cong_hien: congHienData, // Lưu lại dữ liệu cống hiến đã chỉnh sửa
      };

      // Thêm ghi chú nếu có
      if (ghiChu) {
        updateData.ghi_chu = ghiChu;
      }

      await prisma.bangDeXuat.update({
        where: { id: proposalId },
        data: updateData,
      });

      // ============================================
      // TÍNH TOÁN LẠI HỒ SƠ CHO CÁC QUÂN NHÂN/ĐƠN VỊ BỊ ẢNH HƯỞNG
      // - Nếu là CA_NHAN_HANG_NAM: gọi recalculateAnnualProfile (tính hồ sơ hằng năm cá nhân)
      // - Nếu là DON_VI_HANG_NAM: gọi recalculateAnnualUnit (tính hồ sơ hằng năm đơn vị)
      // - Nếu là NIEN_HAN: gọi recalculateTenureProfile (chỉ tính niên hạn HCCSVV)
      // - Nếu là CONG_HIEN: gọi recalculateContributionProfile (chỉ tính cống hiến HCBVTQ)
      // - Các loại khác: gọi recalculateAnnualProfile (tính toàn bộ hồ sơ hằng năm)
      // Đảm bảo tất cả dữ liệu đã được commit trước khi recalculate
      // ============================================
      let recalculateSuccess = 0;
      let recalculateErrors = 0;

      // Đợi một chút để đảm bảo tất cả dữ liệu đã được commit vào database
      // Prisma tự động commit sau mỗi operation, nhưng để chắc chắn
      await new Promise(resolve => setTimeout(resolve, 100));

      // Xử lý riêng cho đề xuất đơn vị hằng năm
      if (proposal.loai_de_xuat === 'DON_VI_HANG_NAM') {
        console.log(`📊 Bắt đầu recalculate hồ sơ đơn vị hằng năm (năm: ${proposal.nam})`);

        // Thu thập danh sách đơn vị bị ảnh hưởng từ danhHieuData
        const affectedUnits = new Set();
        for (const item of danhHieuData) {
          if (item.don_vi_id) {
            affectedUnits.add(item.don_vi_id);
          }
        }

        for (const donViId of affectedUnits) {
          try {
            console.log(`🔄 Đang recalculate hồ sơ đơn vị ID: ${donViId}, năm: ${proposal.nam}...`);

            // Gọi recalculateAnnualUnit với đơn vị ID và năm
            await unitAnnualAwardService.recalculateAnnualUnit(donViId, proposal.nam);

            recalculateSuccess++;
            console.log(`✅ Đã recalculate hồ sơ đơn vị ID: ${donViId}`);
          } catch (recalcError) {
            recalculateErrors++;
            console.error(`❌ Lỗi tính toán hồ sơ cho đơn vị ID ${donViId}:`, recalcError.message);
            console.error(`❌ Stack trace:`, recalcError.stack);
          }
        }
      } else {
        // Xử lý cho các đề xuất cá nhân
        const recalculateType =
          proposal.loai_de_xuat === 'NIEN_HAN'
            ? 'hồ sơ niên hạn (HCCSVV)'
            : proposal.loai_de_xuat === 'CONG_HIEN'
              ? 'hồ sơ cống hiến (HCBVTQ)'
              : 'hồ sơ hằng năm';

        // Log để debug
        console.log(
          `📊 Bắt đầu recalculate ${recalculateType} cho ${affectedPersonnelIds.size} quân nhân (loại đề xuất: ${proposal.loai_de_xuat})`
        );
        if (affectedPersonnelIds.size === 0) {
          console.warn(
            `⚠️ Cảnh báo: Không có quân nhân nào trong affectedPersonnelIds để recalculate!`
          );
        }

        for (const personnelId of affectedPersonnelIds) {
          try {
            console.log(
              `🔄 Đang recalculate ${recalculateType} cho quân nhân ID: ${personnelId}...`
            );

            // Gọi hàm recalculate tương ứng dựa trên loại đề xuất
            if (proposal.loai_de_xuat === 'NIEN_HAN') {
              // Chỉ tính toán lại hồ sơ niên hạn (HCCSVV)
              await profileService.recalculateTenureProfile(personnelId);
            } else if (proposal.loai_de_xuat === 'CONG_HIEN') {
              // Chỉ tính toán lại hồ sơ cống hiến (HCBVTQ)
              await profileService.recalculateContributionProfile(personnelId);
            } else {
              // Chỉ tính toán lại hồ sơ hằng năm
              await profileService.recalculateAnnualProfile(personnelId);
            }

            recalculateSuccess++;
            console.log(`✅ Đã recalculate ${recalculateType} cho quân nhân ID: ${personnelId}`);
          } catch (recalcError) {
            recalculateErrors++;
            console.error(
              `❌ Lỗi tính toán hồ sơ cho quân nhân ID ${personnelId}:`,
              recalcError.message
            );
            console.error(`❌ Stack trace:`, recalcError.stack);
          }
        }
      }

      console.log(
        `📊 Hoàn thành recalculate: ${recalculateSuccess} thành công, ${recalculateErrors} lỗi`
      );

      return {
        message: 'Phê duyệt và import dữ liệu thành công',
        proposal: proposal, // Trả về proposal để gửi thông báo
        affectedPersonnelIds: Array.from(affectedPersonnelIds), // Trả về danh sách quân nhân nhận khen thưởng
        result: {
          don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
          nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
          imported_danh_hieu: importedDanhHieu,
          imported_thanh_tich: importedThanhTich,
          imported_nien_han: importedNienHan,
          total_danh_hieu: danhHieuData.length,
          total_thanh_tich: thanhTichData.length,
          total_nien_han: nienHanData.length,
          errors: errors.length > 0 ? errors : null,
          recalculated_profiles: recalculateSuccess,
          recalculate_errors: recalculateErrors,
        },
      };
    } catch (error) {
      console.error('Approve proposal error:', error);
      throw error;
    }
  }

  /**
   * Lấy file PDF của đề xuất
   * @param {string} filename - Tên file PDF
   * @returns {Promise<Object>} - Đường dẫn file
   */
  async getPdfFile(filename) {
    try {
      const fs = require('fs').promises;

      // Thử tìm file trong storage/proposals (file đính kèm đề xuất)
      const storagePath = path.join(__dirname, '../../storage/proposals');
      let filePath = path.join(storagePath, filename);

      try {
        await fs.access(filePath);
        return {
          filePath,
          filename,
        };
      } catch {
        // Nếu không tìm thấy, thử tìm trong uploads/decisions (file quyết định)
        const decisionsPath = path.join(__dirname, '../../uploads/decisions');
        filePath = path.join(decisionsPath, filename);

        try {
          await fs.access(filePath);
          return {
            filePath,
            filename,
          };
        } catch {
          throw new Error('File PDF không tồn tại');
        }
      }
    } catch (error) {
      console.error('Get PDF file error:', error);
      throw error;
    }
  }

  /**
   * Từ chối đề xuất với lý do
   * @param {number} proposalId - ID của đề xuất
   * @param {string} lyDo - Lý do từ chối
   * @param {number} adminId - ID của Admin từ chối
   * @returns {Promise<Object>} - Kết quả từ chối
   */
  async rejectProposal(proposalId, lyDo, adminId) {
    try {
      // Lấy thông tin đề xuất
      const proposal = await prisma.bangDeXuat.findUnique({
        where: { id: proposalId },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: { QuanNhan: true },
          },
        },
      });

      if (!proposal) {
        throw new Error('Không tìm thấy đề xuất');
      }

      if (proposal.status === 'APPROVED') {
        throw new Error('Không thể từ chối đề xuất đã được phê duyệt');
      }

      if (proposal.status === 'REJECTED') {
        throw new Error('Đề xuất này đã bị từ chối trước đó');
      }

      // Cập nhật trạng thái
      await prisma.bangDeXuat.update({
        where: { id: proposalId },
        data: {
          status: 'REJECTED',
          nguoi_duyet_id: adminId,
          ngay_duyet: new Date(),
          rejection_reason: lyDo,
        },
      });

      return {
        message: 'Từ chối đề xuất thành công',
        proposal: proposal, // Trả về proposal để gửi thông báo
        result: {
          don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
          nguoi_de_xuat: proposal.NguoiDeXuat.QuanNhan?.ho_ten || proposal.NguoiDeXuat.username,
          ly_do: lyDo,
        },
      };
    } catch (error) {
      console.error('Reject proposal error:', error);
      throw error;
    }
  }

  /**
   * Xuất file Excel đề xuất đã được gửi (để Admin download)
   * @param {number} proposalId - ID của đề xuất
   * @returns {Promise<Buffer>} - Buffer của file Excel
   */
  async downloadProposalExcel(proposalId) {
    try {
      const proposal = await prisma.bangDeXuat.findUnique({
        where: { id: proposalId },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: { QuanNhan: true },
          },
        },
      });

      if (!proposal) {
        throw new Error('Không tìm thấy đề xuất');
      }

      const workbook = new ExcelJS.Workbook();

      // Tab 1: Danh hiệu
      const sheetDanhHieu = workbook.addWorksheet('DanhHieuHangNam');
      sheetDanhHieu.columns = [
        { header: 'CCCD', key: 'cccd', width: 15 },
        { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
        { header: 'Năm', key: 'nam', width: 12 },
        { header: 'Danh hiệu', key: 'danh_hieu', width: 15 },
        { header: 'BKBQP', key: 'nhan_bkbqp', width: 10 },
        { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
        { header: 'CSTDTQ', key: 'nhan_cstdtq', width: 10 },
        { header: 'Số QĐ CSTDTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
        { header: 'BKTTCP', key: 'nhan_bkttcp', width: 10 },
        { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
      ];

      // Style header
      sheetDanhHieu.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      sheetDanhHieu.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' },
      };

      // Format cột CCCD thành Text
      sheetDanhHieu.getColumn(1).numFmt = '@';

      const danhHieuData = proposal.data_danh_hieu || [];
      danhHieuData.forEach(item => {
        sheetDanhHieu.addRow({
          cccd: item.cccd,
          ho_ten: item.ho_ten,
          nam: item.nam,
          danh_hieu: item.danh_hieu,
          nhan_bkbqp: item.nhan_bkbqp ? 'X' : '',
          so_quyet_dinh_bkbqp: item.so_quyet_dinh_bkbqp || '',
          nhan_cstdtq: item.nhan_cstdtq ? 'X' : '',
          so_quyet_dinh_cstdtq: item.so_quyet_dinh_cstdtq || '',
          nhan_bkttcp: item.nhan_bkttcp ? 'X' : '',
          so_quyet_dinh_bkttcp: item.so_quyet_dinh_bkttcp || '',
        });
      });

      // Tab 2: Thành tích
      const sheetThanhTich = workbook.addWorksheet('ThanhTichKhoaHoc');
      sheetThanhTich.columns = [
        { header: 'CCCD', key: 'cccd', width: 15 },
        { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
        { header: 'Năm', key: 'nam', width: 12 },
        { header: 'Loại', key: 'loai', width: 10 },
        { header: 'Mô tả', key: 'mo_ta', width: 50 },
        { header: 'Trạng thái', key: 'status', width: 15 },
      ];

      sheetThanhTich.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      sheetThanhTich.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFED7D31' },
      };

      // Format cột CCCD thành Text
      sheetThanhTich.getColumn(1).numFmt = '@';

      const thanhTichData = proposal.data_thanh_tich || [];
      thanhTichData.forEach(item => {
        sheetThanhTich.addRow({
          cccd: item.cccd,
          ho_ten: item.ho_ten,
          nam: item.nam,
          loai: item.loai,
          mo_ta: item.mo_ta,
          status: item.status,
        });
      });

      return await workbook.xlsx.writeBuffer();
    } catch (error) {
      console.error('Download proposal Excel error:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả danh hiệu hằng năm (để Admin quản lý)
   * @param {Object} filters - Bộ lọc (don_vi_id, nam, danh_hieu)
   * @param {number} page - Trang
   * @param {number} limit - Số lượng mỗi trang
   * @returns {Promise<Object>} - Danh sách danh hiệu
   */
  async getAllAwards(filters = {}, page = 1, limit = 50) {
    try {
      const { don_vi_id, nam, danh_hieu } = filters;
      const skip = (page - 1) * limit;

      const where = {};
      if (nam) where.nam = parseInt(nam);
      if (danh_hieu) where.danh_hieu = danh_hieu;

      const [awards, total] = await Promise.all([
        prisma.danhHieuHangNam.findMany({
          where,
          include: {
            QuanNhan: {
              include: {
                CoQuanDonVi: true,
                DonViTrucThuoc: {
                  include: {
                    CoQuanDonVi: true,
                  },
                },
                ChucVu: true,
              },
            },
          },
          skip,
          take: parseInt(limit),
          orderBy: [{ nam: 'desc' }, { QuanNhan: { ho_ten: 'asc' } }],
        }),
        prisma.danhHieuHangNam.count({ where }),
      ]);

      // Lọc theo đơn vị nếu có
      let filteredAwards = awards;
      if (don_vi_id) {
        filteredAwards = awards.filter(
          a => (a.QuanNhan.co_quan_don_vi_id || a.QuanNhan.don_vi_truc_thuoc_id) === don_vi_id
        );
      }

      // Lấy thông tin NCKH cho từng quân nhân trong năm đó
      const awardsWithNCKH = await Promise.all(
        filteredAwards.map(async a => {
          // Lấy NCKH của quân nhân trong năm này
          const thanhTichList = await prisma.thanhTichKhoaHoc.findMany({
            where: {
              quan_nhan_id: a.QuanNhan.id,
              nam: a.nam,
            },
            select: {
              id: true,
              loai: true,
              mo_ta: true,
              status: true,
            },
          });
          return {
            id: a.id,
            cccd: a.QuanNhan.cccd,
            ho_ten: a.QuanNhan.ho_ten,
            don_vi: (a.QuanNhan.DonViTrucThuoc || a.QuanNhan.CoQuanDonVi)?.ten_don_vi || '-',
            chuc_vu: a.chuc_vu,
            cap_bac: a.cap_bac,
            nam: a.nam,
            danh_hieu: a.danh_hieu,
            nhan_bkbqp: a.nhan_bkbqp,
            so_quyet_dinh_bkbqp: a.so_quyet_dinh_bkbqp,
            nhan_cstdtq: a.nhan_cstdtq,
            so_quyet_dinh_cstdtq: a.so_quyet_dinh_cstdtq,
            nhan_bkttcp: a.nhan_bkttcp,
            so_quyet_dinh_bkttcp: a.so_quyet_dinh_bkttcp,
            thanh_tich_khoa_hoc: thanhTichList,
          };
        })
      );

      return {
        awards: awardsWithNCKH,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Get all awards error:', error);
      throw error;
    }
  }

  /**
   * Xuất file Excel tổng hợp tất cả khen thưởng
   * @param {Object} filters - Bộ lọc
   * @returns {Promise<Buffer>} - Buffer của file Excel
   */
  async exportAllAwardsExcel(filters = {}) {
    try {
      const { don_vi_id, nam, danh_hieu } = filters;
      const where = {};
      if (nam) where.nam = parseInt(nam);
      if (danh_hieu) where.danh_hieu = danh_hieu;

      const awards = await prisma.danhHieuHangNam.findMany({
        where,
        include: {
          QuanNhan: {
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
              ChucVu: true,
            },
          },
        },
        orderBy: [{ nam: 'desc' }, { QuanNhan: { ho_ten: 'asc' } }],
      });

      let filteredAwards = awards;
      if (don_vi_id) {
        filteredAwards = awards.filter(a => a.QuanNhan.don_vi_id === don_vi_id);
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Danh Sách Khen Thưởng');

      sheet.columns = [
        { header: 'STT', key: 'stt', width: 8 },
        { header: 'CCCD', key: 'cccd', width: 15 },
        { header: 'Họ và Tên', key: 'ho_ten', width: 30 },
        { header: 'Đơn Vị', key: 'don_vi', width: 25 },
        { header: 'Chức Vụ', key: 'chuc_vu', width: 25 },
        { header: 'Năm', key: 'nam', width: 10 },
        { header: 'Danh Hiệu', key: 'danh_hieu', width: 15 },
        { header: 'BKBQP', key: 'bkbqp', width: 10 },
        { header: 'Số QĐ BKBQP', key: 'so_qd_bkbqp', width: 20 },
        { header: 'CSTĐTQ', key: 'cstdtq', width: 10 },
        { header: 'Số QĐ CSTĐTQ', key: 'so_qd_cstdtq', width: 20 },
      ];

      // Style header
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Format cột CCCD thành Text
      sheet.getColumn(2).numFmt = '@'; // CCCD là cột thứ 2 (STT là cột 1)

      filteredAwards.forEach((award, index) => {
        sheet.addRow({
          stt: index + 1,
          cccd: award.QuanNhan.cccd,
          ho_ten: award.QuanNhan.ho_ten,
          don_vi: award.QuanNhan.DonVi.ten_don_vi,
          chuc_vu: award.QuanNhan.ChucVu.ten_chuc_vu,
          nam: award.nam,
          danh_hieu: award.danh_hieu || '',
          bkbqp: award.nhan_bkbqp ? 'X' : '',
          so_qd_bkbqp: award.so_quyet_dinh_bkbqp || '',
          cstdtq: award.nhan_cstdtq ? 'X' : '',
          so_qd_cstdtq: award.so_quyet_dinh_cstdtq || '',
          bkttcp: award.nhan_bkttcp ? 'X' : '',
          so_qd_bkttcp: award.so_quyet_dinh_bkttcp || '',
        });
      });

      return await workbook.xlsx.writeBuffer();
    } catch (error) {
      console.error('Export all awards Excel error:', error);
      throw error;
    }
  }

  /**
   * Xuất file mẫu Excel để import khen thưởng
   * @returns {Promise<Buffer>} - Buffer của file Excel mẫu
   */
  async exportAwardsTemplate() {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('KhenThuong');

      sheet.columns = [
        { header: 'CCCD (Bắt buộc)', key: 'cccd', width: 15 },
        { header: 'Năm (Bắt buộc)', key: 'nam', width: 12 },
        { header: 'Danh Hiệu (CSTDCS/CSTT)', key: 'danh_hieu', width: 20 },
        { header: 'BKBQP (Đánh X)', key: 'nhan_bkbqp', width: 15 },
        { header: 'Số QĐ BKBQP', key: 'so_quyet_dinh_bkbqp', width: 20 },
        { header: 'CSTĐTQ (Đánh X)', key: 'nhan_cstdtq', width: 15 },
        { header: 'Số QĐ CSTĐTQ', key: 'so_quyet_dinh_cstdtq', width: 20 },
        { header: 'BKTTCP (Đánh X)', key: 'nhan_bkttcp', width: 15 },
        { header: 'Số QĐ BKTTCP', key: 'so_quyet_dinh_bkttcp', width: 20 },
      ];

      // Style header
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' },
      };
      sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Format cột CCCD thành Text (để giữ số 0 đầu tiên)
      sheet.getColumn(1).numFmt = '@';

      // Thêm 1 row mẫu
      sheet.addRow({
        cccd: '001234567890',
        nam: 2024,
        danh_hieu: 'CSTDCS',
        nhan_bkbqp: 'X',
        so_quyet_dinh_bkbqp: '123/QĐ-BQP',
        nhan_cstdtq: '',
        so_quyet_dinh_cstdtq: '',
        nhan_bkttcp: 'X',
        so_quyet_dinh_bkttcp: '456/QĐ-BQP',
      });

      return await workbook.xlsx.writeBuffer();
    } catch (error) {
      console.error('Export awards template error:', error);
      throw error;
    }
  }

  /**
   * Import khen thưởng từ file Excel
   * @param {Buffer} excelBuffer - Buffer của file Excel
   * @returns {Promise<Object>} - Kết quả import
   */
  async importAwards(excelBuffer, adminId) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(excelBuffer);

      const sheet = workbook.getWorksheet('KhenThuong');
      if (!sheet) {
        throw new Error('Không tìm thấy sheet "KhenThuong" trong file Excel');
      }

      const awards = [];
      const errors = [];
      const importedUnitsMap = new Map(); // Track các đơn vị đã import

      // Đọc từ row 2 (bỏ qua header)
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const cccd = this.parseCCCD(row.getCell(1).value);
        const nam = parseInt(row.getCell(2).value);
        const danh_hieu = row.getCell(3).value?.toString().trim() || null;
        const nhan_bkbqp = row.getCell(4).value?.toString().toUpperCase() === 'X';
        const so_quyet_dinh_bkbqp = row.getCell(5).value?.toString().trim() || null;
        const nhan_cstdtq = row.getCell(6).value?.toString().toUpperCase() === 'X';
        const so_quyet_dinh_cstdtq = row.getCell(7).value?.toString().trim() || null;
        const nhan_bkttcp = row.getCell(8).value?.toString().toUpperCase() === 'X';
        const so_quyet_dinh_bkttcp = row.getCell(9).value?.toString().trim() || null;

        // Validate
        if (!cccd || !nam) {
          errors.push(`Row ${rowNumber}: CCCD và Năm là bắt buộc`);
          return;
        }

        awards.push({
          cccd,
          nam,
          danh_hieu,
          nhan_bkbqp,
          so_quyet_dinh_bkbqp,
          nhan_cstdtq,
          so_quyet_dinh_cstdtq,
          nhan_bkttcp,
          so_quyet_dinh_bkttcp,
        });
      });

      if (errors.length > 0) {
        throw new Error(`Lỗi validate dữ liệu: ${errors.join(', ')}`);
      }

      // Import vào database với validation
      let imported = 0;
      const importErrors = [];
      const importWarnings = [];
      const affectedPersonnelIds = new Set(); // Track quân nhân bị ảnh hưởng

      for (const award of awards) {
        try {
          // Tìm quân nhân theo CCCD
          const quanNhan = await prisma.quanNhan.findUnique({
            where: { cccd: award.cccd },
            include: {
              CoQuanDonVi: true,
              DonViTrucThuoc: {
                include: {
                  CoQuanDonVi: true,
                },
              },
              DanhHieuHangNam: {
                orderBy: { nam: 'asc' },
              },
              ThanhTichKhoaHoc: {
                where: { status: 'APPROVED' },
              },
            },
          });

          if (!quanNhan) {
            importErrors.push(`CCCD ${award.cccd}: Không tìm thấy quân nhân`);
            continue;
          }

          // ============================================
          // VALIDATION LOGIC NGHIỆP VỤ
          // ============================================
          const cstdcsLienTuc = this.calculateContinuousCSTDCS(quanNhan.DanhHieuHangNam, award.nam);
          const nckhCount = quanNhan.ThanhTichKhoaHoc.length;

          // Kiểm tra BKBQP
          if (award.nhan_bkbqp && cstdcsLienTuc < 2) {
            importWarnings.push(
              `CCCD ${
                award.cccd
              }: Đề xuất BKBQP nhưng chỉ có ${cstdcsLienTuc}/2 năm CSTDCS liên tục. Thiếu ${
                2 - cstdcsLienTuc
              } năm.`
            );
          }

          // Kiểm tra CSTDTQ
          if (award.nhan_cstdtq) {
            if (cstdcsLienTuc < 3) {
              importWarnings.push(
                `CCCD ${
                  award.cccd
                }: Đề xuất CSTDTQ nhưng chỉ có ${cstdcsLienTuc}/3 năm CSTDCS liên tục. Thiếu ${
                  3 - cstdcsLienTuc
                } năm.`
              );
            } else if (nckhCount === 0) {
              importWarnings.push(
                `CCCD ${award.cccd}: Đề xuất CSTDTQ nhưng chưa có ĐTKH/SKKH được duyệt.`
              );
            }
          }

          if (award.nhan_bkttcp) {
            if (cstdcsLienTuc < 7) {
              importWarnings.push(
                `CCCD ${
                  award.cccd
                }: Đề xuất BKTTCP nhưng chỉ có ${cstdcsLienTuc}/7 năm CSTDCS liên tục. Thiếu ${
                  7 - cstdcsLienTuc
                } năm.`
              );
            } else if (nckhCount === 0) {
              importWarnings.push(
                `CCCD ${award.cccd}: Đề xuất BKTTCP nhưng chưa có ĐTKH/SKKH được duyệt.`
              );
            }
          }

          // Upsert vào bảng DanhHieuHangNam
          await prisma.danhHieuHangNam.upsert({
            where: {
              quan_nhan_id_nam: {
                quan_nhan_id: quanNhan.id,
                nam: award.nam,
              },
            },
            update: {
              danh_hieu: award.danh_hieu,
              nhan_bkbqp: award.nhan_bkbqp,
              so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp,
              nhan_cstdtq: award.nhan_cstdtq,
              so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq,
              nhan_bkttcp: award.nhan_bkttcp,
              so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp,
            },
            create: {
              quan_nhan_id: quanNhan.id,
              nam: award.nam,
              danh_hieu: award.danh_hieu,
              nhan_bkbqp: award.nhan_bkbqp,
              so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp,
              nhan_cstdtq: award.nhan_cstdtq,
              so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq,
              nhan_bkttcp: award.nhan_bkttcp,
              so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp,
            },
          });

          // Track đơn vị đã import để gửi thông báo
          const unitKey = `${quanNhan.don_vi_id}_${award.nam}`;
          if (!importedUnitsMap.has(unitKey)) {
            importedUnitsMap.set(unitKey, {
              don_vi_id: quanNhan.don_vi_id,
              don_vi_name: quanNhan.DonVi.ten_don_vi,
              nam: award.nam,
              award_type: 'Danh hiệu',
            });
          }

          imported++;
          affectedPersonnelIds.add(quanNhan.id); // Track personnel bị ảnh hưởng
        } catch (error) {
          importErrors.push(`CCCD ${award.cccd}: ${error.message}`);
        }
      }

      // ============================================
      // TÍNH TOÁN LẠI HỒ SƠ HẰNG NĂM CHO CÁC QUÂN NHÂN BỊ ẢNH HƯỞNG
      // ============================================
      let recalculateSuccess = 0;
      let recalculateErrors = 0;

      for (const personnelId of affectedPersonnelIds) {
        try {
          await profileService.recalculateAnnualProfile(personnelId);
          recalculateSuccess++;
        } catch (recalcError) {
          recalculateErrors++;
          console.error(
            `❌ Lỗi tính toán hồ sơ cho quân nhân ID ${personnelId}:`,
            recalcError.message
          );
        }
      }

      return {
        message:
          importWarnings.length > 0
            ? `Đã thêm thành công thành công ${imported} bản ghi nhưng có ${importWarnings.length} cảnh báo về điều kiện khen thưởng.`
            : 'Đã thêm khen thưởng thành công',
        importedUnits: Array.from(importedUnitsMap.values()), // Danh sách đơn vị để gửi thông báo
        result: {
          total: awards.length,
          imported,
          failed: awards.length - imported,
          errors: importErrors.length > 0 ? importErrors : null,
          warnings: importWarnings.length > 0 ? importWarnings : null,
          recalculated_profiles: recalculateSuccess,
          recalculate_errors: recalculateErrors,
        },
      };
    } catch (error) {
      console.error('Import awards error:', error);
      throw error;
    }
  }

  /**
   * Xóa đề xuất (chỉ Manager có thể xóa đề xuất của chính mình, và chỉ khi status = PENDING)
   * @param {number} proposalId - ID của đề xuất
   * @param {number} userId - ID của tài khoản
   * @param {string} userRole - Role của user
   * @returns {Promise<Object>} - Kết quả xóa
   */
  async deleteProposal(proposalId, userId, userRole) {
    try {
      const proposal = await prisma.bangDeXuat.findUnique({
        where: { id: proposalId },
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: true,
            },
          },
          NguoiDeXuat: {
            include: {
              QuanNhan: true,
            },
          },
        },
      });

      if (!proposal) {
        throw new Error('Không tìm thấy đề xuất');
      }

      // Kiểm tra quyền: Manager chỉ có thể xóa đề xuất của chính mình
      if (userRole === ROLES.MANAGER) {
        if (proposal.nguoi_de_xuat_id !== userId) {
          throw new Error('Bạn chỉ có thể xóa đề xuất của chính mình');
        }
        // Manager chỉ có thể xóa đề xuất chưa được duyệt
        if (proposal.status !== 'PENDING') {
          throw new Error('Chỉ có thể xóa đề xuất đang chờ duyệt (PENDING)');
        }
      }
      // ADMIN có thể xóa bất kỳ đề xuất nào

      // File PDF đã được lưu trong files_attached, không cần xóa riêng

      // Xóa proposal
      await prisma.bangDeXuat.delete({
        where: { id: proposalId },
      });

      return {
        message: 'Đã xóa đề xuất thành công',
        proposal: {
          id: proposal.id,
          don_vi: (proposal.DonViTrucThuoc || proposal.CoQuanDonVi)?.ten_don_vi || '-',
          status: proposal.status,
        },
      };
    } catch (error) {
      console.error('Delete proposal error:', error);
      throw error;
    }
  }

  /**
   * Thống kê khen thưởng theo loại
   * @returns {Promise<Object>} - Thống kê theo từng loại khen thưởng
   */
  async getAwardsStatistics() {
    try {
      const { prisma } = require('../models');

      // 1. Thống kê từ FileQuyetDinh (quyết định đã được lưu)
      const decisionsByType = await prisma.fileQuyetDinh.groupBy({
        by: ['loai_khen_thuong'],
        where: {
          loai_khen_thuong: {
            not: null,
          },
        },
        _count: {
          id: true,
        },
      });

      // 2. Thống kê từ BangDeXuat (đề xuất)
      const proposalsByType = await prisma.bangDeXuat.groupBy({
        by: ['loai_de_xuat'],
        _count: {
          id: true,
        },
      });

      // 3. Thống kê DanhHieuHangNam (Cá nhân Hằng năm) - không bao gồm cống hiến
      const danhHieuHangNamCount = await prisma.danhHieuHangNam.count({
        where: {
          danh_hieu: {
            not: null,
            notIn: ['HCBVTQ_HANG_BA', 'HCBVTQ_HANG_NHI', 'HCBVTQ_HANG_NHAT'],
          },
        },
      });

      // 3b. Thống kê KhenThuongCongHien (Cống hiến)
      const congHienCount = await prisma.khenThuongCongHien.count();

      // 3c. Thống kê KhenThuongHCCSVV (HCCSVV các hạng)
      const hccsvvCount = await prisma.khenThuongHCCSVV.count();

      // 3d. Thống kê HuanChuongQuanKyQuyetThang (HC_QKQT)
      const hcQuanCongCount = await prisma.huanChuongQuanKyQuyetThang.count();

      // 3e. Thống kê KyNiemChuongVSNXDQDNDVN (KNC_VSNXD_QDNDVN)
      const hcVSNXDCount = await prisma.kyNiemChuongVSNXDQDNDVN.count();

      // 4. Thống kê ThanhTichKhoaHoc (ĐTKH/SKKH)
      const thanhTichKhoaHocCount = await prisma.thanhTichKhoaHoc.count({
        where: {
          status: 'APPROVED',
        },
      });

      // 5. Thống kê DanhHieuDonViHangNam (Đơn vị Hằng năm)
      const donViHangNamCount = await prisma.danhHieuDonViHangNam.count({
        where: {
          danh_hieu: {
            not: null,
          },
        },
      });

      // Tạo map từ decisions
      const decisionsMap = {};
      decisionsByType.forEach(item => {
        decisionsMap[item.loai_khen_thuong] = item._count.id;
      });

      // Tạo map từ proposals
      const proposalsMap = {};
      proposalsByType.forEach(item => {
        proposalsMap[item.loai_de_xuat] = item._count.id;
      });

      // Tổng hợp thống kê
      const statistics = {
        CA_NHAN_HANG_NAM: {
          quyet_dinh: decisionsMap['CA_NHAN_HANG_NAM'] || 0,
          de_xuat: proposalsMap['CA_NHAN_HANG_NAM'] || 0,
          danh_hieu: danhHieuHangNamCount,
        },
        DON_VI_HANG_NAM: {
          quyet_dinh: decisionsMap['DON_VI_HANG_NAM'] || 0,
          de_xuat: proposalsMap['DON_VI_HANG_NAM'] || 0,
          don_vi: donViHangNamCount,
        },
        NIEN_HAN: {
          quyet_dinh: decisionsMap['NIEN_HAN'] || 0,
          de_xuat: proposalsMap['NIEN_HAN'] || 0,
          khen_thuong: hccsvvCount,
        },
        HC_QKQT: {
          quyet_dinh: decisionsMap['HC_QKQT'] || 0,
          de_xuat: proposalsMap['HC_QKQT'] || 0,
          khen_thuong: hcQuanCongCount,
        },
        KNC_VSNXD_QDNDVN: {
          quyet_dinh: decisionsMap['KNC_VSNXD_QDNDVN'] || 0,
          de_xuat: proposalsMap['KNC_VSNXD_QDNDVN'] || 0,
          khen_thuong: hcVSNXDCount,
        },
        CONG_HIEN: {
          quyet_dinh: decisionsMap['CONG_HIEN'] || 0,
          de_xuat: proposalsMap['CONG_HIEN'] || 0,
          khen_thuong: congHienCount,
        },
        DOT_XUAT: {
          quyet_dinh: decisionsMap['DOT_XUAT'] || 0,
          de_xuat: proposalsMap['DOT_XUAT'] || 0,
        },
        NCKH: {
          quyet_dinh: decisionsMap['NCKH'] || 0,
          de_xuat: proposalsMap['NCKH'] || 0,
          thanh_tich: thanhTichKhoaHocCount,
        },
      };

      return statistics;
    } catch (error) {
      console.error('Get awards statistics error:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra xem quân nhân đã có đề xuất cùng năm và cùng danh hiệu chưa
   * @param {string} personnelId - ID quân nhân
   * @param {number} nam - Năm đề xuất
   * @param {string} danhHieu - Danh hiệu đề xuất
   * @param {string} proposalType - Loại đề xuất
   * @returns {Promise<Object>} - { exists: boolean, message?: string }
   */
  async checkDuplicateAward(
    personnelId,
    nam,
    danhHieu,
    proposalType,
    status = null,
    excludeProposalId = null
  ) {
    try {
      const { prisma } = require('../models');

      // CA_NHAN_HANG_NAM: Kiểm tra trong BangDeXuat
      if (proposalType === 'CA_NHAN_HANG_NAM') {
        // const danhHieuList = await prisma.danhHieuHangNam.findMany({
        //   where: {
        //     quan_nhan_id: personnelId,
        //     nam: parseInt(nam),
        //   },
        // });
        // danhHieuList.filter(dh => {
        //   if (danhHieu === 'CSTDCS') {
        //     return dh.danh_hieu === 'CSTDCS';
        //   }
        //   if (danhHieu === 'CSTT') {
        //     return dh.danh_hieu === 'CSTT';
        //   }
        //   if (danhHieu === 'BKBQP') {
        //     return dh.nhan_bkbqp === true;
        //   }
        //   if (danhHieu === 'CSTDTQ') {
        //     return dh.nhan_cstdtq === true;
        //   }
        //   if (danhHieu === 'BKTTCP') {
        //     return dh.nhan_bkttcp === true;
        //   }
        // });
        // if (danhHieuList.length > 0) {
        //   return {
        //     exists: true,
        //     message: `Quân nhân đã có danh hiệu ${danhHieu} cho năm ${nam}`,
        //     status: 'APPROVED',
        //   };
        // }

        const proposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'CA_NHAN_HANG_NAM',
            nam: parseInt(nam),
            status: status ? status : { not: 'REJECTED' },
            ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
          },
        });

        // tìm trong data_danh_hieu của từng proposal
        const existing = proposals.find(p => {
          const dataDanhHieu = p.data_danh_hieu || [];
          return dataDanhHieu.some(
            item => item.personnel_id === personnelId && item.danh_hieu === danhHieu
          );
        });

        if (existing) {
          return {
            exists: true,
            message: `Quân nhân đã có đề xuất danh hiệu ${getDanhHieuName(
              danhHieu
            )} cho năm ${nam}`,
            status: existing.status,
          };
        }
      }

      // NIEN_HAN với HCCSVV: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
      if (proposalType === 'NIEN_HAN' && danhHieu?.startsWith('HCCSVV_')) {
        // Kiểm tra bản ghi khen thưởng thực tế trong bảng danh hiệu
        const actualAward = await prisma.khenThuongHCCSVV.findFirst({
          where: {
            quan_nhan_id: personnelId,
            danh_hieu: danhHieu,
          },
        });
        if (actualAward) {
          return {
            exists: true,
            message: `Quân nhân đã có ${getDanhHieuName(danhHieu)} (năm ${actualAward.nam || nam})`,
          };
        }

        // Kiểm tra đề xuất PENDING (đang chờ duyệt) để tránh trùng lặp
        const pendingProposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'NIEN_HAN',
            nam: parseInt(nam),
            status: 'PENDING',
            ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
          },
        });
        const pendingExisting = pendingProposals.find(p => {
          const dataNienHan = p.data_nien_han || [];
          return dataNienHan.some(
            item => item.personnel_id === personnelId && item.danh_hieu === danhHieu
          );
        });
        if (pendingExisting) {
          return {
            exists: true,
            message: `Quân nhân đang có đề xuất ${getDanhHieuName(danhHieu)} chờ duyệt (năm ${pendingExisting.nam})`,
          };
        }
      }

      // HC_QKQT: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
      if (proposalType === 'HC_QKQT') {
        // Kiểm tra bản ghi khen thưởng thực tế trong bảng danh hiệu
        const actualAward = await prisma.huanChuongQuanKyQuyetThang.findFirst({
          where: { quan_nhan_id: personnelId },
        });
        if (actualAward) {
          return {
            exists: true,
            message: `Quân nhân đã có Huy chương Quân kỳ quyết thắng (năm ${actualAward.nam || nam})`,
          };
        }

        // Kiểm tra đề xuất PENDING (đang chờ duyệt) để tránh trùng lặp
        const pendingProposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'HC_QKQT',
            nam: parseInt(nam),
            status: 'PENDING',
            ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
          },
        });
        const pendingExisting = pendingProposals.find(p => {
          const dataNienHan = p.data_nien_han || [];
          return dataNienHan.some(item => item.personnel_id === personnelId);
        });
        if (pendingExisting) {
          return {
            exists: true,
            message: `Quân nhân đang có đề xuất Huy chương Quân kỳ quyết thắng chờ duyệt (năm ${pendingExisting.nam})`,
          };
        }
      }

      // KNC_VSNXD_QDNDVN: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
      if (proposalType === 'KNC_VSNXD_QDNDVN') {
        // Kiểm tra bản ghi khen thưởng thực tế trong bảng danh hiệu
        const actualAward = await prisma.kyNiemChuongVSNXDQDNDVN.findFirst({
          where: { quan_nhan_id: personnelId },
        });
        if (actualAward) {
          return {
            exists: true,
            message: `Quân nhân đã có Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN (năm ${actualAward.nam || nam})`,
          };
        }

        // Kiểm tra đề xuất PENDING (đang chờ duyệt) để tránh trùng lặp
        const pendingProposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'KNC_VSNXD_QDNDVN',
            nam: parseInt(nam),
            status: 'PENDING',
            ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
          },
        });
        const pendingExisting = pendingProposals.find(p => {
          const dataNienHan = p.data_nien_han || [];
          return dataNienHan.some(item => item.personnel_id === personnelId);
        });
        if (pendingExisting) {
          return {
            exists: true,
            message: `Quân nhân đang có đề xuất Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN chờ duyệt (năm ${pendingExisting.nam})`,
          };
        }
      }

      // CONG_HIEN: Kiểm tra bảng danh hiệu thực tế + đề xuất PENDING
      if (proposalType === 'CONG_HIEN') {
        // Kiểm tra bản ghi khen thưởng thực tế trong bảng danh hiệu
        const actualAward = await prisma.khenThuongCongHien.findFirst({
          where: { quan_nhan_id: personnelId },
        });
        if (actualAward) {
          return {
            exists: true,
            message: `Quân nhân đã có ${getDanhHieuName(actualAward.danh_hieu || danhHieu)} (năm ${actualAward.nam || nam})`,
          };
        }

        // Kiểm tra đề xuất PENDING (đang chờ duyệt) để tránh trùng lặp
        const pendingProposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'CONG_HIEN',
            nam: parseInt(nam),
            status: 'PENDING',
            ...(excludeProposalId ? { id: { not: excludeProposalId } } : {}),
          },
        });
        const pendingExisting = pendingProposals.find(p => {
          const dataCongHien = p.data_cong_hien || [];
          return dataCongHien.some(item => item.personnel_id === personnelId);
        });
        if (pendingExisting) {
          const dataCongHien = pendingExisting.data_cong_hien || [];
          const congHienItem = dataCongHien.find(item => item.personnel_id === personnelId);
          const pendingDanhHieu = congHienItem?.danh_hieu || danhHieu;
          return {
            exists: true,
            message: `Quân nhân đang có đề xuất ${getDanhHieuName(pendingDanhHieu)} chờ duyệt (năm ${pendingExisting.nam})`,
          };
        }
      }

      return { exists: false };
    } catch (error) {
      console.error('Check duplicate award error:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra xem đơn vị đã có đề xuất trùng với năm và danh hiệu chưa
   * @param {string} donViId - ID đơn vị
   * @param {number} nam - Năm
   * @param {string} danhHieu - Danh hiệu (ĐVQT, ĐVTT, BKBQP, BKTTCP)
   * @param {string} proposalType - Loại đề xuất (DON_VI_HANG_NAM)
   * @returns {Promise<Object>} - { exists: boolean, message?: string }
   */
  async checkDuplicateUnitAward(donViId, nam, danhHieu, proposalType) {
    try {
      const { prisma } = require('../models');
      // DON_VI_HANG_NAM: Kiểm tra trong BangDeXuat
      if (proposalType === 'DON_VI_HANG_NAM') {
        const proposals = await prisma.bangDeXuat.findMany({
          where: {
            loai_de_xuat: 'DON_VI_HANG_NAM',
            nam: parseInt(nam),
            status: { not: 'REJECTED' },
          },
        });

        // Tìm trong data_danh_hieu của từng proposal
        const existing = proposals.find(p => {
          const dataDanhHieu = p.data_danh_hieu || [];
          return dataDanhHieu.some(
            item => item.don_vi_id === donViId && item.danh_hieu === danhHieu
          );
        });

        if (existing) {
          return {
            exists: true,
            message: `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`,
            status: existing.status,
          };
        }
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking duplicate unit award:', error);
      throw error;
    }
  }
}

module.exports = new ProposalService();
