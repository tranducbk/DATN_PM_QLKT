import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
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
import { parseBooleanValue } from '../../helpers/excel/excelHelper';
import {
  parseUnitAnnualRewardImport,
  buildUnitLookupMaps,
} from '../../helpers/excel/unitAnnualRewardImportHelper';
import { ValidationError } from '../../middlewares/errorHandler';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import type { UnitAnnualAwardValidItem } from './types';

export async function previewImport(buffer: Buffer) {
  const workbook = await loadWorkbook(buffer);
  const worksheet = getAndValidateWorksheet(workbook, {
    excludeSheetNames: ['_CapBac', '_QuyetDinh'],
  });

  const { columns, maDonViList } = parseUnitAnnualRewardImport(worksheet);
  const {
    idCol,
    maDonViCol,
    tenDonViCol,
    namCol,
    danhHieuCol,
    soQuyetDinhCol,
    ghiChuCol,
    bkbqpCol,
    bkttcpCol,
  } = columns;

  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file khen thưởng cá nhân, không phải đơn vị hằng năm.'
    );
  }

  const validDanhHieu = DANH_HIEU_DON_VI_CO_BAN;
  const errors = [];
  const valid = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  const existingDecisions = await decisionFileRepository.findManyRaw({
    select: { so_quyet_dinh: true },
  });
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  const [coQuanDonViList, donViTrucThuocList] = await Promise.all([
    coQuanDonViRepository.findManyRaw({
      where: { ma_don_vi: { in: maDonViList } },
    }),
    donViTrucThuocRepository.findManyRaw({
      where: { ma_don_vi: { in: maDonViList } },
    }),
  ]);

  const { coQuanDonViByMa: coQuanDonViMap, donViTrucThuocByMa: donViTrucThuocMap } =
    buildUnitLookupMaps(coQuanDonViList, donViTrucThuocList);

  const allUnitIds = new Set<string>();
  for (const u of coQuanDonViList) allUnitIds.add(u.id);
  for (const u of donViTrucThuocList) allUnitIds.add(u.id);

  const existingUnitAwards = await danhHieuDonViHangNamRepository.findMany({
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
    if (!validDanhHieu.has(danhHieu)) {
      errors.push({
        row: rowNumber,
        ten_don_vi: tenDonVi,
        ma_don_vi: maDonVi,
        nam,
        danh_hieu: danhHieuRaw,
        message: `Danh hiệu "${danhHieuRaw}" không hợp lệ. Chỉ chấp nhận: ${formatDanhHieuList([...validDanhHieu])}`,
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
    danhHieuDonViHangNamRepository.findMany({
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
    proposalRepository.findManyRaw({
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

        const sharedData: Partial<Prisma.DanhHieuDonViHangNamUncheckedCreateInput> = {
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

        const createData: Prisma.DanhHieuDonViHangNamUncheckedCreateInput = {
          nam: item.nam,
          danh_hieu: finalDanhHieu,
          nguoi_tao_id: adminId,
          ...sharedData,
          ...(item.is_co_quan_don_vi
            ? { co_quan_don_vi_id: item.unit_id }
            : { don_vi_truc_thuoc_id: item.unit_id }),
        };

        const result = await danhHieuDonViHangNamRepository.upsert(
          {
            where: upsertWhere,
            update: {
              danh_hieu: finalDanhHieu,
              ...sharedData,
            },
            create: createData,
          },
          prismaTx
        );
        results.push(result);
      }
      return { imported: results.length, data: results };
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT }
  );
}
