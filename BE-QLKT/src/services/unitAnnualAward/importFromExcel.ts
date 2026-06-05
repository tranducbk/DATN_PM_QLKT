import type { Prisma } from '../../generated/prisma';
import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { loadWorkbook } from '../../helpers/excel/excelImportHelper';
import {
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { getHeaderCol } from '../../helpers/excel/excelHelper';
import {
  parseUnitAnnualRewardImport,
  buildUnitLookupMaps,
} from '../../helpers/excel/unitAnnualRewardImportHelper';
import { NotFoundError, ValidationError } from '../../middlewares/errorHandler';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import type { UnitAnnualAwardDeps } from './types';
import { defaultDeps, checkUnitDuplicate } from './import';

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

  const { headerMap, columns, maDonViList, allYears } = parseUnitAnnualRewardImport(worksheet);
  const { maDonViCol, namCol, danhHieuCol, soQuyetDinhCol, ghiChuCol, bkbqpCol, soQdBkbqpCol } =
    columns;

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

  const [coQuanDonViList, donViTrucThuocList] = await Promise.all([
    coQuanDonViRepository.findManyRaw({ where: { ma_don_vi: { in: maDonViList } } }),
    donViTrucThuocRepository.findManyRaw({ where: { ma_don_vi: { in: maDonViList } } }),
  ]);
  const { coQuanDonViByMa, donViTrucThuocByMa } = buildUnitLookupMaps(
    coQuanDonViList,
    donViTrucThuocList
  );

  const allCQDVIds = coQuanDonViList.map(u => u.id);
  const allDVTTIds = donViTrucThuocList.map(u => u.id);
  const [existingAwardList, pendingProposalList] = await Promise.all([
    danhHieuDonViHangNamRepository.findMany({
      where: {
        AND: [
          {
            OR: [
              { co_quan_don_vi_id: { in: allCQDVIds } },
              { don_vi_truc_thuoc_id: { in: allDVTTIds } },
            ],
          },
          { nam: { in: allYears } },
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
        nam: { in: allYears },
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
        const dvttSoQdBkbqp = dvttIsBkbqp ? soQdBkbqp || soQuyetDinh || null : null;
        const dvttSoQdBkttcp = dvttIsBkttcp ? soQuyetDinh || null : null;

        const award = await danhHieuDonViHangNamRepository.upsert({
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
            so_quyet_dinh: isBkDvtt ? null : soQuyetDinh || null,
            ghi_chu: isBkDvtt ? null : ghiChu || null,
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
            ...(isBkDvtt ? {} : ghiChu ? { ghi_chu: ghiChu } : {}),
            ...(dvttIsBkbqp && {
              nhan_bkbqp: true,
              so_quyet_dinh_bkbqp: dvttSoQdBkbqp,
              ...(ghiChu && { ghi_chu_bkbqp: ghiChu }),
            }),
            ...(dvttIsBkttcp && {
              nhan_bkttcp: true,
              so_quyet_dinh_bkttcp: dvttSoQdBkttcp,
              ...(ghiChu && { ghi_chu_bkttcp: ghiChu }),
            }),
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
        const cqdvSoQdBkbqp = cqdvIsBkbqp ? soQdBkbqp || soQuyetDinh || null : null;
        const cqdvSoQdBkttcp = cqdvIsBkttcp ? soQuyetDinh || null : null;

        const award = await danhHieuDonViHangNamRepository.upsert({
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
            so_quyet_dinh: isBkCqdv ? null : soQuyetDinh || null,
            ghi_chu: isBkCqdv ? null : ghiChu || null,
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
            ...(isBkCqdv ? {} : ghiChu ? { ghi_chu: ghiChu } : {}),
            ...(cqdvIsBkbqp && {
              nhan_bkbqp: true,
              so_quyet_dinh_bkbqp: cqdvSoQdBkbqp,
              ...(ghiChu && { ghi_chu_bkbqp: ghiChu }),
            }),
            ...(cqdvIsBkttcp && {
              nhan_bkttcp: true,
              so_quyet_dinh_bkttcp: cqdvSoQdBkttcp,
              ...(ghiChu && { ghi_chu_bkttcp: ghiChu }),
            }),
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
