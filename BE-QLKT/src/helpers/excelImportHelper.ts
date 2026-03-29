import ExcelJS from 'exceljs';
import { Prisma } from '../generated/prisma';
import { prisma } from '../models';
import { ValidationError } from '../middlewares/errorHandler';
import { MAX_EXCEL_ROWS, IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';

type CellValue = string | number | null | undefined;

/** Kết quả preview một dòng Excel khi import. */
export interface PreviewItem {
  row_number: number;
  errors: string[];
}

/** Kết quả tổng hợp preview import: valid, invalid, summary. */
export interface PreviewResult<T> {
  valid: T[];
  invalid: T[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
}

/** Thông tin quân nhân tối thiểu dùng cho import validation. */
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
  // exceljs load() accepts Buffer but TS definition expects ArrayBuffer
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

/**
 * Lấy worksheet từ workbook, validate tồn tại và không vượt MAX_EXCEL_ROWS.
 * @param workbook - ExcelJS workbook đã load
 * @param options - sheetName cụ thể hoặc excludeSheetNames để auto-pick
 * @returns Worksheet hợp lệ
 * @throws ValidationError - Khi sheet không tồn tại, rỗng, hoặc quá lớn
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
    // Pick the first visible worksheet not in the exclude list
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
 * Trích xuất chuỗi đã trim từ ô Excel.
 * @param row - Dòng Excel
 * @param col - Số thứ tự cột (1-based)
 * @returns Chuỗi đã trim, hoặc chuỗi rỗng nếu null/undefined
 */
function getCellString(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Trích xuất số từ ô Excel.
 * @param row - Dòng Excel
 * @param col - Số thứ tự cột (1-based)
 * @returns Số hữu hạn, hoặc null nếu không parse được
 */
function getCellNumber(row: ExcelJS.Row, col: number): number | null {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).trim());
  return Number.isFinite(num) ? num : null;
}

/**
 * Validate giá trị năm: parse integer, kiểm tra range 1900..currentYear.
 * @param value - Giá trị từ ô Excel
 * @returns Object chứa valid, year đã parse, và error message nếu có
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
 * Kiểm tra các trường bắt buộc có giá trị (non-null, non-empty).
 * @param fields - Danh sách { name, value } cần kiểm tra
 * @returns Thông báo lỗi liệt kê trường thiếu, hoặc null nếu đủ
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
 * Truy vấn hàng loạt quân nhân theo danh sách ID.
 * @param personnelIds - Danh sách ID quân nhân
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
 * Kiểm tra số quyết định có tồn tại trong hệ thống.
 * @param soQuyetDinh - Số quyết định cần kiểm tra
 * @param validDecisions - Set số quyết định hợp lệ
 * @returns Thông báo lỗi nếu không tồn tại, hoặc null nếu hợp lệ
 */
function validateDecisionNumber(soQuyetDinh: string, validDecisions: Set<string>): string | null {
  if (!validDecisions.has(soQuyetDinh)) {
    return `Số quyết định "${soQuyetDinh}" không tồn tại trên hệ thống`;
  }
  return null;
}

type TransactionClient = Prisma.TransactionClient;

/**
 * Chạy batch upsert/create trong Prisma transaction.
 * @param items - Danh sách items đã validate
 * @param upsertFn - Hàm thực hiện DB write cho mỗi item
 * @param timeout - Transaction timeout in ms (default IMPORT_TRANSACTION_TIMEOUT)
 * @returns `{ imported: number }` số lượng items đã persist
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
