import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from './excelImportHelper';
import { parseHeaderMap, getHeaderCol } from './excelHelper';
import { DANH_HIEU_CA_NHAN_CO_BAN } from '../../constants/danhHieu.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import type { QuanNhan, DanhHieuHangNam } from '../../generated/prisma';

export interface ColumnMap {
  idCol: number | null;
  hoTenCol: number | null;
  namCol: number | null;
  danhHieuCol: number | null;
  capBacCol: number | null;
  chucVuCol: number | null;
  ghiChuCol: number | null;
  bkbqpCol: number | null;
  cstdtqCol: number | null;
  bkttcpCol: number | null;
  soQuyetDinhCol: number | null;
}

export interface AnnualRewardBatchMaps {
  personnelMap: Map<string, QuanNhan & { ChucVu: { ten_chuc_vu: string } | null }>;
  existingAwardKeys: Set<string>;
  existingRewardByKey: Map<string, DanhHieuHangNam>;
  rewardsByPersonnel: Map<string, DanhHieuHangNam[]>;
}

export interface ParsedAnnualRewardImport {
  worksheet: ExcelJS.Worksheet;
  columns: ColumnMap;
  personnelIds: string[];
  allYears: Set<number>;
}

export interface AnnualRewardImportContext {
  worksheet: ExcelJS.Worksheet;
  columns: ColumnMap;
  batchMaps: AnnualRewardBatchMaps;
  allYears: Set<number>;
  currentYear: number;
  validDanhHieu: Set<string>;
}

/**
 * Parses the Excel buffer into worksheet + column map and collects personnel IDs / years.
 * Pure: does not touch the database.
 * @param buffer - Excel file buffer
 * @returns Parsed worksheet, column map, distinct personnel IDs, distinct years
 * @throws ValidationError - When required columns are missing or sheet type is wrong
 */
export async function parseAnnualRewardImport(buffer: Buffer): Promise<ParsedAnnualRewardImport> {
  const workbook = await loadWorkbook(buffer);
  const worksheet = getAndValidateWorksheet(workbook, {
    excludeSheetNames: ['_CapBac', '_QuyetDinh'],
  });

  const headerMap = parseHeaderMap(worksheet);

  const columns: ColumnMap = {
    idCol: getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']),
    hoTenCol: getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']),
    namCol: getHeaderCol(headerMap, ['nam', 'year']),
    danhHieuCol: getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']),
    capBacCol: getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']),
    chucVuCol: getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']),
    ghiChuCol: getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']),
    bkbqpCol: getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']),
    cstdtqCol: getHeaderCol(headerMap, ['nhan_cstdtq', 'cstdtq']),
    bkttcpCol: getHeaderCol(headerMap, ['nhan_bkttcp', 'bkttcp']),
    soQuyetDinhCol: getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']),
  };

  if (!columns.idCol || !columns.namCol || !columns.danhHieuCol) {
    throw new ValidationError(
      `File thiếu cột bắt buộc (cần có: mã quân nhân hoặc ID, Năm, Danh hiệu). Các cột đang có: ${Object.keys(headerMap).join(', ') || '(trống)'}.`
    );
  }

  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_UNIT) {
    throw new ValidationError(
      'Sai loại file: đây là mẫu khen thưởng đơn vị. Vui lòng dùng mẫu danh hiệu cá nhân hằng năm.'
    );
  }

  const personnelIdSet = new Set<string>();
  const allYears = new Set<number>();
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const idValue = columns.idCol ? row.getCell(columns.idCol).value : null;
    if (idValue) {
      const id = String(idValue).trim();
      if (id) personnelIdSet.add(id);
    }
    const namVal = columns.namCol ? row.getCell(columns.namCol).value : null;
    if (namVal) {
      const parsed = parseInt(String(namVal), 10);
      if (!isNaN(parsed)) allYears.add(parsed);
    }
  }

  return {
    worksheet,
    columns,
    personnelIds: [...personnelIdSet],
    allYears,
  };
}

/**
 * Builds the batch lookup maps used when validating annual reward imports.
 * Pure: caller fetches personnel + existing rewards from the DB and passes them in.
 * @param personnelList - Personnel records (with `ChucVu`) fetched from DB
 * @param existingRewards - Existing annual reward records fetched from DB
 * @returns Personnel/reward maps keyed for O(1) lookup
 */
export function buildAnnualRewardBatchMaps(
  personnelList: Array<QuanNhan & { ChucVu: { ten_chuc_vu: string } | null }>,
  existingRewards: DanhHieuHangNam[]
): AnnualRewardBatchMaps {
  const personnelMap = new Map(personnelList.map(p => [p.id, p] as const));

  const existingAwardKeys = new Set(
    existingRewards.map(d => `${d.quan_nhan_id}_${d.nam}_${d.danh_hieu}`)
  );

  const existingRewardByKey = new Map(
    existingRewards.map(d => [`${d.quan_nhan_id}_${d.nam}`, d] as const)
  );

  const rewardsByPersonnel = new Map<string, DanhHieuHangNam[]>();
  for (const r of existingRewards) {
    const list = rewardsByPersonnel.get(r.quan_nhan_id) || [];
    list.push(r);
    rewardsByPersonnel.set(r.quan_nhan_id, list);
  }

  return {
    personnelMap,
    existingAwardKeys,
    existingRewardByKey,
    rewardsByPersonnel,
  };
}

/**
 * Assembles the full import context from parsed parts + pre-fetched batch maps.
 * Pure: caller is responsible for DB queries.
 * @param parsed - Output of `parseAnnualRewardImport`
 * @param batchMaps - Output of `buildAnnualRewardBatchMaps`
 * @returns Context consumed by preview / confirm import flows
 */
export function buildAnnualRewardImportContext(
  parsed: ParsedAnnualRewardImport,
  batchMaps: AnnualRewardBatchMaps
): AnnualRewardImportContext {
  return {
    worksheet: parsed.worksheet,
    columns: parsed.columns,
    batchMaps,
    allYears: parsed.allYears,
    currentYear: new Date().getFullYear(),
    validDanhHieu: DANH_HIEU_CA_NHAN_CO_BAN,
  };
}
