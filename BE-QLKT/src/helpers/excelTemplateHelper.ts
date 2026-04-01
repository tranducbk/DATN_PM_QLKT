import ExcelJS from 'exceljs';
import { prisma } from '../models';
import {
  CAP_BAC_OPTIONS_STRING,
  MIN_TEMPLATE_ROWS,
  MAX_DECISION_DROPDOWN,
  EXCEL_INLINE_VALIDATION_MAX_LENGTH,
} from '../constants/excel.constants';

/** Cấu hình một cột trong template Excel. */
export interface TemplateColumn {
  header: string;
  key: string;
  width: number;
  editable?: boolean;
  validationFormulae?: string;
}

/** Mapping vị trí cột (1-based) cho thông tin quân nhân trong template. */
export interface PersonnelColumnMapping {
  stt: number;
  id: number;
  hoTen: number;
  capBac: number;
  chucVu: number;
}

/** Cấu hình đầy đủ để tạo một template Excel. */
export interface TemplateConfig {
  sheetName: string;
  columns: TemplateColumn[];
  personnelIds?: string[];
  repeatMap?: Record<string, number>;
  loaiKhenThuong?: string;
  danhHieuOptions?: string;
  includeCapBac?: boolean;
  includeDecision?: boolean;
  readonlyColumns?: number[];
  redColumns?: number[];
  editableColumnLetters?: string[];
  personnelMapping?: Partial<PersonnelColumnMapping>;
  customRowFiller?: (
    worksheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook
  ) => Promise<number>;
}

/** Kết quả tạo validation cho dropdown quyết định. */
interface DecisionValidationResult {
  type: 'list';
  allowBlank: boolean;
  formulae: string[];
}

/**
 * Truy vấn danh sách quân nhân kèm chức vụ để điền vào template.
 * @param personnelIds - Danh sách ID quân nhân
 * @returns Danh sách quân nhân kèm ChucVu
 */
export async function queryPersonnelForTemplate(personnelIds: string[]) {
  if (personnelIds.length === 0) return [];
  return prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    include: { ChucVu: true },
  });
}

/**
 * Truy vấn danh sách số quyết định cho dropdown trong template.
 * @param take - Số lượng tối đa (default MAX_DECISION_DROPDOWN)
 * @returns Mảng số quyết định, sắp xếp theo năm giảm dần
 */
export async function queryDecisionsForTemplate(
  loaiKhenThuong?: string,
  take = MAX_DECISION_DROPDOWN
) {
  const where: Record<string, unknown> = {};
  if (loaiKhenThuong) where.loai_khen_thuong = loaiKhenThuong;

  const existingDecisions = await prisma.fileQuyetDinh.findMany({
    where,
    select: { so_quyet_dinh: true },
    orderBy: { nam: 'desc' },
    take,
  });
  return existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean) as string[];
}

/**
 * Tạo hidden sheet `_CapBac` chứa danh sách cấp bậc cho dropdown.
 * @param workbook - ExcelJS workbook
 * @returns Formula string để dùng trong data validation
 */
export function createCapBacHiddenSheet(workbook: ExcelJS.Workbook): string {
  const items = CAP_BAC_OPTIONS_STRING.split(',');
  const sheet = workbook.addWorksheet('_CapBac', { state: 'veryHidden' });
  items.forEach((cb, idx) => {
    sheet.getCell(`A${idx + 1}`).value = cb;
  });
  return `_CapBac!$A$1:$A$${items.length}`;
}

/**
 * Tạo validation config cho dropdown số quyết định. Dùng hidden sheet khi inline list vượt 250 ký tự.
 * @param workbook - ExcelJS workbook
 * @param decisionList - Danh sách số quyết định
 * @returns Validation config, hoặc null nếu danh sách rỗng
 */
export function createDecisionValidation(
  workbook: ExcelJS.Workbook,
  decisionList: string[]
): DecisionValidationResult | null {
  if (decisionList.length === 0) return null;

  const decisionListStr = decisionList.join(',');

  if (decisionListStr.length <= EXCEL_INLINE_VALIDATION_MAX_LENGTH) {
    return {
      type: 'list',
      allowBlank: true,
      formulae: [`"${decisionListStr}"`],
    };
  }

  // Fallback: create hidden sheet
  const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
  decisionList.forEach((sqd, idx) => {
    refSheet.getCell(`A${idx + 1}`).value = sqd;
  });

  return {
    type: 'list',
    allowBlank: true,
    formulae: [`_QuyetDinh!$A$1:$A$${decisionList.length}`],
  };
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD3D3D3' },
};

const YELLOW_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFCC' },
};

const RED_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFCCCC' },
};

/** Viền mỏng bốn cạnh — đồng bộ mẫu import giữa các loại khen thưởng. */
export const THIN_BORDER_ALL_SIDES: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

/**
 * Kẻ viền mỏng cho lưới ô (hàng 1..maxRows, cột 1..columnCount).
 * @param worksheet - Sheet cần style
 * @param maxRows - Số hàng cuối (gồm header)
 * @param columnCount - Số cột
 */
export function applyThinBordersToGrid(
  worksheet: ExcelJS.Worksheet,
  maxRows: number,
  columnCount: number
): void {
  for (let rowNum = 1; rowNum <= maxRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    for (let col = 1; col <= columnCount; col++) {
      row.getCell(col).border = THIN_BORDER_ALL_SIDES;
    }
  }
}

/**
 * Áp dụng bold font + gray fill cho header row (row 1).
 * @param worksheet - Worksheet cần style
 */
export function styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;
}

/**
 * Áp dụng yellow fill cho các cột readonly (rows 2..maxRows).
 * @param worksheet - Worksheet cần style
 * @param columns - Chỉ số cột 1-based
 * @param maxRows - Dòng cuối cùng (inclusive)
 */
export function applyReadonlyFill(
  worksheet: ExcelJS.Worksheet,
  columns: number[],
  maxRows: number
): void {
  for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    columns.forEach(colIdx => {
      row.getCell(colIdx).fill = YELLOW_FILL;
    });
  }
}

/**
 * Áp dụng fill pattern cho các cột chỉ định (rows 2..maxRows).
 * @param worksheet - Worksheet cần style
 * @param columns - Chỉ số cột 1-based
 * @param maxRows - Dòng cuối cùng (inclusive)
 * @param fill - ExcelJS fill pattern
 */
export function applyColumnFill(
  worksheet: ExcelJS.Worksheet,
  columns: number[],
  maxRows: number,
  fill: ExcelJS.FillPattern
): void {
  for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    columns.forEach(colIdx => {
      row.getCell(colIdx).fill = fill;
    });
  }
}

/**
 * Áp dụng conditional formatting: highlight ô có giá trị bằng yellow fill.
 * @param worksheet - Worksheet cần format
 * @param editableColumns - Ký tự cột (e.g. ['G', 'H'])
 * @param maxRows - Dòng cuối cùng (inclusive)
 */
export function applyConditionalFormatting(
  worksheet: ExcelJS.Worksheet,
  editableColumns: string[],
  maxRows: number
): void {
  editableColumns.forEach(col => {
    worksheet.addConditionalFormatting({
      ref: `${col}2:${col}${maxRows}`,
      rules: [
        {
          type: 'expression',
          formulae: [`LEN(TRIM(${col}2))>0`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } },
          },
          priority: 1,
        },
      ],
    });
  });
}

interface PersonnelWithPosition {
  id: string;
  ho_ten: string | null;
  cap_bac: string | null;
  ChucVu: { ten_chuc_vu: string } | null;
}

/**
 * Điền STT, ID, họ tên, cấp bậc, chức vụ cho mỗi quân nhân vào template.
 * @param worksheet - Worksheet cần điền dữ liệu
 * @param personnelList - Danh sách quân nhân kèm chức vụ
 * @param options - Column mapping và repeatMap (lặp dòng cho mỗi người)
 * @returns Tổng số dòng dữ liệu đã thêm
 */
export function prefillPersonnelRows(
  worksheet: ExcelJS.Worksheet,
  personnelList: PersonnelWithPosition[],
  options?: {
    startCol?: Partial<PersonnelColumnMapping>;
    repeatMap?: Record<string, number>;
  }
): number {
  const mapping: PersonnelColumnMapping = {
    stt: 1,
    id: 2,
    hoTen: 3,
    capBac: 4,
    chucVu: 5,
    ...options?.startCol,
  };

  const repeatMap = options?.repeatMap ?? {};
  let stt = 0;

  personnelList.forEach(person => {
    const rowCount = repeatMap[person.id] || 1;
    for (let r = 0; r < rowCount; r++) {
      stt++;
      const rowValues: Record<string, any> = {};

      // Build row using worksheet column keys by position
      const cols = worksheet.columns as ExcelJS.Column[];
      if (cols[mapping.stt - 1]) rowValues[cols[mapping.stt - 1].key as string] = stt;
      if (cols[mapping.id - 1]) rowValues[cols[mapping.id - 1].key as string] = person.id;
      if (cols[mapping.hoTen - 1])
        rowValues[cols[mapping.hoTen - 1].key as string] = person.ho_ten ?? '';
      if (cols[mapping.capBac - 1])
        rowValues[cols[mapping.capBac - 1].key as string] = person.cap_bac ?? '';
      if (cols[mapping.chucVu - 1])
        rowValues[cols[mapping.chucVu - 1].key as string] =
          person.ChucVu ? person.ChucVu.ten_chuc_vu : '';

      worksheet.addRow(rowValues);
    }
  });

  return stt;
}

/**
 * Tạo Excel template workbook hoàn chỉnh từ config.
 * @param config - Cấu hình template (columns, dropdowns, styling, prefill data)
 * @returns ExcelJS workbook sẵn sàng export
 */
export async function buildTemplate(config: TemplateConfig): Promise<ExcelJS.Workbook> {
  const {
    sheetName,
    columns,
    personnelIds = [],
    repeatMap,
    loaiKhenThuong,
    danhHieuOptions,
    includeCapBac = true,
    includeDecision = true,
    readonlyColumns = [1, 2, 3],
    redColumns = [],
    editableColumnLetters = [],
    personnelMapping,
    customRowFiller,
  } = config;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  styleHeaderRow(worksheet);

  const [personnelList, decisionNumbers] = await Promise.all([
    queryPersonnelForTemplate(personnelIds),
    includeDecision ? queryDecisionsForTemplate(loaiKhenThuong) : Promise.resolve([]),
  ]);

  let totalDataRows = 0;
  if (customRowFiller) {
    totalDataRows = await customRowFiller(worksheet, workbook);
  } else if (personnelList.length > 0) {
    totalDataRows = prefillPersonnelRows(worksheet, personnelList, {
      startCol: personnelMapping,
      repeatMap,
    });
  }

  const maxRows = Math.max(totalDataRows + 1, MIN_TEMPLATE_ROWS);

  if (readonlyColumns.length > 0) {
    applyReadonlyFill(worksheet, readonlyColumns, maxRows);
  }

  if (redColumns.length > 0) {
    applyColumnFill(worksheet, redColumns, maxRows, RED_FILL);
  }

  if (includeCapBac) {
    const capBacFormula = createCapBacHiddenSheet(workbook);
    const capBacColIndex = columns.findIndex(c => c.key === 'cap_bac') + 1;
    if (capBacColIndex > 0) {
      for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
        worksheet.getRow(rowNum).getCell(capBacColIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [capBacFormula],
        };
      }
    }
  }

  if (danhHieuOptions) {
    const danhHieuColIndex = columns.findIndex(c => c.key === 'danh_hieu') + 1;
    if (danhHieuColIndex > 0) {
      for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
        worksheet.getRow(rowNum).getCell(danhHieuColIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [danhHieuOptions],
        };
      }
    }
  }

  columns.forEach((col, idx) => {
    if (col.validationFormulae) {
      const colNumber = idx + 1;
      for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
        worksheet.getRow(rowNum).getCell(colNumber).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [col.validationFormulae],
        };
      }
    }
  });

  if (includeDecision && decisionNumbers.length > 0) {
    const decisionValidation = createDecisionValidation(workbook, decisionNumbers);
    if (decisionValidation) {
      const soQdColIndex = columns.findIndex(c => c.key === 'so_quyet_dinh') + 1;
      if (soQdColIndex > 0) {
        for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
          worksheet.getRow(rowNum).getCell(soQdColIndex).dataValidation = decisionValidation;
        }
      }
    }
  }

  if (editableColumnLetters.length > 0) {
    applyConditionalFormatting(worksheet, editableColumnLetters, maxRows);
  }

  applyThinBordersToGrid(worksheet, maxRows, columns.length);

  return workbook;
}
