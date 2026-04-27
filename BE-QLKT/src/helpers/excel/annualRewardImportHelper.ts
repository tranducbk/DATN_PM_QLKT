import ExcelJS from 'exceljs';
import { prisma } from '../../models';
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

export interface AnnualRewardImportContext {
  worksheet: ExcelJS.Worksheet;
  columns: ColumnMap;
  batchMaps: AnnualRewardBatchMaps;
  allYears: Set<number>;
  currentYear: number;
  validDanhHieu: Set<string>;
}

/**
 * Resolves the shared import context used by both previewImport and importFromExcelBuffer.
 * Handles workbook loading, header parsing, validation, and batch DB queries for personnel + existing awards.
 * Proposal queries are left to callers since they need different status filters.
 * @param buffer - Excel file buffer
 * @returns Parsed worksheet, column map, collected year set, and pre-fetched DB maps
 * @throws ValidationError - When required columns are missing or sheet type is wrong
 */
export async function resolveAnnualRewardImportContext(buffer: Buffer): Promise<AnnualRewardImportContext> {
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

  const allPersonnelIds = new Set<string>();
  const allYears = new Set<number>();
  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const idValue = columns.idCol ? row.getCell(columns.idCol).value : null;
    if (idValue) {
      const id = String(idValue).trim();
      if (id) allPersonnelIds.add(id);
    }
    const namVal = columns.namCol ? row.getCell(columns.namCol).value : null;
    if (namVal) {
      const parsed = parseInt(String(namVal), 10);
      if (!isNaN(parsed)) allYears.add(parsed);
    }
  }

  const [personnelList, existingRewards] = await Promise.all([
    prisma.quanNhan.findMany({
      where: { id: { in: [...allPersonnelIds] } },
      include: { ChucVu: { select: { ten_chuc_vu: true } } },
    }),
    prisma.danhHieuHangNam.findMany({
      where: { quan_nhan_id: { in: [...allPersonnelIds] } },
    }),
  ]);

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
    worksheet,
    columns,
    batchMaps: {
      personnelMap,
      existingAwardKeys,
      existingRewardByKey,
      rewardsByPersonnel,
    },
    allYears,
    currentYear: new Date().getFullYear(),
    validDanhHieu: DANH_HIEU_CA_NHAN_CO_BAN,
  };
}
