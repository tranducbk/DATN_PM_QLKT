import { prisma } from '../../models';
import ExcelJS from 'exceljs';
import {
  buildDanhHieuExcelOptions,
  DANH_HIEU_CA_NHAN_HANG_NAM,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { sanitizeRowData } from '../../helpers/excel/excelHelper';
import type { Prisma } from '../../generated/prisma';
import { buildTemplate, TemplateColumn, styleHeaderRow } from '../../helpers/excel/excelTemplateHelper';
import { EXPORT_FETCH_LIMIT } from '../../constants/excel.constants';
import {
  ANNUAL_PERSONAL_EXPORT_COLUMNS,
  AWARD_EXCEL_SHEETS,
  PERSONAL_ANNUAL_TEMPLATE_COLUMNS,
} from '../../constants/awardExcel.constants';
import type { ExportFilters } from './types';

export async function exportTemplate(
  personnelIds: string[] = [],
  repeatMap: Record<string, number> = {}
): Promise<ExcelJS.Workbook> {
  const columns: TemplateColumn[] = [...PERSONAL_ANNUAL_TEMPLATE_COLUMNS];

  return buildTemplate({
    sheetName: AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL,
    columns,
    personnelIds,
    repeatMap,
    loaiKhenThuong: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    danhHieuOptions: buildDanhHieuExcelOptions([
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTT,
      DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS,
    ]),
    editableColumnLetters: ['J', 'K'],
  });
}

export async function exportToExcel(filters: ExportFilters = {}): Promise<ExcelJS.Workbook> {
  const { nam, danh_hieu, don_vi_id, personnel_ids } = filters;

  const where: Prisma.DanhHieuHangNamWhereInput = {};
  if (nam) where.nam = nam;
  if (danh_hieu) where.danh_hieu = danh_hieu;
  if (personnel_ids && personnel_ids.length > 0) {
    where.quan_nhan_id = { in: personnel_ids };
  }
  if (don_vi_id) {
    where.QuanNhan = {
      OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
    };
  }

  const filteredAwards = await prisma.danhHieuHangNam.findMany({
    where,
    include: {
      QuanNhan: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: true,
        },
      },
    },
    orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
    take: EXPORT_FETCH_LIMIT,
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL);

  worksheet.columns = [...ANNUAL_PERSONAL_EXPORT_COLUMNS];

  styleHeaderRow(worksheet);

  filteredAwards.forEach((award, index) => {
    worksheet.addRow(
      sanitizeRowData({
        stt: index + 1,
        id: award.QuanNhan?.id ?? '',
        ho_ten: award.QuanNhan?.ho_ten ?? '',
        cap_bac: award.cap_bac ?? '',
        chuc_vu: award.chuc_vu ?? '',
        nam: award.nam,
        danh_hieu: award.danh_hieu ?? '',
        so_quyet_dinh: award.so_quyet_dinh ?? '',
        ghi_chu: award.ghi_chu ?? '',
        nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
        so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp ?? '',
        nhan_cstdtq: award.nhan_cstdtq ? 'Có' : '',
        so_quyet_dinh_cstdtq: award.so_quyet_dinh_cstdtq ?? '',
        nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
        so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp ?? '',
      })
    );
  });

  return workbook;
}
