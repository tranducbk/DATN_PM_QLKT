import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';

import {
  getDanhHieuName,
  formatDanhHieuList,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import {
  parseHeaderMap,
  getHeaderCol,
  parseBooleanValue,
} from '../../helpers/excel/excelHelper';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import type { UnitAnnualAwardDeps, UnitAnnualAwardValidItem } from './types';
import { checkUnitAwardEligibility as defaultCheckUnitAwardEligibility } from './eligibility';

const defaultDeps: UnitAnnualAwardDeps = {
  recalculateAnnualUnit: async () => undefined,
  checkUnitAwardEligibility: defaultCheckUnitAwardEligibility,
  getSubUnits: async () => [],
};

/** Inline duplicate check using pre-fetched maps — replaces per-row checkDuplicateUnitAward calls. */
function checkUnitDuplicate(
  unitId: string,
  nam: number,
  danhHieu: string,
  existingAwardByUnitYear: Map<
    string,
    { danh_hieu: string | null; nhan_bkbqp: boolean; nhan_bkttcp: boolean }
  >,
  proposalsByYear: Map<number, Array<{ data_danh_hieu: any }>>
): void {
  const proposalsForYear = proposalsByYear.get(nam) ?? [];
  const hasPendingProposal = proposalsForYear.some(p => {
    const data = (p.data_danh_hieu as Array<Record<string, unknown>>) ?? [];
    return data.some(item => item.don_vi_id === unitId && item.danh_hieu === danhHieu);
  });
  if (hasPendingProposal) {
    throw new ValidationError(
      `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`
    );
  }

  const existingAward = existingAwardByUnitYear.get(`${unitId}_${nam}`);
  if (!existingAward) return;

  const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
  const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

  if (isDv && existingAward.danh_hieu) {
    if (existingAward.danh_hieu === danhHieu) {
      throw new ValidationError(
        `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
      );
    }
    throw new ValidationError(
      `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
    );
  }

  if (isBk) {
    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existingAward.nhan_bkbqp) {
      throw new ValidationError(
        `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
      );
    }
    if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existingAward.nhan_bkttcp) {
      throw new ValidationError(
        `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
      );
    }
  }

  if (isDv && (existingAward.nhan_bkbqp || existingAward.nhan_bkttcp)) {
    const existingBk = existingAward.nhan_bkbqp
      ? DANH_HIEU_DON_VI_HANG_NAM.BKBQP
      : DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
    throw new ValidationError(
      `Đơn vị đã có ${getDanhHieuName(existingBk)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
    );
  }

  if (isBk && existingAward.danh_hieu && DANH_HIEU_DON_VI_CO_BAN.has(existingAward.danh_hieu)) {
    throw new ValidationError(
      `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
    );
  }
}

export async function previewImport(buffer: Buffer, deps: UnitAnnualAwardDeps = defaultDeps) {
  const workbook = await loadWorkbook(buffer);
  const worksheet = getAndValidateWorksheet(workbook, {
    excludeSheetNames: ['_CapBac', '_QuyetDinh'],
  });

  const headerMap = parseHeaderMap(worksheet);

  const idCol = getHeaderCol(headerMap, ['id', 'unit_id']);
  const maDonViCol = getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
  const tenDonViCol = getHeaderCol(headerMap, ['ten_don_vi', 'ten_donvi', 'ten', 'tendonvi']);
  const namCol = getHeaderCol(headerMap, ['nam', 'year']);
  const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
  const soQuyetDinhCol = getHeaderCol(headerMap, [
    'so_quyet_dinh',
    'soquyetdinh',
    'so_qd',
    'soqd',
  ]);
  const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);
  const bkbqpCol = getHeaderCol(headerMap, ['bkbqp', 'nhan_bkbqp', 'bkbqp_khong_dien']);
  const bkttcpCol = getHeaderCol(headerMap, ['bkttcp', 'nhan_bkttcp', 'bkttcp_khong_dien']);

  if (!maDonViCol || !namCol || !danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
    );
  }

  const validDanhHieu = Object.values(DANH_HIEU_DON_VI_HANG_NAM) as string[];
  const errors = [];
  const valid = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  const existingDecisions = await prisma.fileQuyetDinh.findMany({
    select: { so_quyet_dinh: true },
  });
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  const allMaDonVi = new Set<string>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const maDonViVal = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
    if (maDonViVal) allMaDonVi.add(maDonViVal);
  }

  const [coQuanDonViList, donViTrucThuocList] = await Promise.all([
    prisma.coQuanDonVi.findMany({
      where: { ma_don_vi: { in: [...allMaDonVi] } },
    }),
    prisma.donViTrucThuoc.findMany({
      where: { ma_don_vi: { in: [...allMaDonVi] } },
    }),
  ]);

  const coQuanDonViMap = new Map(coQuanDonViList.map(u => [u.ma_don_vi, u]));
  const donViTrucThuocMap = new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u]));

  const allUnitIds = new Set<string>();
  for (const u of coQuanDonViList) allUnitIds.add(u.id);
  for (const u of donViTrucThuocList) allUnitIds.add(u.id);

  const existingUnitAwards = await prisma.danhHieuDonViHangNam.findMany({
    where: {
      OR: [
        { co_quan_don_vi_id: { in: [...allUnitIds] } },
        { don_vi_truc_thuoc_id: { in: [...allUnitIds] } },
      ],
    },
    select: {
      co_quan_don_vi_id: true,
      don_vi_truc_thuoc_id: true,
      nam: true,
      danh_hieu: true,
      nhan_bkbqp: true,
      nhan_bkttcp: true,
      so_quyet_dinh: true,
    },
  });

  const awardsByUnit = new Map<string, typeof existingUnitAwards>();
  for (const r of existingUnitAwards) {
    const unitId = r.co_quan_don_vi_id || r.don_vi_truc_thuoc_id;
    if (!unitId) continue;
    const list = awardsByUnit.get(unitId) || [];
    list.push(r);
    awardsByUnit.set(unitId, list);
  }

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
    const tenDonVi = tenDonViCol ? String(row.getCell(tenDonViCol).value || '').trim() : '';
    const namVal = namCol ? row.getCell(namCol).value : null;
    const danhHieuRaw = danhHieuCol ? String(row.getCell(danhHieuCol).value || '').trim() : '';
    const soQuyetDinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
      : '';
    const ghiChu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : '';
    const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value ?? '').trim() : '';
    const bkttcpRaw = bkttcpCol ? String(row.getCell(bkttcpCol).value ?? '').trim() : '';

    if (!maDonVi && !namVal && !danhHieuRaw && !idValue) continue;

    if (idValue && !danhHieuRaw) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam: namVal,
        danh_hieu: '',
        message: 'Bỏ qua — không có danh hiệu nào được điền',
      });
      continue;
    }

    total++;

    if (parseBooleanValue(bkbqpRaw)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam: namVal,
        danh_hieu: danhHieuRaw,
        message: 'BKBQP không được nhập qua Excel. Vui lòng chỉ thêm trên giao diện.',
      });
      continue;
    }
    if (parseBooleanValue(bkttcpRaw)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam: namVal,
        danh_hieu: danhHieuRaw,
        message: 'BKTTCP không được nhập qua Excel. Vui lòng chỉ thêm trên giao diện.',
      });
      continue;
    }

    const missingFields = [];
    if (!maDonVi) missingFields.push('Mã đơn vị');
    if (!namVal) missingFields.push('Năm');
    if (!danhHieuRaw) missingFields.push('Danh hiệu');
    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam: namVal,
        danh_hieu: danhHieuRaw,
        message: `Thiếu ${missingFields.join(', ')}`,
      });
      continue;
    }

    const nam = parseInt(String(namVal), 10);
    if (!Number.isInteger(nam)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam: namVal,
        danh_hieu: danhHieuRaw,
        message: `Giá trị năm không hợp lệ: ${namVal}`,
      });
      continue;
    }
    if (nam < 1900 || nam > currentYear) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieuRaw,
        message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
      });
      continue;
    }

    const danhHieu = danhHieuRaw.toUpperCase();
    if (!validDanhHieu.includes(danhHieu)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieuRaw,
        message: `Danh hiệu "${danhHieuRaw}" không hợp lệ. Chỉ chấp nhận: ${formatDanhHieuList(validDanhHieu)}`,
      });
      continue;
    }

    if (!soQuyetDinh) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieu,
        message: 'Thiếu số quyết định',
      });
      continue;
    }
    if (!validDecisionNumbers.has(soQuyetDinh)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieu,
        message: `Số quyết định "${soQuyetDinh}" không tồn tại trên hệ thống`,
      });
      continue;
    }

    const donVi = coQuanDonViMap.get(maDonVi);
    const isCoQuanDonVi = !!donVi;
    const donViTrucThuoc = donVi ? null : donViTrucThuocMap.get(maDonVi);

    if (!donVi && !donViTrucThuoc) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieu,
        message: `Không tìm thấy đơn vị với mã ${maDonVi}`,
      });
      continue;
    }

    const unitId = isCoQuanDonVi ? donVi.id : donViTrucThuoc.id;
    const unitName = isCoQuanDonVi ? donVi.ten_don_vi : donViTrucThuoc.ten_don_vi;

    const fileKey = `${unitId}_${nam}`;
    if (seenInFile.has(fileKey)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: unitName,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieu,
        message: `Trùng lặp trong file — cùng đơn vị, năm ${nam}`,
      });
      continue;
    }
    seenInFile.add(fileKey);

    const unitAwards = awardsByUnit.get(unitId) || [];
    const existingAward = unitAwards.find(a => a.nam === nam);
    if (existingAward && existingAward.danh_hieu) {
      errors.push({
        row: rowNumber,
        ten_don_vi: unitName,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieu,
        message: `Đã có danh hiệu ${existingAward.danh_hieu} năm ${nam} trên hệ thống`,
      });
      continue;
    }

    if (danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP) {
      const eligibility = await deps.checkUnitAwardEligibility(
        unitId,
        nam,
        DANH_HIEU_DON_VI_HANG_NAM.BKTTCP
      );
      if (!eligibility.eligible) {
        errors.push({
          row: rowNumber,
          ten_don_vi: unitName,
          ma_don_vi: maDonVi,
          nam,
          danh_hieu: danhHieu,
          message: eligibility.reason,
        });
        continue;
      }
    }

    const history = [...unitAwards]
      .sort((a, b) => b.nam - a.nam)
      .slice(0, 5)
      .map(r => ({
        nam: r.nam,
        danh_hieu: r.danh_hieu,
        nhan_bkbqp: r.nhan_bkbqp,
        nhan_bkttcp: r.nhan_bkttcp,
        so_quyet_dinh: r.so_quyet_dinh,
      }));

    valid.push({
      row: rowNumber,
      unit_id: unitId,
      is_co_quan_don_vi: isCoQuanDonVi,
      ma_don_vi: maDonVi,
      ten_don_vi: unitName,
      nam,
      danh_hieu: danhHieu,
      so_quyet_dinh: soQuyetDinh,
      ghi_chu: ghiChu || null,
      history,
    });
  }

  return { total, valid, errors };
}

export async function confirmImport(validItems: UnitAnnualAwardValidItem[], adminId: string) {
  const uniqueUnitIds = [...new Set(validItems.map(item => item.unit_id))];
  const uniqueYears = [...new Set(validItems.map(item => item.nam))];

  const [existingAwards, existingProposals] = await Promise.all([
    prisma.danhHieuDonViHangNam.findMany({
      where: {
        OR: [
          { co_quan_don_vi_id: { in: uniqueUnitIds }, nam: { in: uniqueYears } },
          { don_vi_truc_thuoc_id: { in: uniqueUnitIds }, nam: { in: uniqueYears } },
        ],
      },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
        nam: true,
        danh_hieu: true,
        nhan_bkbqp: true,
        nhan_bkttcp: true,
      },
    }),
    prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
        nam: { in: uniqueYears },
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  const awardMap = new Map<string, (typeof existingAwards)[number]>();
  for (const award of existingAwards) {
    const unitId = award.co_quan_don_vi_id || award.don_vi_truc_thuoc_id;
    if (unitId) awardMap.set(`${unitId}|${award.nam}`, award);
  }

  const duplicateErrors: string[] = [];
  for (const item of validItems) {
    const { unit_id: donViId, nam, danh_hieu: danhHieu } = item;

    const existingProposal = existingProposals.find(p => {
      const dataDanhHieu = (p.data_danh_hieu as Prisma.JsonArray) || [];
      return (dataDanhHieu as Array<Record<string, unknown>>).some(
        d => d.don_vi_id === donViId && d.danh_hieu === danhHieu
      );
    });
    if (existingProposal) {
      duplicateErrors.push(
        `Đơn vị đã có đề xuất danh hiệu ${getDanhHieuName(danhHieu)} cho năm ${nam}`
      );
      continue;
    }

    const existingAward = awardMap.get(`${donViId}|${nam}`);
    if (existingAward) {
      const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
      const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

      if (isDv && existingAward.danh_hieu) {
        if (existingAward.danh_hieu === danhHieu) {
          duplicateErrors.push(
            `Đơn vị đã có danh hiệu ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
          );
          continue;
        }
        duplicateErrors.push(
          `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
        );
        continue;
      }

      if (isBk) {
        if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP && existingAward.nhan_bkbqp) {
          duplicateErrors.push(
            `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
          );
          continue;
        }
        if (danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP && existingAward.nhan_bkttcp) {
          duplicateErrors.push(
            `Đơn vị đã có ${getDanhHieuName(danhHieu)} năm ${nam} trên hệ thống`
          );
          continue;
        }
      }

      if (isDv && (existingAward.nhan_bkbqp || existingAward.nhan_bkttcp)) {
        const existingBk = existingAward.nhan_bkbqp
          ? DANH_HIEU_DON_VI_HANG_NAM.BKBQP
          : DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
        duplicateErrors.push(
          `Đơn vị đã có ${getDanhHieuName(existingBk)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
        );
        continue;
      }
      if (
        isBk &&
        existingAward.danh_hieu &&
        DANH_HIEU_DON_VI_CO_BAN.has(existingAward.danh_hieu)
      ) {
        duplicateErrors.push(
          `Đơn vị đã có danh hiệu ${getDanhHieuName(existingAward.danh_hieu)} năm ${nam}, không thể thêm ${getDanhHieuName(danhHieu)}`
        );
        continue;
      }
    }
  }
  if (duplicateErrors.length > 0) {
    throw new ValidationError(duplicateErrors.join('; '));
  }

  const decisionErrors: string[] = [];
  for (const item of validItems) {
    const isBkBqp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
    const isBkTtcp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
    const errs = validateDecisionNumbers(
      {
        danh_hieu: isBkBqp || isBkTtcp ? null : item.danh_hieu,
        so_quyet_dinh: isBkBqp || isBkTtcp ? null : item.so_quyet_dinh,
        nhan_bkbqp: isBkBqp,
        so_quyet_dinh_bkbqp: isBkBqp ? item.so_quyet_dinh : null,
        nhan_bkttcp: isBkTtcp,
        so_quyet_dinh_bkttcp: isBkTtcp ? item.so_quyet_dinh : null,
      },
      { entityType: 'unit', entityName: item.ten_don_vi || item.unit_id }
    );
    decisionErrors.push(...errs);
  }
  if (decisionErrors.length > 0) {
    throw new ValidationError(decisionErrors.join('\n'));
  }

  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        const upsertWhere = item.is_co_quan_don_vi
          ? {
              unique_co_quan_don_vi_nam_dh: {
                co_quan_don_vi_id: item.unit_id,
                nam: item.nam,
              },
            }
          : {
              unique_don_vi_truc_thuoc_nam_dh: {
                don_vi_truc_thuoc_id: item.unit_id,
                nam: item.nam,
              },
            };

        const isBkBqp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
        const isBkTtcp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
        const isBk = isBkBqp || isBkTtcp;
        const finalDanhHieu = isBk ? null : item.danh_hieu;

        const sharedData: Record<string, any> = {
          ghi_chu: isBk ? undefined : (item.ghi_chu ?? null),
          so_quyet_dinh: isBk ? undefined : (item.so_quyet_dinh ?? null),
          ...(isBkBqp && {
            nhan_bkbqp: true,
            so_quyet_dinh_bkbqp: item.so_quyet_dinh ?? null,
            ...(item.ghi_chu && { ghi_chu_bkbqp: item.ghi_chu }),
          }),
          ...(isBkTtcp && {
            nhan_bkttcp: true,
            so_quyet_dinh_bkttcp: item.so_quyet_dinh ?? null,
            ...(item.ghi_chu && { ghi_chu_bkttcp: item.ghi_chu }),
          }),
        };

        const createData: Record<string, any> = {
          nam: item.nam,
          danh_hieu: finalDanhHieu,
          status: PROPOSAL_STATUS.APPROVED,
          nguoi_tao_id: adminId,
          ...sharedData,
        };

        if (item.is_co_quan_don_vi) {
          createData.co_quan_don_vi_id = item.unit_id;
        } else {
          createData.don_vi_truc_thuoc_id = item.unit_id;
        }

        const result = await prismaTx.danhHieuDonViHangNam.upsert({
          where: upsertWhere,
          update: {
            danh_hieu: finalDanhHieu,
            ...sharedData,
          },
          create: createData as Prisma.DanhHieuDonViHangNamUncheckedCreateInput,
        });
        results.push(result);
      }
      return { imported: results.length, data: results };
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT }
  );
}

export async function importFromExcel(
  buffer: Buffer,
  adminId: string,
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const workbook = await loadWorkbook(buffer);

  let worksheet = workbook.getWorksheet(AWARD_EXCEL_SHEETS.ANNUAL_UNIT);
  if (!worksheet) {
    worksheet = workbook.worksheets[0];
  }

  if (!worksheet) {
    throw new ValidationError('File Excel không hợp lệ hoặc không tìm thấy sheet dữ liệu');
  }

  const headerMap = parseHeaderMap(worksheet);

  const maDonViCol = getHeaderCol(headerMap, ['ma_don_vi', 'ma_donvi', 'ma', 'madonvi']);
  const namCol = getHeaderCol(headerMap, ['nam', 'year', 'năm']);
  const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu', 'danhieu']);
  const soQuyetDinhCol = getHeaderCol(headerMap, [
    'so_quyet_dinh',
    'soquyetdinh',
    'so_qd',
    'soqd',
  ]);
  const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch', 'ghich']);
  const bkbqpCol = getHeaderCol(headerMap, ['nhan_bkbqp', 'bkbqp']);
  const soQdBkbqpCol = getHeaderCol(headerMap, [
    'so_quyet_dinh_bkbqp',
    'so_qd_bkbqp',
    'soqdbkbqp',
  ]);

  if (!maDonViCol || !namCol || !danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: Mã đơn vị, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(
        headerMap
      ).join(', ')}`
    );
  }

  const hoTenCheck = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten']);
  const capBacCheck = getHeaderCol(headerMap, ['cap_bac', 'capbac']);
  if (hoTenCheck || capBacCheck) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
    );
  }

  const errors = [];
  const imported = [];
  let total = 0;
  const selectedUnitIds = [];

  const allMaDonVi = new Set<string>();
  const allYears = new Set<number>();
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
    const namVal = namCol ? row.getCell(namCol).value : null;
    if (maDonVi) allMaDonVi.add(maDonVi);
    const parsedNam = parseInt(String(namVal), 10);
    if (!isNaN(parsedNam)) allYears.add(parsedNam);
  }

  const [coQuanDonViList, donViTrucThuocList] = await Promise.all([
    prisma.coQuanDonVi.findMany({ where: { ma_don_vi: { in: [...allMaDonVi] } } }),
    prisma.donViTrucThuoc.findMany({ where: { ma_don_vi: { in: [...allMaDonVi] } } }),
  ]);
  const coQuanDonViByMa = new Map(coQuanDonViList.map(u => [u.ma_don_vi, u] as const));
  const donViTrucThuocByMa = new Map(donViTrucThuocList.map(u => [u.ma_don_vi, u] as const));

  const allCQDVIds = coQuanDonViList.map(u => u.id);
  const allDVTTIds = donViTrucThuocList.map(u => u.id);
  const [existingAwardList, pendingProposalList] = await Promise.all([
    prisma.danhHieuDonViHangNam.findMany({
      where: {
        AND: [
          {
            OR: [
              { co_quan_don_vi_id: { in: allCQDVIds } },
              { don_vi_truc_thuoc_id: { in: allDVTTIds } },
            ],
          },
          { nam: { in: [...allYears] } },
        ],
      },
      select: {
        co_quan_don_vi_id: true,
        don_vi_truc_thuoc_id: true,
        nam: true,
        danh_hieu: true,
        nhan_bkbqp: true,
        nhan_bkttcp: true,
      },
    }),
    prisma.bangDeXuat.findMany({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.DON_VI_HANG_NAM,
        nam: { in: [...allYears] },
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  const existingAwardByUnitYear = new Map<string, (typeof existingAwardList)[number]>();
  for (const award of existingAwardList) {
    if (award.co_quan_don_vi_id)
      existingAwardByUnitYear.set(`${award.co_quan_don_vi_id}_${award.nam}`, award);
    if (award.don_vi_truc_thuoc_id)
      existingAwardByUnitYear.set(`${award.don_vi_truc_thuoc_id}_${award.nam}`, award);
  }
  const proposalsByYear = new Map<number, typeof pendingProposalList>();
  for (const proposal of pendingProposalList) {
    if (proposal.nam == null) continue;
    const list = proposalsByYear.get(proposal.nam) ?? [];
    list.push(proposal);
    proposalsByYear.set(proposal.nam, list);
  }

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    const maDonVi = maDonViCol ? String(row.getCell(maDonViCol).value || '').trim() : '';
    const namVal = namCol ? row.getCell(namCol).value : null;
    const danhHieu = danhHieuCol ? String(row.getCell(danhHieuCol).value || '').trim() : '';
    const soQuyetDinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value || '').trim()
      : '';
    const ghiChu = ghiChuCol ? String(row.getCell(ghiChuCol).value || '').trim() : '';
    const bkbqpRaw = bkbqpCol ? String(row.getCell(bkbqpCol).value || '').trim() : '';
    const nhanBkbqp = ['có', 'co', 'true', '1', 'x'].includes(bkbqpRaw.toLowerCase());
    const soQdBkbqp = soQdBkbqpCol ? String(row.getCell(soQdBkbqpCol).value || '').trim() : '';

    if (!maDonVi && !namVal && !danhHieu) continue;

    total++;

    try {
      if (!maDonVi || !namVal || !danhHieu) {
        throw new ValidationError(
          `Thiếu thông tin bắt buộc: Mã đơn vị=${maDonVi}, Năm=${namVal}, Danh hiệu=${danhHieu}`
        );
      }

      const nam = parseInt(String(namVal), 10);
      if (!Number.isInteger(nam)) {
        throw new ValidationError(`Giá trị năm không hợp lệ: ${namVal}`);
      }

      if (!(Object.values(DANH_HIEU_DON_VI_HANG_NAM) as string[]).includes(danhHieu)) {
        throw new ValidationError(
          `Danh hiệu không hợp lệ: ${danhHieu}. Danh hiệu hợp lệ: ${Object.values(DANH_HIEU_DON_VI_HANG_NAM).join(', ')}`
        );
      }

      const checkDanhHieu =
        danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP ? DANH_HIEU_DON_VI_HANG_NAM.BKTTCP : null;
      const checkBkbqp = bkbqpRaw ? DANH_HIEU_DON_VI_HANG_NAM.BKBQP : null;

      const donVi = coQuanDonViByMa.get(maDonVi) ?? null;

      if (!donVi) {
        const donViTrucThuoc = donViTrucThuocByMa.get(maDonVi) ?? null;

        if (!donViTrucThuoc) {
          throw new NotFoundError(`đơn vị với mã ${maDonVi}`);
        }

        if (checkDanhHieu) {
          const eligibility = await deps.checkUnitAwardEligibility(
            donViTrucThuoc.id,
            nam,
            checkDanhHieu
          );
          if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
        }
        if (checkBkbqp) {
          const eligibility = await deps.checkUnitAwardEligibility(
            donViTrucThuoc.id,
            nam,
            DANH_HIEU_DON_VI_HANG_NAM.BKBQP
          );
          if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
        }

        checkUnitDuplicate(
          donViTrucThuoc.id,
          nam,
          danhHieu,
          existingAwardByUnitYear,
          proposalsByYear
        );

        const isBkDvtt = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);
        const finalDhDvtt = isBkDvtt ? null : danhHieu;
        const dvttIsBkbqp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP || nhanBkbqp;
        const dvttIsBkttcp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
        const dvttSoQdBkbqp = dvttIsBkbqp ? (soQdBkbqp || soQuyetDinh || null) : null;
        const dvttSoQdBkttcp = dvttIsBkttcp ? (soQuyetDinh || null) : null;

        const award = await prisma.danhHieuDonViHangNam.upsert({
          where: {
            unique_don_vi_truc_thuoc_nam_dh: {
              don_vi_truc_thuoc_id: donViTrucThuoc.id,
              nam,
            },
          },
          create: {
            don_vi_truc_thuoc_id: donViTrucThuoc.id,
            nam,
            danh_hieu: finalDhDvtt,
            so_quyet_dinh: isBkDvtt ? null : (soQuyetDinh || null),
            ghi_chu: isBkDvtt ? null : (ghiChu || null),
            nhan_bkbqp: dvttIsBkbqp,
            so_quyet_dinh_bkbqp: dvttSoQdBkbqp,
            ...(dvttIsBkbqp && ghiChu && { ghi_chu_bkbqp: ghiChu }),
            nhan_bkttcp: dvttIsBkttcp,
            so_quyet_dinh_bkttcp: dvttSoQdBkttcp,
            ...(dvttIsBkttcp && ghiChu && { ghi_chu_bkttcp: ghiChu }),
            status: PROPOSAL_STATUS.APPROVED,
            nguoi_tao_id: adminId,
          },
          update: {
            ...(isBkDvtt ? {} : { danh_hieu: finalDhDvtt, so_quyet_dinh: soQuyetDinh || null }),
            ...(isBkDvtt ? {} : (ghiChu ? { ghi_chu: ghiChu } : {})),
            ...(dvttIsBkbqp && { nhan_bkbqp: true, so_quyet_dinh_bkbqp: dvttSoQdBkbqp, ...(ghiChu && { ghi_chu_bkbqp: ghiChu }) }),
            ...(dvttIsBkttcp && { nhan_bkttcp: true, so_quyet_dinh_bkttcp: dvttSoQdBkttcp, ...(ghiChu && { ghi_chu_bkttcp: ghiChu }) }),
          },
        });
        imported.push(award);
        if (!selectedUnitIds.includes(donViTrucThuoc.id)) {
          selectedUnitIds.push(donViTrucThuoc.id);
        }
      } else {
        if (checkDanhHieu) {
          const eligibility = await deps.checkUnitAwardEligibility(donVi.id, nam, checkDanhHieu);
          if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
        }
        if (checkBkbqp) {
          const eligibility = await deps.checkUnitAwardEligibility(
            donVi.id,
            nam,
            DANH_HIEU_DON_VI_HANG_NAM.BKBQP
          );
          if (!eligibility.eligible) throw new ValidationError(eligibility.reason);
        }

        checkUnitDuplicate(donVi.id, nam, danhHieu, existingAwardByUnitYear, proposalsByYear);

        const isBkCqdv = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);
        const finalDhCqdv = isBkCqdv ? null : danhHieu;
        const cqdvIsBkbqp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP || nhanBkbqp;
        const cqdvIsBkttcp = danhHieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
        const cqdvSoQdBkbqp = cqdvIsBkbqp ? (soQdBkbqp || soQuyetDinh || null) : null;
        const cqdvSoQdBkttcp = cqdvIsBkttcp ? (soQuyetDinh || null) : null;

        const award = await prisma.danhHieuDonViHangNam.upsert({
          where: {
            unique_co_quan_don_vi_nam_dh: {
              co_quan_don_vi_id: donVi.id,
              nam,
            },
          },
          create: {
            co_quan_don_vi_id: donVi.id,
            nam,
            danh_hieu: finalDhCqdv,
            so_quyet_dinh: isBkCqdv ? null : (soQuyetDinh || null),
            ghi_chu: isBkCqdv ? null : (ghiChu || null),
            nhan_bkbqp: cqdvIsBkbqp,
            so_quyet_dinh_bkbqp: cqdvSoQdBkbqp,
            ...(cqdvIsBkbqp && ghiChu && { ghi_chu_bkbqp: ghiChu }),
            nhan_bkttcp: cqdvIsBkttcp,
            so_quyet_dinh_bkttcp: cqdvSoQdBkttcp,
            ...(cqdvIsBkttcp && ghiChu && { ghi_chu_bkttcp: ghiChu }),
            status: PROPOSAL_STATUS.APPROVED,
            nguoi_tao_id: adminId,
          },
          update: {
            ...(isBkCqdv ? {} : { danh_hieu: finalDhCqdv, so_quyet_dinh: soQuyetDinh || null }),
            ...(isBkCqdv ? {} : (ghiChu ? { ghi_chu: ghiChu } : {})),
            ...(cqdvIsBkbqp && { nhan_bkbqp: true, so_quyet_dinh_bkbqp: cqdvSoQdBkbqp, ...(ghiChu && { ghi_chu_bkbqp: ghiChu }) }),
            ...(cqdvIsBkttcp && { nhan_bkttcp: true, so_quyet_dinh_bkttcp: cqdvSoQdBkttcp, ...(ghiChu && { ghi_chu_bkttcp: ghiChu }) }),
          },
        });
        imported.push(award);
        if (!selectedUnitIds.includes(donVi.id)) {
          selectedUnitIds.push(donVi.id);
        }
      }
    } catch (error) {
      errors.push(`Dòng ${i}: ${error.message}`);
    }
  }

  return {
    total,
    imported: imported.length,
    errors,
    selectedUnitIds,
  };
}
