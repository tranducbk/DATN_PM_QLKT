import ExcelJS from 'exceljs';
import { prisma } from '../../models';
import {
  CAP_BAC_OPTIONS_STRING,
  MIN_TEMPLATE_ROWS,
  MAX_DECISION_DROPDOWN,
  EXCEL_INLINE_VALIDATION_MAX_LENGTH,
} from '../../constants/excel.constants';

export interface TemplateColumn {
  header: string;
  key: string;
  width: number;
  editable?: boolean;
  validationFormulae?: string;
}

/** 1-based column mapping for personnel fields in the template. */
export interface PersonnelColumnMapping {
  stt: number;
  id: number;
  hoTen: number;
  ngaySinh: number;
  coQuanDonVi: number;
  donViTrucThuoc: number;
  capBac: number;
  chucVu: number;
}

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

/** Validation payload for decision number dropdown. */
interface DecisionValidationResult {
  type: 'list';
  allowBlank: boolean;
  formulae: string[];
}

/**
 * Queries personnel records with positions for template prefill.
 * @param personnelIds - Personnel ID list
 * @returns Personnel records including `ChucVu`
 */
export async function queryPersonnelForTemplate(personnelIds: string[]) {
  if (personnelIds.length === 0) return [];
  return prisma.quanNhan.findMany({
    where: { id: { in: personnelIds } },
    include: {
      ChucVu: true,
      CoQuanDonVi: { select: { ten_don_vi: true } },
      DonViTrucThuoc: { select: { ten_don_vi: true } },
    },
  });
}

/**
 * Queries decision numbers for template dropdown fields.
 * @param loaiKhenThuong - Optional award type filter
 * @param take - Maximum number of records to fetch
 * @returns Decision number list sorted by year descending
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
 * Creates a hidden `_CapBac` sheet for rank dropdown validation.
 * @param workbook - ExcelJS workbook
 * @returns Formula range string for data validation
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
 * Builds decision-number dropdown validation.
 * Uses a hidden sheet when inline list length exceeds Excel limits.
 * @param workbook - ExcelJS workbook
 * @param decisionList - Decision number list
 * @returns Validation config, or null when list is empty
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

/** Thin border on all sides for consistent import templates. */
export const THIN_BORDER_ALL_SIDES: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
};

/**
 * Paints a uniform thin border on the rectangular range (row 1..maxRows, cols 1..columnCount).
 * @param worksheet - Sheet to mutate in place
 * @param maxRows - Inclusive last row (header is row 1)
 * @param columnCount - Inclusive column count
 * @returns void
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
 * Formats row 1 as the template header (bold + gray fill).
 * @param worksheet - Sheet to mutate in place
 * @returns void
 */
export function styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = HEADER_FILL;
}

/**
 * Highlights locked import columns (yellow fill) from row 2 through `maxRows`.
 * @param worksheet - Sheet to mutate in place
 * @param columns - 1-based column indexes
 * @param maxRows - Inclusive last data row
 * @returns void
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
 * Fills arbitrary column ranges (row 2..maxRows) with a custom pattern (e.g. red for errors).
 * @param worksheet - Sheet to mutate in place
 * @param columns - 1-based column indexes
 * @param maxRows - Inclusive last data row
 * @param fill - `ExcelJS` fill definition
 * @returns void
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
 * Adds per-column rules so non-blank cells in editable areas get a subtle highlight.
 * @param worksheet - Sheet to mutate in place
 * @param editableColumns - A1-style column letters (e.g. `G`, `H`)
 * @param maxRows - Inclusive last row in the formatted range
 * @returns void
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
  ngay_sinh?: Date | string | null;
  cap_bac: string | null;
  ChucVu: { ten_chuc_vu: string } | null;
  CoQuanDonVi?: { ten_don_vi: string } | null;
  DonViTrucThuoc?: { ten_don_vi: string } | null;
}

/**
 * Prefills personnel rows (index, id, name, rank, position) into template.
 * @param worksheet - Target worksheet
 * @param personnelList - Personnel records with position data
 * @param options - Optional column mapping and per-person repeat configuration
 * @returns Total number of inserted data rows
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
    ngaySinh: 4,
    coQuanDonVi: 5,
    donViTrucThuoc: 6,
    capBac: 7,
    chucVu: 8,
    ...options?.startCol,
  };

  const repeatMap = options?.repeatMap ?? {};
  let stt = 0;

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  personnelList.forEach(person => {
    const rowCount = repeatMap[person.id] || 1;
    for (let r = 0; r < rowCount; r++) {
      stt++;
      const rowValues: Record<string, any> = {};
      const cols = worksheet.columns as ExcelJS.Column[];

      const set = (colIdx: number, value: string | number) => {
        if (cols[colIdx - 1]) rowValues[cols[colIdx - 1].key as string] = value;
      };

      set(mapping.stt, stt);
      set(mapping.id, person.id);
      set(mapping.hoTen, person.ho_ten ?? '');
      set(mapping.ngaySinh, formatDate(person.ngay_sinh));
      set(mapping.coQuanDonVi, person.CoQuanDonVi?.ten_don_vi ?? '');
      set(mapping.donViTrucThuoc, person.DonViTrucThuoc?.ten_don_vi ?? '');
      set(mapping.capBac, person.cap_bac ?? '');
      set(mapping.chucVu, person.ChucVu ? person.ChucVu.ten_chuc_vu : '');

      worksheet.addRow(rowValues);
    }
  });

  return stt;
}

/**
 * Builds a complete Excel template workbook from config.
 * @param config - Template configuration (columns, dropdowns, style, prefill)
 * @returns ExcelJS workbook ready for export
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
    readonlyColumns = [1, 2, 3, 4, 5, 6],
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
