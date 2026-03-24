import path from 'path';
import { parseCCCD as parseCCCDHelper } from '../../helpers/cccdHelper';
import { ValidationError } from '../../middlewares/errorHandler';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
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

export const VALID_LOAI_THANH_TICH = ['DTKH', 'SKKH'] as const;
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

export function parseCCCD(value: CellValue): string {
  return parseCCCDHelper(String(value));
}

export function parseCellToString(cell: { value?: CellValue } | undefined): string | null {
  return cell?.value ? String(cell.value).trim() : null;
}

export function parseCellToInt(cell: { value?: CellValue } | undefined): number | null {
  const value = cell?.value ?? null;
  if (value === null || value === undefined) return null;
  const parsed = parseInt(String(value));
  return !isNaN(parsed) ? parsed : null;
}

export function isCellChecked(cell: { value?: CellValue } | undefined): boolean {
  return cell?.value ? String(cell.value).toUpperCase().trim() === 'X' : false;
}

export function isSampleRow(text: string | null): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return SAMPLE_ROW_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

export function logSheetInfo(_sheet: Worksheet, _sheetName: string): void {}

export function parseDanhHieuRow(row: Row, _rowNumber: number): ParsedDanhHieu | null {
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

export function parseThanhTichRow(row: Row, _rowNumber: number): ParsedThanhTich | null {
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

  if (!(VALID_LOAI_THANH_TICH as readonly string[]).includes(loai)) {
    throw new ValidationError(
      `Loại thành tích không hợp lệ: ${loai} (chỉ chấp nhận ${VALID_LOAI_THANH_TICH.join(
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
    if (reward.danh_hieu === 'CSTDCS' && reward.nam === expectedYear) {
      count++;
      expectedYear--;
    } else if (reward.nam < expectedYear) {
      break;
    }
  }

  return count;
}
