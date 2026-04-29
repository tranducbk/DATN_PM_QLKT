import { prisma } from '../../models';
import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../repositories/unit.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import type { Prisma } from '../../generated/prisma';
import ExcelJS from 'exceljs';
import {
  getDanhHieuName,
  DANH_HIEU_DON_VI_HANG_NAM,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { ROLES } from '../../constants/roles.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { sanitizeRowData } from '../../helpers/excel/excelHelper';
import { applyThinBordersToGrid, styleHeaderRow } from '../../helpers/excel/excelTemplateHelper';
import {
  EXCEL_INLINE_VALIDATION_MAX_LENGTH,
  MIN_TEMPLATE_ROWS,
  EXPORT_FETCH_LIMIT,
} from '../../constants/excel.constants';
import {
  AWARD_EXCEL_SHEETS,
  EXCEL_HEADER_FILL_COLOR,
  EXCEL_HIGHLIGHT_FILL_COLOR,
  UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA,
  UNIT_ANNUAL_EXPORT_COLUMNS,
  UNIT_ANNUAL_TEMPLATE_COLUMNS,
} from '../../constants/awardExcel.constants';

export async function exportTemplate(
  unitIds: string[] = [],
  repeatMap: Record<string, number> = {}
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_UNIT);

  const columns = [...UNIT_ANNUAL_TEMPLATE_COLUMNS];

  worksheet.columns = columns;

  const headerRowObj = worksheet.getRow(1);
  headerRowObj.font = { bold: true };
  headerRowObj.fill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: EXCEL_HEADER_FILL_COLOR },
  };

  const readonlyFill = {
    type: 'pattern' as const,
    pattern: 'solid' as const,
    fgColor: { argb: EXCEL_HIGHLIGHT_FILL_COLOR },
  };
  for (let col = 1; col <= 4; col++) {
    headerRowObj.getCell(col).fill = readonlyFill;
  }

  const danhHieuValidation = {
    type: 'list' as const,
    allowBlank: true,
    formulae: [UNIT_ANNUAL_DANH_HIEU_VALIDATION_FORMULA],
  };

  const existingDecisions = await decisionFileRepository.findManyRaw({
    where: { loai_khen_thuong: PROPOSAL_TYPES.DON_VI_HANG_NAM },
    select: { so_quyet_dinh: true },
    orderBy: { nam: 'desc' },
  });
  const decisionList = existingDecisions.map(d => d.so_quyet_dinh).filter(Boolean);
  let soQdValidation = null;
  if (decisionList.length > 0) {
    const formulaStr = decisionList.join(',');
    if (formulaStr.length < EXCEL_INLINE_VALIDATION_MAX_LENGTH) {
      soQdValidation = {
        type: 'list' as const,
        allowBlank: true,
        formulae: [`"${formulaStr}"`],
      };
    } else {
      const refSheet = workbook.addWorksheet('_QuyetDinh', { state: 'veryHidden' });
      decisionList.forEach((sqd, idx) => {
        refSheet.getCell(`A${idx + 1}`).value = sqd;
      });
      soQdValidation = {
        type: 'list' as const,
        allowBlank: true,
        formulae: [`_QuyetDinh!$A$1:$A$${decisionList.length}`],
      };
    }
  }

  if (unitIds && unitIds.length > 0) {
    const coQuanDonVis = await coQuanDonViRepository.findManyRaw({
      where: { id: { in: unitIds } },
    });
    const donViTrucThuocs = await donViTrucThuocRepository.findManyRaw({
      where: { id: { in: unitIds } },
    });

    const unitMap = new Map();
    coQuanDonVis.forEach(u => unitMap.set(u.id, { ...u, unitType: 'cqDv' }));
    donViTrucThuocs.forEach(u => unitMap.set(u.id, { ...u, unitType: 'dvtt' }));

    let stt = 1;
    for (const uid of unitIds) {
      const unit = unitMap.get(uid);
      if (!unit) continue;

      const rowCount = repeatMap[uid] || 1;
      for (let r = 0; r < rowCount; r++) {
        const dataRow = worksheet.addRow(
          sanitizeRowData({
            stt,
            id: unit.id,
            ma_don_vi: unit.ma_don_vi || '',
            ten_don_vi: unit.ten_don_vi || '',
            nam: '',
            danh_hieu: '',
            so_quyet_dinh: '',
            ghi_chu: '',
          })
        );

        for (let col = 1; col <= 4; col++) {
          dataRow.getCell(col).fill = readonlyFill;
        }

        stt++;
      }
    }
  } else {
    worksheet.addRow(
      sanitizeRowData({
        stt: 1,
        id: '',
        ma_don_vi: 'DV001',
        ten_don_vi: 'Đơn vị mẫu',
        nam: new Date().getFullYear(),
        danh_hieu: DANH_HIEU_DON_VI_HANG_NAM.DVQT,
        so_quyet_dinh: '',
        ghi_chu: '',
      })
    );
  }

  const totalPrefillRows = unitIds.reduce((sum, uid) => sum + (repeatMap[uid] || 1), 0);
  const maxRows = Math.max(totalPrefillRows + 1, MIN_TEMPLATE_ROWS);
  for (let r = 2; r <= maxRows; r++) {
    worksheet.getCell(`F${r}`).dataValidation = danhHieuValidation;
    if (soQdValidation) {
      worksheet.getCell(`G${r}`).dataValidation = soQdValidation;
    }
  }

  const editableColumns = ['F', 'G'];
  editableColumns.forEach(col => {
    worksheet.addConditionalFormatting({
      ref: `${col}2:${col}${maxRows}`,
      rules: [
        {
          type: 'expression',
          formulae: [`LEN(TRIM(${col}2))>0`],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: EXCEL_HIGHLIGHT_FILL_COLOR },
            },
          },
          priority: 1,
        },
      ],
    });
  });

  applyThinBordersToGrid(worksheet, maxRows, columns.length);

  return workbook;
}

export async function exportToExcel(
  filters: Record<string, any> = {},
  userRole: string,
  userQuanNhanId: string
) {
  const { nam, danh_hieu } = filters;

  const where: Record<string, any> = { status: PROPOSAL_STATUS.APPROVED };
  if (nam) where.nam = nam;
  if (danh_hieu) where.danh_hieu = danh_hieu;

  if (userRole === ROLES.MANAGER && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (user?.co_quan_don_vi_id) {
      where.co_quan_don_vi_id = user.co_quan_don_vi_id;
    } else if (user?.don_vi_truc_thuoc_id) {
      where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
    }
  }

  const awards = (await danhHieuDonViHangNamRepository.findMany({
    where,
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: true,
    },
    orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
    take: EXPORT_FETCH_LIMIT,
  })) as Prisma.DanhHieuDonViHangNamGetPayload<{
    include: { CoQuanDonVi: true; DonViTrucThuoc: true };
  }>[];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_UNIT);

  worksheet.columns = [...UNIT_ANNUAL_EXPORT_COLUMNS];

  styleHeaderRow(worksheet);

  awards.forEach((award, index) => {
    const donVi = award.CoQuanDonVi || award.DonViTrucThuoc;
    worksheet.addRow(
      sanitizeRowData({
        stt: index + 1,
        ma_don_vi: donVi?.ma_don_vi || '',
        ten_don_vi: donVi?.ten_don_vi || '',
        nam: award.nam,
        danh_hieu: getDanhHieuName(award.danh_hieu),
        so_quyet_dinh: award.so_quyet_dinh || '',
        nhan_bkbqp: award.nhan_bkbqp ? 'Có' : '',
        so_quyet_dinh_bkbqp: award.so_quyet_dinh_bkbqp || '',
        nhan_bkttcp: award.nhan_bkttcp ? 'Có' : '',
        so_quyet_dinh_bkttcp: award.so_quyet_dinh_bkttcp || '',
        ghi_chu: award.ghi_chu || '',
      })
    );
  });

  return workbook;
}

export async function getStatistics(
  filters: Record<string, any> = {},
  userRole: string,
  userQuanNhanId: string
) {
  const { nam } = filters;

  const where: Record<string, any> = { status: PROPOSAL_STATUS.APPROVED };
  if (nam) where.nam = nam;

  if (userRole === ROLES.MANAGER && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (user?.co_quan_don_vi_id) {
      where.co_quan_don_vi_id = user.co_quan_don_vi_id;
    } else if (user?.don_vi_truc_thuoc_id) {
      where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
    }
  }

  const awards = await danhHieuDonViHangNamRepository.findMany({
    where,
  });

  const byDanhHieu = awards.reduce((acc, award) => {
    const key = award.danh_hieu;
    if (!acc[key]) {
      acc[key] = { danh_hieu: key, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {});

  const byNam = awards.reduce((acc, award) => {
    const key = award.nam;
    if (!acc[key]) {
      acc[key] = { nam: key, count: 0 };
    }
    acc[key].count++;
    return acc;
  }, {});

  return {
    total: awards.length,
    byDanhHieu: Object.values(byDanhHieu),
    byNam: Object.values(byNam).sort(
      (a, b) => (b as { nam: number }).nam - (a as { nam: number }).nam
    ),
  };
}
