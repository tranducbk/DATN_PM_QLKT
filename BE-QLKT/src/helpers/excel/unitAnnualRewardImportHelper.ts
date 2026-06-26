import { UNIT_ANNUAL_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from './excelHelper';
import type ExcelJS from 'exceljs';
import { parseHeaderMap, getHeaderCol } from './excelHelper';
import { ValidationError } from '../../middlewares/errorHandler';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  UNIT ANNUAL IMPORT HELPER — parse sheet khen thưởng ĐƠN VỊ (pure)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Khác với cá nhân (annualRewardImportHelper): đơn vị định danh bằng MÃ ĐƠN VỊ
 *  (ma_don_vi) thay vì ID quân nhân, và đơn vị có thể là CQDV (cấp trên) HOẶC
 *  DVTT (cấp dưới) → cần 2 map lookup riêng (buildUnitLookupMaps).
 *
 *  Cả 2 hàm pure: chỉ đọc worksheet + build map. Service lo chọn sheet + query DB.
 *  Luồng dùng: service chọn worksheet → parseUnitAnnualRewardImport (gom mã/năm)
 *  → query CQDV+DVTT theo mã → buildUnitLookupMaps → loop validate từng dòng.
 * ════════════════════════════════════════════════════════════════════════════
 */

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

  // Cột chuẩn (id/mã/tên/năm/danh hiệu/số QĐ/ghi chú) đọc thẳng header từ config
  // export UNIT_ANNUAL_TEMPLATE_COLUMNS qua resolveTemplateColumns — 1 nguồn sự
  // thật, đổi tên cột template chỉ sửa 1 chỗ. null = cột không có trong file.
  const cols = resolveTemplateColumns(headerMap, UNIT_ANNUAL_TEMPLATE_COLUMNS);
  // 3 cột cờ phụ (BKBQP / BKTTCP / số QĐ BKBQP) không nằm trong template chuẩn nên
  // vẫn dò nhiều biến thể tên header bằng getHeaderCol cho linh hoạt.
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

  // Fail-fast nếu thiếu cột bắt buộc — báo luôn các header tìm thấy để admin sửa.
  if (!columns.maDonViCol || !columns.namCol || !columns.danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  // Quét 1 lượt gom MÃ ĐƠN VỊ + NĂM distinct (Set tự khử trùng) để service batch
  // query đơn vị/khen thưởng theo `IN (...)`, tránh N+1. Bỏ qua ô trống/năm hỏng.
  const maDonViSet = new Set<string>();
  const yearSet = new Set<number>();
  for (let r = 2; r <= worksheet.rowCount; r++) { // duyệt từ dòng 2 (bỏ header)
    const row = worksheet.getRow(r);
    const maDonVi = String(row.getCell(columns.maDonViCol).value || '').trim(); // đọc ô mã đơn vị
    if (maDonVi) maDonViSet.add(maDonVi);
    const namParsed = parseInt(String(row.getCell(columns.namCol).value ?? ''), 10); // ép ô năm về số
    if (!isNaN(namParsed)) yearSet.add(namParsed); // chỉ gom năm hợp lệ
  }

  return {
    headerMap,
    columns,
    maDonViList: [...maDonViSet], // Set → mảng mã đơn vị distinct
    allYears: [...yearSet], // Set → mảng năm distinct
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
  // 2 map tách biệt vì 1 mã có thể trùng giữa 2 cấp; service tra DVTT trước rồi
  // CQDV (hoặc theo rule scope) để xác định đúng đơn vị nhận khen thưởng.
  return {
    coQuanDonViByMa: new Map(coQuanDonViList.map(u => [u.ma_don_vi, u] as const)), // ma_don_vi → record CQDV
    donViTrucThuocByMa: new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u] as const)), // ma_don_vi → record DVTT
  };
}
