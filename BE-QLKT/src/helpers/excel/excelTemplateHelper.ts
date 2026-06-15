import ExcelJS from 'exceljs';
import {
  CAP_BAC_OPTIONS_STRING,
  MIN_TEMPLATE_ROWS,
  EXCEL_INLINE_VALIDATION_MAX_LENGTH,
} from '../../constants/excel.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  EXCEL TEMPLATE HELPER — dựng file .xlsx mẫu cho admin tải về rồi điền
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Mục tiêu: file mẫu PHẢI khó nhập sai. Nên template không chỉ có header —
 *  mà còn prefill sẵn quân nhân + dropdown ràng buộc + tô màu phân vùng:
 *
 *   • DROPDOWN (data validation): cấp bậc / danh hiệu / số quyết định cho chọn
 *     từ list — chặn gõ tay sai chính tả ngay tại Excel, trước khi upload.
 *     Excel giới hạn độ dài list inline → list dài đẩy sang SHEET ẨN
 *     (_CapBac, _QuyetDinh) rồi tham chiếu range (xem createDecisionValidation).
 *
 *   • PHÂN VÙNG MÀU: cột khoá (ID, tên, đơn vị) tô vàng + readonly-ngầm để admin
 *     biết "đừng sửa"; cột cần điền để trắng; cột lỗi tô đỏ khi export-lại-có-lỗi.
 *
 *   • buildTemplate() là cửa CHÍNH: nhận TemplateConfig (cột + data + style) →
 *     ráp workbook hoàn chỉnh. Helper KHÔNG query DB — caller (service) phải
 *     fetch personnelList + decisionNumbers rồi truyền vào (đúng rule AP-3).
 *
 *  Mọi hàm style (styleHeaderRow, applyReadonlyFill, ...) đều MUTATE worksheet
 *  tại chỗ và trả void — gọi tuần tự trong buildTemplate.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
  personnelList?: PersonnelWithPosition[];
  decisionNumbers?: string[];
  repeatMap?: Record<string, number>;
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
 * Creates a hidden `_CapBac` sheet for rank dropdown validation.
 * @param workbook - ExcelJS workbook
 * @returns Formula range string for data validation
 */
export function createCapBacHiddenSheet(workbook: ExcelJS.Workbook): string {
  // Ghi 17 cấp bậc xuống cột A của 1 sheet 'veryHidden' (ẩn cứng, user không
  // unhide được từ menu Excel) rồi trả về địa chỉ range để dropdown tham chiếu.
  // Dùng sheet ẩn thay vì nhúng list inline vì danh sách dài + tái dùng cho mọi
  // dòng — nhúng inline 17 mục × N dòng sẽ phồng file vô ích.
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

  // 2 cách khai báo dropdown, chọn theo ĐỘ DÀI list:
  // (1) Inline `"a,b,c"`: gọn, không tạo sheet phụ — nhưng Excel giới hạn ~255
  //     ký tự cho formula inline; vượt là file lỗi/mất validation.
  if (decisionListStr.length <= EXCEL_INLINE_VALIDATION_MAX_LENGTH) {
    return {
      type: 'list',
      allowBlank: true,
      formulae: [`"${decisionListStr}"`],
    };
  }

  // (2) List dài → đổ xuống sheet ẩn _QuyetDinh rồi trỏ range. Không vướng giới
  //     hạn ký tự vì formula chỉ là 1 tham chiếu ô, không phải chuỗi dữ liệu.
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

const YELLOW_ARGB = 'FFFFFFCC';

const YELLOW_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: YELLOW_ARGB },
};

/** Column keys that read better centered (index, dates, short codes); all others align left, never right. */
// Quy ước căn chỉnh dựa trên KEY của cột, không dựa kiểu dữ liệu. Cột nội dung
// ngắn/cố định (STT, ngày, năm, mã, số QĐ) căn giữa cho gọn; cột văn bản dài
// (họ tên, chức vụ, ghi chú, mô tả) căn trái cho dễ đọc. Cố ý KHÔNG dùng phải.
const CENTER_ALIGNED_KEYS = new Set([
  'stt',
  'ngay_sinh',
  'cap_bac',
  'nam',
  'thang',
  'so_quyet_dinh',
  'ma_don_vi',
  'loai',
]);

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
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW_ARGB } },
          },
          priority: 1,
        },
      ],
    });
  });
}

/**
 * Aligns the grid: header centered, data cells centered for index/date/code columns and left otherwise.
 * Never right-aligns, so numeric columns (STT, year) don't drift to the right edge.
 * @param worksheet - Sheet to mutate in place
 * @param columns - Column definitions; `key` drives per-column alignment
 * @param maxRows - Inclusive last row
 * @returns void
 */
export function applyAlignment(
  worksheet: ExcelJS.Worksheet,
  columns: TemplateColumn[],
  maxRows: number
): void {
  const headerRow = worksheet.getRow(1);
  columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    // ExcelJS không có "căn chỉnh cả cột" — phải set thuộc tính .alignment cho
    // TỪNG ô. Header (dòng 1) luôn căn giữa + wrapText (tên cột dài xuống dòng
    // trong ô thay vì tràn). Dòng data lấy horizontal theo CENTER_ALIGNED_KEYS.
    const horizontal = CENTER_ALIGNED_KEYS.has(col.key) ? 'center' : 'left';
    headerRow.getCell(colNumber).alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    // Lặp dọc theo cột (row 2..maxRows) gán cùng kiểu căn — vertical 'middle' để
    // chữ nằm giữa ô khi dòng cao do wrapText ở cột khác.
    for (let rowNum = 2; rowNum <= maxRows; rowNum++) {
      worksheet.getRow(rowNum).getCell(colNumber).alignment = { horizontal, vertical: 'middle' };
    }
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

  // repeatMap[id] = số dòng dành cho 1 quân nhân. Vd khen thưởng nhiều năm cần
  // 3 dòng cho cùng 1 người → prefill lặp 3 dòng giống nhau để admin chỉ điền
  // phần năm/danh hiệu khác nhau. Không có trong map → mặc định 1 dòng.
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

      // addRow nhận object keyed theo `key` của cột (không theo index). Hàm set
      // dịch "ghi vào cột số N" → "ghi vào rowValues[<key của cột N>]", nhờ vậy
      // mapping cột (stt/id/hoTen...) đổi được mà không sửa từng dòng gán.
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
 * Caller must pre-fetch personnel + decision data and pass them via `personnelList` / `decisionNumbers`.
 * @param config - Template configuration (columns, dropdowns, style, prefilled data)
 * @returns ExcelJS workbook ready for export
 */
export async function buildTemplate(config: TemplateConfig): Promise<ExcelJS.Workbook> {
  const {
    sheetName,
    columns,
    personnelList = [],
    decisionNumbers = [],
    repeatMap,
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

  // Khai báo cột (header + key + width). Gán `key` ở đây là điều kiện để
  // prefillPersonnelRows ghi dữ liệu theo tên cột về sau.
  worksheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  styleHeaderRow(worksheet);

  // Đổ dữ liệu: ưu tiên customRowFiller (loại đặc thù tự dựng dòng), không thì
  // prefill quân nhân chuẩn. totalDataRows quyết định vùng cần style bên dưới.
  let totalDataRows = 0;
  if (customRowFiller) {
    totalDataRows = await customRowFiller(worksheet, workbook);
  } else if (personnelList.length > 0) {
    totalDataRows = prefillPersonnelRows(worksheet, personnelList, {
      startCol: personnelMapping,
      repeatMap,
    });
  }

  // Prefilled templates stop exactly at the data; only blank templates pad to MIN_TEMPLATE_ROWS for manual entry.
  // maxRows = mốc dưới của mọi vòng style/validation phía dưới. Có prefill thì
  // dừng đúng data (+1 cho header); template trống thì kéo 50 dòng để gõ tay.
  const maxRows = totalDataRows > 0 ? totalDataRows + 1 : MIN_TEMPLATE_ROWS;

  if (readonlyColumns.length > 0) {
    applyReadonlyFill(worksheet, readonlyColumns, maxRows);
  }

  if (redColumns.length > 0) {
    applyColumnFill(worksheet, redColumns, maxRows, RED_FILL);
  }

  // Gắn dropdown phải set dataValidation cho TỪNG ô (ExcelJS không có API "cả
  // cột"), nên các block dưới đều theo khuôn: tìm index cột theo key → nếu tồn
  // tại thì loop row 2..maxRows gán validation. findIndex + 1 vì cột Excel 1-based.
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
  applyAlignment(worksheet, columns, maxRows);

  return workbook;
}
