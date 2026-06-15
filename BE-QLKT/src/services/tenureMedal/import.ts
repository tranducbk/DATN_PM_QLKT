import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { tenureMedalRepository } from '../../repositories/tenureMedal.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import {
  parseHeaderMap,
  getHeaderCol,
  resolvePersonnelInfo,
  buildPendingKeys,
  validatePersonnelNameMatch,
} from '../../helpers/excel/excelHelper';
import {
  getDanhHieuName,
  formatDanhHieuList,
  resolveDanhHieuCode,
  DANH_HIEU_HCCSVV,
  HCCSVV_YEARS_HANG_BA,
  HCCSVV_YEARS_HANG_NHI,
  HCCSVV_YEARS_HANG_NHAT,
} from '../../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { validateHCCSVVRankOrder } from '../../helpers/awardValidation/tenureMedalRankOrder';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';
import type { HccsvvValidItem } from './types';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HCCSVV (niên hạn) IMPORT — preview (validate) + confirm (ghi DB)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Cùng khung 2-bước. Đặc thù HCCSVV: 3 hạng Ba → Nhì → Nhất nhận tuần tự theo
 *  niên hạn, KHÔNG nhảy bậc/trùng → confirm sort theo hạng rồi check orderConflicts.
 *  previewImport auto-pick sheet (loại trừ sheet kỹ thuật) nhưng vẫn chặn nhầm
 *  file cá nhân (ANNUAL_PERSONAL) ngay sau khi đọc.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Preview HCCSVV import: validates Excel data without saving to DB.
 * @param buffer - Raw Excel file buffer
 * @returns Validation result with valid rows, errors, and total count
 */
export async function previewImport(buffer: Buffer) {
  const workbook = await loadWorkbook(buffer);
  // Auto-pick sheet dữ liệu, bỏ qua 2 sheet kỹ thuật (_CapBac/_QuyetDinh) dùng cho dropdown.
  const worksheet = getAndValidateWorksheet(workbook, {
    excludeSheetNames: ['_CapBac', '_QuyetDinh'],
  });

  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_PERSONAL) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file danh hiệu hằng năm, không phải HCCSVV.'
    );
  }
  if (worksheet.name === AWARD_EXCEL_SHEETS.ANNUAL_UNIT) {
    throw new ValidationError(
      'File Excel không đúng loại. Đây là file khen thưởng đơn vị, không phải HCCSVV.'
    );
  }

  const headerMap = parseHeaderMap(worksheet);

  const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
  const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
  const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
  const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
  const namCol = getHeaderCol(headerMap, ['nam', 'year']);
  const thangCol = getHeaderCol(headerMap, ['thang', 'month', 'tháng']);
  const danhHieuCol = getHeaderCol(headerMap, ['danh_hieu', 'danhhieu', 'danh_hiu']);
  const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
  const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

  if (!idCol || !namCol || !danhHieuCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: ID, Năm, Danh hiệu. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  const validDanhHieu: string[] = Object.values(DANH_HIEU_HCCSVV);
  const errors = [];
  const valid: HccsvvValidItem[] = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  const existingDecisions = await decisionFileRepository.findManyRaw({
    select: { so_quyet_dinh: true },
  });
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  // Medal tier order: rank 2 requires rank 3; rank 1 requires rank 2.
  const hierarchyPrerequisite = {
    [DANH_HIEU_HCCSVV.HANG_NHI]: DANH_HIEU_HCCSVV.HANG_BA,
    [DANH_HIEU_HCCSVV.HANG_NHAT]: DANH_HIEU_HCCSVV.HANG_NHI,
  };

  const allPersonnelIds = new Set<string>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    if (idValue) {
      const id = String(idValue).trim();
      if (id) allPersonnelIds.add(id);
    }
  }

  const [personnelList, existingHCCSVVRecords, pendingProposals] = await Promise.all([
    quanNhanRepository.findManyRaw({
      where: { id: { in: [...allPersonnelIds] } },
      include: { ChucVu: { select: { ten_chuc_vu: true } } },
    }),
    tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: [...allPersonnelIds] } },
      select: { quan_nhan_id: true, danh_hieu: true, nam: true, so_quyet_dinh: true },
    }),
    proposalRepository.findManyRaw({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN,
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  const pendingKeys = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id && item.danh_hieu ? `${item.personnel_id}_${item.danh_hieu}` : null)
  );

  const personnelMap = new Map(personnelList.map(p => [p.id, p]));
  const hccsvvByKey = new Map(
    existingHCCSVVRecords.map(r => [`${r.quan_nhan_id}_${r.danh_hieu}`, r])
  );
  const hccsvvByPersonnel = new Map<string, typeof existingHCCSVVRecords>();
  for (const r of existingHCCSVVRecords) {
    const list = hccsvvByPersonnel.get(r.quan_nhan_id) || [];
    list.push(r);
    hccsvvByPersonnel.set(r.quan_nhan_id, list);
  }

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
    const namVal = row.getCell(namCol).value;
    const thangVal = thangCol ? row.getCell(thangCol).value : null;
    const danh_hieu_raw = String(row.getCell(danhHieuCol).value ?? '').trim();
    const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
    const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
    const so_quyet_dinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
      : null;
    const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

    if (!idValue && !namVal && !danh_hieu_raw) continue;

    if (idValue && !danh_hieu_raw) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: '',
        message: 'Bỏ qua — không có danh hiệu nào được điền',
      });
      continue;
    }

    total++;

    const missingFields = [];
    if (!idValue) missingFields.push('ID');
    if (!namVal) missingFields.push('Năm');
    if (!thangVal) missingFields.push('Tháng');
    if (!danh_hieu_raw) missingFields.push('Danh hiệu');
    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Thiếu ${missingFields.join(', ')}`,
      });
      continue;
    }

    const personnelId = String(idValue).trim();
    if (!personnelId) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `ID không hợp lệ: ${idValue}`,
      });
      continue;
    }
    const personnel = personnelMap.get(personnelId);
    if (!personnel) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
      });
      continue;
    }

    const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
    if (nameMismatch) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: nameMismatch,
      });
      continue;
    }

    const nam = parseInt(String(namVal), 10);
    if (!Number.isInteger(nam)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Giá trị năm không hợp lệ: ${namVal}`,
      });
      continue;
    }
    if (nam < 1900 || nam > currentYear) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
      });
      continue;
    }

    const thang = parseInt(String(thangVal), 10);
    if (!Number.isInteger(thang) || thang < 1 || thang > 12) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang: thangVal,
        danh_hieu: danh_hieu_raw,
        message: `Tháng "${thangVal}" không hợp lệ. Chỉ được nhập 1-12`,
      });
      continue;
    }

    const resolvedDanhHieu = resolveDanhHieuCode(danh_hieu_raw);
    if (!validDanhHieu.includes(resolvedDanhHieu)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu: danh_hieu_raw,
        message: `Danh hiệu "${danh_hieu_raw}" không tồn tại. Chỉ chấp nhận: ${formatDanhHieuList(validDanhHieu)}`,
      });
      continue;
    }
    const danh_hieu = resolvedDanhHieu;

    // Decision number must exist in the system (not just non-empty)
    if (!so_quyet_dinh) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: 'Thiếu số quyết định',
      });
      continue;
    }
    if (!validDecisionNumbers.has(so_quyet_dinh)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
      });
      continue;
    }

    const fileKey = `${personnelId}_${danh_hieu}`;
    if (seenInFile.has(fileKey)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Trùng lặp trong file — cùng quân nhân, danh hiệu ${danh_hieu}`,
      });
      continue;
    }
    seenInFile.add(fileKey);

    const existingRecord = hccsvvByKey.get(`${personnelId}_${danh_hieu}`);
    if (existingRecord) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Đã có ${getDanhHieuName(danh_hieu)} trên hệ thống`,
      });
      continue;
    }

    if (pendingKeys.has(`${personnelId}_${danh_hieu}`)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        danh_hieu,
        message: `Quân nhân đang có đề xuất ${getDanhHieuName(danh_hieu)} chờ duyệt`,
      });
      continue;
    }

    // Check HCCSVV hierarchy: must have prerequisite before higher rank
    const prerequisite = hierarchyPrerequisite[danh_hieu];
    if (prerequisite) {
      const hasPrerequisiteInDb = hccsvvByKey.has(`${personnelId}_${prerequisite}`);
      // Also check if prerequisite is in current valid items (being imported in same batch)
      const hasPrerequisiteInFile = valid.some(
        v => v.personnel_id === personnelId && v.danh_hieu === prerequisite
      );
      if (!hasPrerequisiteInDb && !hasPrerequisiteInFile) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang,
          danh_hieu,
          message: `Chưa có ${getDanhHieuName(prerequisite)}. Phải có hạng Ba trước hạng Nhì, hạng Nhì trước hạng Nhất`,
        });
        continue;
      }
    }

    // Combine DB records + earlier rows in this batch for sequential year check
    const existingForOrder = (hccsvvByPersonnel.get(personnelId) || []).map(r => ({
      danh_hieu: r.danh_hieu,
      nam: r.nam,
    }));
    for (const v of valid) {
      if (v.personnel_id === personnelId) {
        existingForOrder.push({ danh_hieu: v.danh_hieu, nam: v.nam });
      }
    }
    const orderError = validateHCCSVVRankOrder(danh_hieu, nam, existingForOrder);
    if (orderError) {
      errors.push({ row: rowNumber, ho_ten, nam, thang, danh_hieu, message: orderError });
      continue;
    }

    // Eligibility: check service time meets the required years for this rank
    const refDate = new Date(nam, thang, 0);
    const serviceTotalMonths = personnel.ngay_nhap_ngu
      ? calculateServiceMonths(
          personnel.ngay_nhap_ngu as Date,
          (personnel.ngay_xuat_ngu as Date | null) ?? refDate
        )
      : null;

    if (serviceTotalMonths !== null) {
      const yearsRequired: Record<string, number> = {
        [DANH_HIEU_HCCSVV.HANG_BA]: HCCSVV_YEARS_HANG_BA,
        [DANH_HIEU_HCCSVV.HANG_NHI]: HCCSVV_YEARS_HANG_NHI,
        [DANH_HIEU_HCCSVV.HANG_NHAT]: HCCSVV_YEARS_HANG_NHAT,
      };
      const required = yearsRequired[danh_hieu];
      if (required && serviceTotalMonths < required * 12) {
        const diff = required * 12 - serviceTotalMonths;
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          thang,
          danh_hieu,
          message: `Chưa đủ thời gian phục vụ cho ${getDanhHieuName(danh_hieu)} (yêu cầu ${required} năm, còn thiếu ${formatServiceDuration(diff)})`,
        });
        continue;
      }
    }

    const allRecords = hccsvvByPersonnel.get(personnelId) || [];
    const history = [...allRecords]
      .sort((a, b) => b.nam - a.nam)
      .slice(0, 5)
      .map(r => ({ nam: r.nam, danh_hieu: r.danh_hieu, so_quyet_dinh: r.so_quyet_dinh }));

    const {
      hoTen,
      capBac,
      chucVu,
      missingFields: missingInfoFields,
    } = resolvePersonnelInfo({ ho_ten, cap_bac, chuc_vu }, personnel);
    if (missingInfoFields.length > 0) {
      errors.push({
        row: rowNumber,
        ho_ten: hoTen,
        nam,
        thang,
        danh_hieu,
        message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
      });
      continue;
    }

    const tong_thoi_gian =
      serviceTotalMonths !== null ? formatServiceDuration(serviceTotalMonths) : null;

    valid.push({
      row: rowNumber,
      personnel_id: personnelId,
      ho_ten: hoTen,
      cap_bac: capBac,
      chuc_vu: chucVu,
      nam,
      thang,
      tong_thoi_gian,
      danh_hieu,
      so_quyet_dinh,
      ghi_chu,
      history,
    });
  }

  return { total, valid, errors };
}

/**
 * Persists validated HCCSVV import rows into the database.
 * @param validItems - Pre-validated items from previewImport
 * @returns Count and data of imported records
 */
export async function confirmImport(validItems: HccsvvValidItem[]) {
  // Check rank downgrades - block importing lower rank when higher exists
  const HCCSVV_RANK: Record<string, number> = {
    [DANH_HIEU_HCCSVV.HANG_BA]: 1,
    [DANH_HIEU_HCCSVV.HANG_NHI]: 2,
    [DANH_HIEU_HCCSVV.HANG_NHAT]: 3,
  };

  const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

  const [pendingProposals, existingRecords] = await Promise.all([
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.NIEN_HAN, status: PROPOSAL_STATUS.PENDING },
    }),
    tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, danh_hieu: true, nam: true },
    }),
  ]);

  const pendingKeys = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id && item.danh_hieu ? `${item.personnel_id}_${item.danh_hieu}` : null)
  );
  const pendingConflicts: string[] = [];
  for (const item of validItems) {
    if (pendingKeys.has(`${item.personnel_id}_${item.danh_hieu}`)) {
      pendingConflicts.push(
        `${item.ho_ten}: đang có đề xuất ${getDanhHieuName(item.danh_hieu)} chờ duyệt`
      );
    }
  }
  if (pendingConflicts.length > 0) {
    throw new ValidationError(pendingConflicts.join('; '));
  }
  const highestRankMap = new Map<string, { danh_hieu: string; rank: number }>();
  for (const r of existingRecords) {
    const rank = HCCSVV_RANK[r.danh_hieu] || 0;
    const current = highestRankMap.get(r.quan_nhan_id);
    if (!current || rank > current.rank) {
      highestRankMap.set(r.quan_nhan_id, { danh_hieu: r.danh_hieu, rank });
    }
  }

  const conflicts: string[] = [];
  for (const item of validItems) {
    const highest = highestRankMap.get(item.personnel_id);
    if (highest) {
      const importRank = HCCSVV_RANK[item.danh_hieu] || 0;
      if (importRank <= highest.rank && item.danh_hieu !== highest.danh_hieu) {
        conflicts.push(
          `${item.ho_ten}: đã có ${getDanhHieuName(highest.danh_hieu)}, không thể import ${getDanhHieuName(item.danh_hieu)} (hạng thấp hơn)`
        );
      }
    }
  }
  if (conflicts.length > 0) {
    throw new ValidationError(conflicts.join('; '));
  }

  const existingByPersonnel = new Map<string, { danh_hieu: string; nam: number }[]>();
  for (const r of existingRecords) {
    const list = existingByPersonnel.get(r.quan_nhan_id) || [];
    list.push({ danh_hieu: r.danh_hieu, nam: r.nam });
    existingByPersonnel.set(r.quan_nhan_id, list);
  }
  // Order check tuần tự: sort theo năm rồi duyệt, mỗi người tích luỹ dần các hạng
  // đã có (DB + các dòng trước trong cùng lô) → validateHCCSVVRankOrder đảm bảo
  // nhận đúng thứ tự Ba→Nhì→Nhất, không nhảy bậc. Phải gộp cả batchList vì trong
  // 1 file có thể nhập nhiều hạng cho cùng người — xét lẫn nhau, không chỉ với DB.
  const orderConflicts: string[] = [];
  const sortedItems = [...validItems].sort((a, b) => a.nam - b.nam);
  const accumulated = new Map<string, { danh_hieu: string; nam: number }[]>();
  for (const item of sortedItems) {
    const dbList = existingByPersonnel.get(item.personnel_id) || [];
    const batchList = accumulated.get(item.personnel_id) || [];
    const orderError = validateHCCSVVRankOrder(item.danh_hieu, item.nam, [...dbList, ...batchList]);
    if (orderError) {
      orderConflicts.push(`${item.ho_ten}: ${orderError}`);
    } else {
      batchList.push({ danh_hieu: item.danh_hieu, nam: item.nam });
      accumulated.set(item.personnel_id, batchList);
    }
  }
  if (orderConflicts.length > 0) {
    throw new ValidationError(orderConflicts.join('; '));
  }

  // ─── TRANSACTION CONFIRM: UPSERT HCCSVV theo lô ───
  // Khoá UPSERT = (quan_nhan_id, danh_hieu): mỗi người mỗi hạng (Ba/Nhì/Nhất) 1 dòng,
  // import lại cùng hạng → UPDATE (không tạo trùng). SQL minh hoạ:
  //   INSERT INTO "KhenThuongHCCSVV" (quan_nhan_id, danh_hieu, nam, thang, ...)
  //     VALUES (...)
  //     ON CONFLICT (quan_nhan_id, danh_hieu) DO UPDATE SET nam = $nam, so_quyet_dinh = ...;
  // Bọc transaction → cả file import nguyên tử (lỗi giữa chừng rollback hết).
  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        const result = await tenureMedalRepository.upsertRaw(
          {
            where: {
              quan_nhan_id_danh_hieu: {
                quan_nhan_id: item.personnel_id,
                danh_hieu: item.danh_hieu,
              },
            },
            update: {
              nam: item.nam,
              thang: item.thang ?? 12,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
            create: {
              quan_nhan_id: item.personnel_id,
              danh_hieu: item.danh_hieu,
              nam: item.nam,
              thang: item.thang ?? 12,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
            },
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
