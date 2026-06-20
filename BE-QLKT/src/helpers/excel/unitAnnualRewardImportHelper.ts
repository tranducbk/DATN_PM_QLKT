import { UNIT_ANNUAL_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from './excelHelper';
import type ExcelJS from 'exceljs';
import { parseHeaderMap, getHeaderCol } from './excelHelper';
import { ValidationError } from '../../middlewares/errorHandler';

export interface UnitAnnualColumnMap {
  idCol: number | null;
  maDonViCol: number | null;
  tenDonViCol: number | null;
  namCol: number | null;
  danhHieuCol: number | null;
  soQuyetDinhCol: number | null;
  ghiChuCol: number | null;
  bkbqpCol: number | null;
  bkttcpCol: number | null;
  soQdBkbqpCol: number | null;
}

export interface ParsedUnitAnnualImport {
  headerMap: Record<string, number>;
  columns: UnitAnnualColumnMap;
  maDonViList: string[];
  allYears: number[];
}

/**
 * Parses a unit-annual worksheet into a column map plus distinct unit codes / years.
 * Pure: caller selects the worksheet and fetches units/awards from the DB.
 * @param worksheet - Worksheet already selected by the caller
 * @returns Header map, column indices, distinct unit codes, and distinct years
 * @throws ValidationError - When required columns (Mã đơn vị, Năm, Danh hiệu) are missing
 */
export function parseUnitAnnualRewardImport(worksheet: ExcelJS.Worksheet): ParsedUnitAnnualImport {
  const headerMap = parseHeaderMap(worksheet);

  const cols = resolveTemplateColumns(headerMap, UNIT_ANNUAL_TEMPLATE_COLUMNS);
  const columns: UnitAnnualColumnMap = {
    idCol: cols.id,
    maDonViCol: cols.ma_don_vi,
    tenDonViCol: cols.ten_don_vi,
    namCol: cols.nam,
    danhHieuCol: cols.danh_hieu,
    soQuyetDinhCol: cols.so_quyet_dinh,
    ghiChuCol: cols.ghi_chu,
    bkbqpCol: getHeaderCol(headerMap, ['bkbqp', 'nhan_bkbqp', 'bkbqp_khong_dien']),
    bkttcpCol: getHeaderCol(headerMap, ['bkttcp', 'nhan_bkttcp', 'bkttcp_khong_dien']),
    soQdBkbqpCol: getHeaderCol(headerMap, ['so_quyet_dinh_bkbqp', 'so_qd_bkbqp', 'soqdbkbqp']),
  };

  if (!columns.maDonViCol || !columns.namCol || !columns.danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  const maDonViSet = new Set<string>();
  const yearSet = new Set<number>();
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const maDonVi = String(row.getCell(columns.maDonViCol).value || '').trim();
    if (maDonVi) maDonViSet.add(maDonVi);
    const namParsed = parseInt(String(row.getCell(columns.namCol).value ?? ''), 10);
    if (!isNaN(namParsed)) yearSet.add(namParsed);
  }

  return {
    headerMap,
    columns,
    maDonViList: [...maDonViSet],
    allYears: [...yearSet],
  };
}

/**
 * Builds `ma_don_vi` -> unit lookup maps for CQDV and DVTT lists.
 * Pure: caller fetches both lists from the DB and passes them in.
 * @param coQuanDonViList - CQDV records fetched by `ma_don_vi`
 * @param donViTrucThuocList - DVTT records fetched by `ma_don_vi`
 * @returns Two maps keyed by `ma_don_vi` for O(1) lookup
 */
export function buildUnitLookupMaps<T extends { ma_don_vi: string }>(
  coQuanDonViList: T[],
  donViTrucThuocList: T[]
): { coQuanDonViByMa: Map<string, T>; donViTrucThuocByMa: Map<string, T> } {
  return {
    coQuanDonViByMa: new Map(coQuanDonViList.map(u => [u.ma_don_vi, u] as const)),
    donViTrucThuocByMa: new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u] as const)),
  };
}
