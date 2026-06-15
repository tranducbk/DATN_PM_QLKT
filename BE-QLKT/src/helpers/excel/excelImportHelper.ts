import ExcelJS from 'exceljs';
import { ValidationError } from '../../middlewares/errorHandler';
import { MAX_EXCEL_ROWS } from '../../constants/excel.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  EXCEL IMPORT HELPERS — load + validate + parse cell an toàn về memory
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  RỦI RO MEMORY của Excel import:
 *
 *  1. PARSE TOÀN BỘ WORKBOOK VÀO RAM:
 *     ExcelJS load file XLSX bằng cách giải nén ZIP + parse XML → object
 *     tree trong memory. File 10MB → object ~50-100MB (XML phồng to).
 *     Vì vậy multer limit 10MB là HỢP LÝ; vượt sẽ OOM container.
 *
 *  2. MAX_EXCEL_ROWS hard limit:
 *     File hợp lệ MIME XLSX nhưng kẻ tấn công có thể tạo file 1 cell
 *     duy nhất "expand" tới hàng triệu row (zip bomb logic). Check
 *     rowCount NGAY sau load để fail fast → reject trước khi loop parse.
 *     MAX_EXCEL_ROWS hiện = 5000 (đủ cho 1 đơn vị 1 năm; lớn hơn nên
 *     tách file).
 *
 *  3. STREAMING vs BUFFER:
 *     ExcelJS có API streaming (workbook.xlsx.createInputStream) đỡ
 *     tốn RAM hơn, NHƯNG khó dùng với multer memoryStorage. Hiện tại
 *     dùng buffer-load vì:
 *       - File < 10MB không cần streaming.
 *       - Streaming khó random-access cell (nhiều validation cần).
 *     Khi DB > 1M record + import vài chục MB, NÊN chuyển sang stream.
 *
 *  4. BATCH QUERY pattern (xem `batchQueryPersonnel` ở dưới):
 *     Anti-pattern: loop từng row → query DB → N+1 queries.
 *     Cách đúng: collect tất cả personnel_id → 1 query findMany({in: [...]})
 *     → build Map → loop validate.
 *     Tiết kiệm latency lẫn DB connection pool.
 *
 *  CELL PARSING:
 *  - ExcelJS trả value với type động: string | number | Date | object
 *    (vd: object cho cell có formula = { formula, result }).
 *  - getCellString / getCellNumber chuẩn hoá về primitive + handle null.
 *  - Date: ExcelJS auto-parse "DD/MM/YYYY" thành Date object nếu format
 *    cell là date; KHÔNG dùng new Date(string) tự build (lỗi timezone).
 * ════════════════════════════════════════════════════════════════════════════
 */

type CellValue = string | number | null | undefined;

export interface PreviewItem {
  row_number: number;
  errors: string[];
}

export interface PreviewResult<T> {
  valid: T[];
  invalid: T[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

export interface PersonnelInfo {
  id: string;
  ho_ten: string;
  gioi_tinh: string | null;
  ngay_sinh: Date | null;
  ngay_nhap_ngu: Date | null;
  cap_bac: string | null;
}

/**
 * Load an Excel workbook from a Buffer.
 * @param buffer - Raw file buffer
 * @returns Parsed ExcelJS workbook
 */
async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

/**
 * Gets a worksheet and validates existence and maximum row count.
 * @param workbook - Parsed ExcelJS workbook
 * @param options - Explicit `sheetName` or exclusion list for auto-pick
 * @returns Valid worksheet instance
 * @throws ValidationError - When worksheet is missing, empty, or too large
 */
function getAndValidateWorksheet(
  workbook: ExcelJS.Workbook,
  options: { sheetName?: string; excludeSheetNames?: string[] } = {}
): ExcelJS.Worksheet {
  const { sheetName, excludeSheetNames = [] } = options;

  let worksheet: ExcelJS.Worksheet | undefined;

  if (sheetName) {
    worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new ValidationError(
        `Không tìm thấy sheet "${sheetName}" trong file Excel. Vui lòng sử dụng đúng file mẫu.`
      );
    }
  } else {
    const excludeSet = new Set(excludeSheetNames.map(n => n.toLowerCase()));
    worksheet = workbook.worksheets.find(
      ws => !excludeSet.has(ws.name.toLowerCase()) && ws.state !== 'veryHidden'
    );
    if (!worksheet) {
      throw new ValidationError('File Excel không hợp lệ hoặc không có sheet dữ liệu.');
    }
  }

  if (worksheet.rowCount === 0) {
    throw new ValidationError('Sheet không có dữ liệu.');
  }

  if (worksheet.rowCount > MAX_EXCEL_ROWS) {
    throw new ValidationError(`File Excel quá lớn. Tối đa ${MAX_EXCEL_ROWS} dòng.`);
  }

  return worksheet;
}

/**
 * Extracts a trimmed string value from an Excel cell.
 * @param row - Excel row
 * @param col - 1-based column index
 * @returns Trimmed string, or empty string for nullish values
 */
function getCellString(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Extracts a numeric value from an Excel cell.
 * @param row - Excel row
 * @param col - 1-based column index
 * @returns Finite number, or null when parsing fails
 */
function getCellNumber(row: ExcelJS.Row, col: number): number | null {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return null;
  // ExcelJS trả number trực tiếp nếu cell là số; còn lại (text, hoặc object
  // {formula,result}) ép qua String→parseFloat. Number.isFinite loại NaN/Infinity
  // → cell không phải số trả null thay vì giá trị rác.
  const num = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

/**
 * Validates year values against integer and range constraints.
 * @param value - Raw value from Excel cell
 * @returns Validation result with parsed year and optional error
 */
function validateYear(value: CellValue): { valid: boolean; year: number | null; error?: string } {
  const currentYear = new Date().getFullYear();

  if (value === null || value === undefined || value === '') {
    return { valid: false, year: null, error: 'Giá trị năm không được để trống' };
  }

  const year = parseInt(String(value), 10);

  if (isNaN(year) || !Number.isInteger(year)) {
    return { valid: false, year: null, error: `Giá trị năm không hợp lệ: ${value}` };
  }

  if (year < 1900 || year > currentYear) {
    return {
      valid: false,
      year,
      error: `Năm ${year} không hợp lệ. Chỉ được nhập từ 1900 đến ${currentYear}`,
    };
  }

  return { valid: true, year };
}

/**
 * Validates required fields for non-null and non-empty values.
 * @param fields - Field descriptors with name and value
 * @returns Error message for missing fields, or null when valid
 */
function validateRequired(fields: { name: string; value: CellValue }[]): string | null {
  const missing: string[] = [];

  for (const field of fields) {
    const val = field.value;
    if (val === null || val === undefined) {
      missing.push(field.name);
    } else if (typeof val === 'string' && val.trim() === '') {
      missing.push(field.name);
    }
  }

  if (missing.length > 0) {
    return `Thiếu ${missing.join(', ')}`;
  }

  return null;
}

/**
 * Validates whether a decision number exists in the system.
 * @param soQuyetDinh - Decision number to validate
 * @param validDecisions - Set of valid decision numbers
 * @returns Error message when missing, otherwise null
 */
function validateDecisionNumber(soQuyetDinh: string, validDecisions: Set<string>): string | null {
  if (!validDecisions.has(soQuyetDinh)) {
    return `Số quyết định "${soQuyetDinh}" không tồn tại trên hệ thống`;
  }
  return null;
}

export {
  loadWorkbook,
  getAndValidateWorksheet,
  getCellString,
  getCellNumber,
  validateYear,
  validateRequired,
  validateDecisionNumber,
};
