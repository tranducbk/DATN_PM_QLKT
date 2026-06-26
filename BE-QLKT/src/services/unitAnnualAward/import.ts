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

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  UNIT ANNUAL IMPORT — preview (validate) + confirm (ghi DB) cho khen thưởng ĐƠN VỊ
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Cùng khung 2-bước như cá nhân, nhưng định danh bằng MÃ ĐƠN VỊ (ma_don_vi):
 *  parse gom mã → query CQDV + DVTT theo mã (buildUnitLookupMaps) → tra đơn vị
 *  cho từng dòng. Cờ BKBQP/BKTTCP đơn vị cũng không import qua Excel (như cá nhân).
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Bước 1 (preview): đọc file Excel, validate từng dòng và trả về danh sách
 * hợp lệ + lỗi để admin xem trước khi ghi DB. Chưa ghi gì vào DB.
 * @param buffer - Nội dung file Excel (.xlsx) dạng buffer
 * @returns Tổng số dòng xét, mảng `valid` (kèm lịch sử đơn vị) và mảng `errors`
 */
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

  // Chặn nhầm file: sheet cá nhân có cấu trúc cột khác → từ chối ngay
  // để khỏi tra mã đơn vị trên dữ liệu không phải đơn vị.
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

  // Nạp trước toàn bộ số quyết định đang có trên hệ thống thành Set để
  // mỗi dòng chỉ tra O(1), thay vì query DB lặp trong vòng lặp validate.
  const existingDecisions = await decisionFileRepository.findManyRaw({
    select: { so_quyet_dinh: true },
  });
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  // Mã đơn vị có thể là CQDV hoặc DVTT → query SONG SONG cả 2 bảng theo `IN (mã)`
  // (batch, tránh N+1) rồi buildUnitLookupMaps để tra cứu khi validate từng dòng.
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

  // Gom id của mọi đơn vị tìm được (cả CQDV lẫn DVTT) để truy danh hiệu cũ 1 lần.
  const allUnitIds = new Set<string>();
  for (const u of coQuanDonViList) allUnitIds.add(u.id);
  for (const u of donViTrucThuocList) allUnitIds.add(u.id);

  // Lấy sẵn danh hiệu đã trao của các đơn vị này để: (1) chặn trùng năm,
  // (2) dựng `history` 5 năm gần nhất cho preview. OR vì id có thể nằm ở
  // 1 trong 2 cột FK (CQDV hoặc DVTT) tuỳ cấp đơn vị.
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

  // Index danh hiệu cũ theo id đơn vị để tra O(1) trong vòng lặp.
  // Ưu tiên CQDV trước DVTT khi gom key: 1 dòng danh hiệu chỉ thuộc 1 đơn vị.
  const awardsByUnit = new Map<string, typeof existingUnitAwards>();
  for (const r of existingUnitAwards) {
    const unitId = r.co_quan_don_vi_id || r.don_vi_truc_thuoc_id;
    if (!unitId) continue;
    const list = awardsByUnit.get(unitId) || [];
    list.push(r);
    awardsByUnit.set(unitId, list);
  }

  // Duyệt từ dòng 2 (dòng 1 là tiêu đề cột). Mỗi dòng tự validate độc lập:
  // lỗi thì push vào `errors` + `continue`, hợp lệ thì push vào `valid`.
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

    // Dòng trống hoàn toàn (template để chừa) → bỏ qua, không tính lỗi.
    if (!maDonVi && !namVal && !danhHieuRaw && !idValue) continue;

    // Có id (đơn vị tồn tại) nhưng bỏ trống danh hiệu → coi như dòng tham
    // khảo, không đề xuất gì; báo bỏ qua chứ không tính vào `total`.
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

    // BKBQP/BKTTCP đơn vị là cờ chuỗi danh hiệu, chỉ được set trên giao diện
    // (lúc duyệt đề xuất) chứ không import qua Excel → chặn ngay nếu file điền.
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

    // Ba trường bắt buộc tối thiểu để định danh + xét 1 dòng đề xuất đơn vị.
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

    // Năm phải là số nguyên và không vượt năm hiện tại (không trao trước).
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

    // Chuẩn hoá hoa để khớp mã danh hiệu trong constant; chỉ nhận danh hiệu
    // đơn vị cơ bản (ĐVQT...), không nhận BKBQP/BKTTCP qua import.
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

    // Danh hiệu đơn vị cơ bản bắt buộc kèm số quyết định, và số đó phải đã
    // tồn tại trên hệ thống (đối chiếu Set nạp sẵn ở trên).
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

    // Tra mã đơn vị: ưu tiên CQDV; nếu không có mới tìm DVTT (cùng mã có thể
    // tồn tại ở cả 2 bảng, CQDV thường là đơn vị cha nên đứng trước).
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

    // Chặn trùng NGAY TRONG file: cùng (đơn vị, năm) chỉ được 1 dòng, vì mỗi
    // đơn vị mỗi năm chỉ có 1 danh hiệu cơ bản.
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

    // Chặn trùng với DB: đơn vị đã có danh hiệu cơ bản cho năm này thì không
    // import đè (chỉ chặn khi `danh_hieu` đã set, vì dòng cờ BK có thể danh_hieu null).
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

    // Kèm 5 năm danh hiệu gần nhất của đơn vị để admin đối chiếu chuỗi BKBQP/
    // BKTTCP ngay trên màn hình preview (copy mảng trước khi sort, không sửa gốc).
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

/**
 * Bước 2 (confirm): ghi DB danh sách dòng đã preview, trong 1 transaction.
 * Tái kiểm tra trùng (DB + đề xuất PENDING) và số quyết định trước khi upsert
 * để bắt thay đổi xảy ra giữa lúc preview và lúc confirm.
 * @param validItems - Các dòng hợp lệ từ preview (admin có thể đã chỉnh sửa)
 * @param adminId - Id admin thực hiện, lưu vào `nguoi_tao_id`
 * @returns Số bản ghi đã import (`imported`) và mảng bản ghi kết quả (`data`)
 * @throws ValidationError - Khi phát hiện trùng hoặc số quyết định không hợp lệ
 */
export async function confirmImport(validItems: UnitAnnualAwardValidItem[], adminId: string) {
  // Gom unit id + năm duy nhất để batch query, tránh N+1 khi tái kiểm tra.
  const uniqueUnitIds = [...new Set(validItems.map(item => item.unit_id))];
  const uniqueYears = [...new Set(validItems.map(item => item.nam))];

  // Lấy song song: danh hiệu đã trao (chặn trùng DB) và đề xuất đơn vị đang
  // PENDING (chặn import khi đã có đề xuất chờ duyệt cho cùng đơn vị+năm).
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

  // Index danh hiệu đã trao theo key `unitId|nam` để tra O(1) khi soát trùng.
  const awardMap = new Map<string, (typeof existingAwards)[number]>();
  for (const award of existingAwards) {
    const unitId = award.co_quan_don_vi_id || award.don_vi_truc_thuoc_id;
    if (unitId) awardMap.set(`${unitId}|${award.nam}`, award);
  }

  // Pha 1: gom mọi lỗi trùng trước khi ghi — chỉ cần 1 lỗi là huỷ cả lô
  // (transaction nguyên tử), nên không vào pha upsert nếu mảng này không rỗng.
  const duplicateErrors: string[] = [];
  for (const item of validItems) {
    const { unit_id: donViId, nam, danh_hieu: danhHieu } = item;

    // Trùng với đề xuất PENDING: dò trong JSON `data_danh_hieu` xem đơn vị +
    // danh hiệu này đã nằm trong đề xuất chờ duyệt cùng năm chưa.
    const existingProposal = existingProposals.find(p => {
      if (p.nam !== nam) return false;
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

    // Trùng với danh hiệu đã trao trong DB: tách 2 nhánh vì danh hiệu cơ bản
    // và bằng khen (BKBQP/BKTTCP) lưu khác cột (`danh_hieu` vs cờ `nhan_*`).
    const existingAward = awardMap.get(`${donViId}|${nam}`);
    if (existingAward) {
      const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danhHieu);
      const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danhHieu);

      // Danh hiệu cơ bản: 1 đơn vị/năm chỉ 1 danh hiệu → có rồi là chặn,
      // phân biệt thông báo trùng đúng danh hiệu vs xung đột danh hiệu khác.
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

      // Bằng khen: chặn khi cờ tương ứng đã bật trên dòng đơn vị+năm đó.
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

  // Pha 2: kiểm tra số quyết định theo từng danh hiệu. Với bằng khen, số QĐ
  // gắn vào trường riêng (`so_quyet_dinh_bkbqp/bkttcp`) chứ không phải `so_quyet_dinh`
  // chung → map field cho đúng trước khi gọi validate dùng chung.
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

  // ─── TRANSACTION CONFIRM: UPSERT danh hiệu đơn vị theo lô ───
  // Khoá UPSERT = (đơn vị, năm): CQĐV dùng unique (co_quan_don_vi_id, nam),
  // ĐVTT dùng (don_vi_truc_thuoc_id, nam) → cùng đơn vị+năm thì gộp 1 dòng
  // (BKBQP/BKTTCP set cờ nhan_* trên chính dòng đó, không tạo dòng riêng).
  // SQL minh hoạ:
  //   INSERT INTO "DanhHieuDonViHangNam" (co_quan_don_vi_id|don_vi_truc_thuoc_id, nam, danh_hieu, ...)
  //     VALUES (...)
  //     ON CONFLICT (don_vi_truc_thuoc_id, nam) DO UPDATE SET nhan_bkbqp = TRUE, so_quyet_dinh_bkbqp = ...;
  // Bọc transaction → cả lô import nguyên tử: 1 dòng lỗi thì rollback toàn bộ.
  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        // Chọn khoá unique đúng theo cấp đơn vị để upsert trúng dòng cha/con.
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

        // Dòng bằng khen: danh_hieu để null, thông tin đẩy vào cụm cờ nhan_*/
        // so_quyet_dinh_bkbqp/bkttcp. Dòng cơ bản: ghi thẳng danh_hieu + so_quyet_dinh.
        const isBkBqp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
        const isBkTtcp = item.danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;
        const isBk = isBkBqp || isBkTtcp;
        const finalDanhHieu = isBk ? null : item.danh_hieu;

        // `undefined` ở nhánh BK = không đụng `ghi_chu`/`so_quyet_dinh` cơ bản
        // khi upsert đè (giữ nguyên giá trị danh hiệu cơ bản đã có trên dòng).
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

        // Nhánh create: set đúng 1 FK đơn vị (CQDV hoặc DVTT) theo cấp đã xác định.
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
