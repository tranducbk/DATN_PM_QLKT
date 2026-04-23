import path from 'path';
import { parseCCCD as parseCCCDHelper } from '../../helpers/cccdHelper';
import { ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { DANH_HIEU_NCKH, DANH_HIEU_CA_NHAN_HANG_NAM } from '../../constants/danhHieu.constants';
import type { Row, Worksheet, CellValue } from 'exceljs';

export const SHEET_NAMES = {
  QUAN_NHAN: 'QuanNhan',
  DANH_HIEU_HANG_NAM: 'DanhHieuHangNam',
  THANH_TICH_KHOA_HOC: 'ThanhTichKhoaHoc',
  NIEN_HAN: 'NienHan',
} as const;

export const CELL_INDICES = {
  CCCD: 1,
  HO_TEN: 2,
  NAM: 3,
  CSTDCS: 4,
  CSTT: 5,
  BKBQP: 6,
  SO_QUYET_DINH_BKBQP: 7,
  CSTDTQ: 8,
  SO_QUYET_DINH_CSTDTQ: 9,
  BKTTCP: 10,
  SO_QUYET_DINH_BKTTCP: 11,
  LOAI: 4,
  MO_TA: 5,
  STATUS: 6,
} as const;

export const VALID_NCKH: readonly string[] = Object.values(DANH_HIEU_NCKH);
export const VALID_STATUS = [PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.PENDING] as const;
export const SAMPLE_ROW_KEYWORDS = ['ví dụ', 'example'] as const;

export interface ParsedDanhHieu {
  cccd: string;
  ho_ten: string;
  nam: number;
  danh_hieu: string | null;
  nhan_bkbqp: boolean;
  so_quyet_dinh_bkbqp: string | null;
  nhan_cstdtq: boolean;
  so_quyet_dinh_cstdtq: string | null;
  nhan_bkttcp: boolean;
  so_quyet_dinh_bkttcp: string | null;
}

export interface ParsedThanhTich {
  cccd: string;
  ho_ten: string;
  nam: number;
  loai: string;
  mo_ta: string;
  status: string;
}

/**
 * Strips path/hostile characters from an upload name while keeping the extension.
 * @param filename - Client-provided filename
 * @returns Filesystem-safe basename + extension (falls back to file)
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);

  let sanitized = baseName
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!sanitized || sanitized.length === 0) {
    sanitized = 'file';
  }

  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  return sanitized + ext;
}

/**
 * Delegates to cccdHelper after stringifying the Excel cell payload.
 * @param value - Raw Excel cell value
 * @returns Digits-only national ID string
 */
export function parseCCCD(value: CellValue): string {
  return parseCCCDHelper(String(value));
}

/**
 * Trims printable cell text; treats blank cells as absent.
 * @param cell - Optional cell handle
 * @returns Trimmed string, or null when empty or missing
 */
export function parseCellToString(cell: { value?: CellValue } | undefined): string | null {
  return cell?.value ? String(cell.value).trim() : null;
}

/**
 * Best-effort integer parse for year or numeric columns.
 * @param cell - Optional cell handle
 * @returns Integer or null when empty or non-numeric
 */
export function parseCellToInt(cell: { value?: CellValue } | undefined): number | null {
  const value = cell?.value ?? null;
  if (value === null || value === undefined) return null;
  const parsed = parseInt(String(value));
  return !isNaN(parsed) ? parsed : null;
}

/**
 * Import convention: checkbox columns use literal X (case-insensitive).
 * @param cell - Optional cell handle
 * @returns true when the visible text is X
 */
export function isCellChecked(cell: { value?: CellValue } | undefined): boolean {
  return cell?.value ? String(cell.value).toUpperCase().trim() === 'X' : false;
}

/**
 * Skips sample rows before validation.
 * @param text - Usually ho_ten or mo_ta
 * @returns true when the row should be skipped
 */
export function isSampleRow(text: string | null): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return SAMPLE_ROW_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Hook point for future structured logging; currently a deliberate no-op to keep import noise down.
 * @param sheet - Active worksheet instance
 * @param sheetName - Canonical name from SHEET_NAMES
 * @returns void
 */
export function logSheetInfo(sheet: Worksheet, sheetName: string): void {}

/**
 * Parses one DanhHieuHangNam row.
 * @param row - ExcelJS row payload
 * @param rowNumber - 1-based index (reserved for diagnostics)
 * @returns ParsedDanhHieu, or null when the row is invalid
 */
export function parseDanhHieuRow(row: Row, rowNumber: number): ParsedDanhHieu | null {
  const cccdCell = row.getCell(CELL_INDICES.CCCD);
  const hoTenCell = row.getCell(CELL_INDICES.HO_TEN);
  const namCell = row.getCell(CELL_INDICES.NAM);

  const cccdValue = cccdCell?.value ?? null;
  const cccd = cccdValue !== null && cccdValue !== undefined ? parseCCCD(cccdValue) : null;
  const ho_ten = parseCellToString(hoTenCell);
  const nam = parseCellToInt(namCell);

  if (!cccd || !nam || isNaN(nam)) {
    return null;
  }

  if (isSampleRow(ho_ten)) {
    return null;
  }

  const cstdcs_checked = isCellChecked(row.getCell(CELL_INDICES.CSTDCS));
  const cstt_checked = isCellChecked(row.getCell(CELL_INDICES.CSTT));
  const bkbqp_checked = isCellChecked(row.getCell(CELL_INDICES.BKBQP));
  const so_quyet_dinh_bkbqp = parseCellToString(row.getCell(CELL_INDICES.SO_QUYET_DINH_BKBQP));
  const cstdtq_checked = isCellChecked(row.getCell(CELL_INDICES.CSTDTQ));
  const so_quyet_dinh_cstdtq = parseCellToString(row.getCell(CELL_INDICES.SO_QUYET_DINH_CSTDTQ));
  const bkttcp_checked = isCellChecked(row.getCell(CELL_INDICES.BKTTCP));
  const so_quyet_dinh_bkttcp = parseCellToString(row.getCell(CELL_INDICES.SO_QUYET_DINH_BKTTCP));

  let danh_hieu: string | null = null;
  if (cstdcs_checked) danh_hieu = DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS;
  else if (cstt_checked) danh_hieu = DANH_HIEU_CA_NHAN_HANG_NAM.CSTT;

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
 * One `ThanhTichKhoaHoc` row with strict enums for `loai` / `status`.
 * @param row - `exceljs` row iterator payload
 * @param rowNumber - 1-based index (reserved for diagnostics)
 * @returns `ParsedThanhTich`, or `null` when mandatory cells are missing
 * @throws ValidationError - `loai` ∉ `VALID_NCKH` or `status` ∉ `VALID_STATUS`
 */
export function parseThanhTichRow(row: Row, rowNumber: number): ParsedThanhTich | null {
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
  const status = parseCellToString(statusCell) || PROPOSAL_STATUS.PENDING;

  if (!cccd || !nam || isNaN(nam) || !loai || !mo_ta) {
    return null;
  }

  if (isSampleRow(mo_ta)) {
    return null;
  }

  if (!(VALID_NCKH as readonly string[]).includes(loai)) {
    throw new ValidationError(
      `Loại thành tích không hợp lệ: ${loai} (chỉ chấp nhận ${VALID_NCKH.join(
        ' hoặc '
      )})`
    );
  }

  if (!(VALID_STATUS as readonly string[]).includes(status)) {
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
 * Walks every data row after the header on the annual-title sheet.
 * @param sheet - Parsed `DanhHieuHangNam` worksheet
 * @returns All rows that survived `parseDanhHieuRow`
 */
export function parseDanhHieuSheet(sheet: Worksheet): ParsedDanhHieu[] {
  logSheetInfo(sheet, SHEET_NAMES.DANH_HIEU_HANG_NAM);

  const danhHieuData: ParsedDanhHieu[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;

    const parsed = parseDanhHieuRow(row, rowNumber);

    if (parsed) {
      danhHieuData.push(parsed);
    }
  });

  return danhHieuData;
}

/**
 * Walks every data row after the header on the scientific-achievement sheet.
 * @param sheet - Parsed `ThanhTichKhoaHoc` worksheet
 * @returns All rows that survived `parseThanhTichRow` (may throw on bad enums)
 */
export function parseThanhTichSheet(sheet: Worksheet): ParsedThanhTich[] {
  logSheetInfo(sheet, SHEET_NAMES.THANH_TICH_KHOA_HOC);

  const thanhTichData: ParsedThanhTich[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;

    const parsed = parseThanhTichRow(row, rowNumber);

    if (parsed) {
      thanhTichData.push(parsed);
    }
  });

  return thanhTichData;
}

/**
 * Walks descending years from `currentYear - 1` and counts an unbroken `CSTDCS` streak.
 * @param danhHieuList - Prior awards (year + code); order is normalized inside
 * @param currentYear - Proposal year anchor (`0` falls back to system year)
 * @returns Streak length; `0` when the chain breaks or input is empty
 */
export function calculateContinuousCSTDCS(
  danhHieuList: Array<{ nam: number; danh_hieu: string | null }>,
  currentYear: number
): number {
  if (!danhHieuList || danhHieuList.length === 0) {
    return 0;
  }

  const sortedRewards = [...danhHieuList].sort((a, b) => b.nam - a.nam);

  let count = 0;
  let expectedYear = (currentYear || new Date().getFullYear()) - 1;

  for (const reward of sortedRewards) {
    if (reward.danh_hieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS && reward.nam === expectedYear) {
      count++;
      expectedYear--;
    } else if (reward.nam < expectedYear) {
      break;
    }
  }

  return count;
}
