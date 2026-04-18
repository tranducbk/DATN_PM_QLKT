import ExcelJS from 'exceljs';
import { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { ValidationError } from '../middlewares/errorHandler';
import { MAX_EXCEL_ROWS, IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';

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
 * Queries personnel records in batch by ID list.
 * @param personnelIds - Personnel ID list
 * @returns Map keyed by personnel ID
 */
async function batchQueryPersonnel(personnelIds: string[]): Promise<Map<string, PersonnelInfo>> {
  if (personnelIds.length === 0) {
    return new Map();
  }

  const list = await prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    select: {
      id: true,
      ho_ten: true,
      gioi_tinh: true,
      ngay_sinh: true,
      ngay_nhap_ngu: true,
      cap_bac: true,
    },
  });

  return new Map(list.map(p => [p.id, p as PersonnelInfo]));
}

/**
 * Query all decision numbers from the database.
 * Returns a Set for O(1) lookup.
 */
async function batchQueryDecisions(): Promise<Set<string>> {
  const decisions = await prisma.fileQuyetDinh.findMany({
    select: { so_quyet_dinh: true },
  });

  return new Set(decisions.map(d => d.so_quyet_dinh).filter(Boolean));
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

type TransactionClient = Prisma.TransactionClient;

/**
 * Runs batched create/upsert writes inside a Prisma transaction.
 * @param items - Validated items to persist
 * @param upsertFn - Database write callback for each item
 * @param timeout - Transaction timeout in milliseconds
 * @returns Imported item count payload
 */
async function runConfirmTransaction<T>(
  items: T[],
  upsertFn: (item: T, tx: TransactionClient) => Promise<unknown>,
  timeout: number = IMPORT_TRANSACTION_TIMEOUT
): Promise<{ imported: number }> {
  return await prisma.$transaction(
    async tx => {
      for (const item of items) {
        await upsertFn(item, tx);
      }
      return { imported: items.length };
    },
    { timeout }
  );
}

export {
  loadWorkbook,
  getAndValidateWorksheet,
  getCellString,
  getCellNumber,
  validateYear,
  validateRequired,
  batchQueryPersonnel,
  batchQueryDecisions,
  validateDecisionNumber,
  runConfirmTransaction,
};
