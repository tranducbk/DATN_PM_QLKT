const path = require('path');
const { parseCCCD: parseCCCDHelper } = require('../../helpers/cccdHelper');
const { ValidationError } = require('../../middlewares/errorHandler');

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

/**
 * Sanitize tên file để tránh lỗi filesystem
 * Loại bỏ ký tự đặc biệt, thay thế khoảng trắng, giới hạn độ dài
 * @param {string} filename - Tên file gốc
 * @returns {string} - Tên file đã được sanitize
 */
function sanitizeFilename(filename) {
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

function parseCCCD(value) {
  return parseCCCDHelper(value);
}

/**
 * Parse cell value to string safely
 * @param {*} cell - Excel cell
 * @returns {string|null} - Trimmed string or null
 */
function parseCellToString(cell) {
  return cell?.value ? String(cell.value).trim() : null;
}

/**
 * Parse cell value to integer safely
 * @param {*} cell - Excel cell
 * @returns {number|null} - Parsed integer or null
 */
function parseCellToInt(cell) {
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
function isCellChecked(cell) {
  return cell?.value ? String(cell.value).toUpperCase().trim() === 'X' : false;
}

/**
 * Check if row is a sample row (contains example keywords)
 * @param {string} text - Text to check
 * @returns {boolean} - True if sample row
 */
function isSampleRow(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return SAMPLE_ROW_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Log sheet information for debugging
 * @param {Worksheet} sheet - Excel worksheet
 * @param {string} sheetName - Name of the sheet
 */
function logSheetInfo(sheet, sheetName) {}

/**
 * Parse danh hiệu hàng năm từ Excel row
 * @param {Row} row - Excel row
 * @param {number} rowNumber - Row number
 * @returns {Object|null} - Parsed data or null if invalid
 */
function parseDanhHieuRow(row, rowNumber) {
  const cccdCell = row.getCell(CELL_INDICES.CCCD);
  const hoTenCell = row.getCell(CELL_INDICES.HO_TEN);
  const namCell = row.getCell(CELL_INDICES.NAM);

  const cccdValue = cccdCell?.value ?? null;
  const cccd = cccdValue !== null && cccdValue !== undefined ? parseCCCD(cccdValue) : null;
  const ho_ten = parseCellToString(hoTenCell);
  const nam = parseCellToInt(namCell);

  // Validate required fields
  if (!cccd || !nam || isNaN(nam)) {
    return null;
  }

  // Skip sample rows
  if (isSampleRow(ho_ten)) {
    return null;
  }

  // Parse checkboxes and decision numbers
  const cstdcs_checked = isCellChecked(row.getCell(CELL_INDICES.CSTDCS));
  const cstt_checked = isCellChecked(row.getCell(CELL_INDICES.CSTT));
  const bkbqp_checked = isCellChecked(row.getCell(CELL_INDICES.BKBQP));
  const so_quyet_dinh_bkbqp = parseCellToString(row.getCell(CELL_INDICES.SO_QUYET_DINH_BKBQP));
  const cstdtq_checked = isCellChecked(row.getCell(CELL_INDICES.CSTDTQ));
  const so_quyet_dinh_cstdtq = parseCellToString(row.getCell(CELL_INDICES.SO_QUYET_DINH_CSTDTQ));
  const bkttcp_checked = isCellChecked(row.getCell(CELL_INDICES.BKTTCP));
  const so_quyet_dinh_bkttcp = parseCellToString(row.getCell(CELL_INDICES.SO_QUYET_DINH_BKTTCP));
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
function parseThanhTichRow(row, rowNumber) {
  const cccdCell = row.getCell(CELL_INDICES.CCCD);
  const hoTenCell = row.getCell(CELL_INDICES.HO_TEN);
  const namCell = row.getCell(CELL_INDICES.NAM);
  const loaiCell = row.getCell(CELL_INDICES.LOAI);
  const moTaCell = row.getCell(CELL_INDICES.MO_TA);
  const statusCell = row.getCell(CELL_INDICES.STATUS);

  const cccdValue = cccdCell?.value ?? null;
  const cccd = cccdValue !== null && cccdValue !== undefined ? parseCCCD(cccdValue) : null;
  const ho_ten = parseCellToString(hoTenCell);
  const nam = parseCellToInt(namCell);
  const loai = parseCellToString(loaiCell);
  const mo_ta = parseCellToString(moTaCell);
  const status = parseCellToString(statusCell) || 'PENDING';

  // Validate required fields
  if (!cccd || !nam || isNaN(nam) || !loai || !mo_ta) {
    return null;
  }

  // Skip sample rows
  if (isSampleRow(mo_ta)) {
    return null;
  }

  // Validate loại
  if (!VALID_LOAI_THANH_TICH.includes(loai)) {
    throw new ValidationError(
      `Loại thành tích không hợp lệ: ${loai} (chỉ chấp nhận ${VALID_LOAI_THANH_TICH.join(
        ' hoặc '
      )})`
    );
  }

  // Validate status
  if (!VALID_STATUS.includes(status)) {
    throw new ValidationError(
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
function parseDanhHieuSheet(sheet) {
  logSheetInfo(sheet, SHEET_NAMES.DANH_HIEU_HANG_NAM);

  const danhHieuData = [];
  let rowCount = 0;
  let skippedCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return; // Skip header

    rowCount++;
    const parsed = parseDanhHieuRow(row, rowNumber);

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
function parseThanhTichSheet(sheet) {
  logSheetInfo(sheet, SHEET_NAMES.THANH_TICH_KHOA_HOC);

  const thanhTichData = [];
  let rowCount = 0;
  let skippedCount = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return; // Skip header

    rowCount++;
    const parsed = parseThanhTichRow(row, rowNumber);

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
 * @param {Array} danhHieuList - Danh sách danh hiệu đã có
 * @param {number} currentYear - Năm đang xét khen thưởng
 * @returns {number} Số năm CSTDCS liên tục TRƯỚC năm đang xét
 */
function calculateContinuousCSTDCS(danhHieuList, currentYear) {
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

module.exports = {
  SHEET_NAMES,
  CELL_INDICES,
  VALID_LOAI_THANH_TICH,
  VALID_STATUS,
  SAMPLE_ROW_KEYWORDS,
  sanitizeFilename,
  parseCCCD,
  parseCellToString,
  parseCellToInt,
  isCellChecked,
  isSampleRow,
  logSheetInfo,
  parseDanhHieuRow,
  parseThanhTichRow,
  parseDanhHieuSheet,
  parseThanhTichSheet,
  calculateContinuousCSTDCS,
};
