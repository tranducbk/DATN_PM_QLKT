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

  // Map cột linh hoạt: mỗi field thử nhiều biến thể tên header (admin có thể gõ
  // 'ma_don_vi' / 'ma' / 'madonvi'...) → khớp được hết. null = cột không có.
  const columns: UnitAnnualColumnMap = {
    idCol: getHeaderCol(headerMap, ['id', 'unit_id']),
    maDonViCol: getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']),
    tenDonViCol: getHeaderCol(headerMap, ['ten_don_vi', 'ten_donvi', 'ten', 'tendonvi']),
    namCol: getHeaderCol(headerMap, ['nam', 'year']),
    danhHieuCol: getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']),
    soQuyetDinhCol: getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd', 'soqd']),
    ghiChuCol: getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']),
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
  // 2 map tách biệt vì 1 mã có thể trùng giữa 2 cấp; service tra DVTT trước rồi
  // CQDV (hoặc theo rule scope) để xác định đúng đơn vị nhận khen thưởng.
  return {
    coQuanDonViByMa: new Map(coQuanDonViList.map(u => [u.ma_don_vi, u] as const)),
    donViTrucThuocByMa: new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u] as const)),
  };
}
