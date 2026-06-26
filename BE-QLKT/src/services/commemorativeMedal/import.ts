import { KNC_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { commemorativeMedalRepository } from '../../repositories/commemorativeMedal.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { proposalRepository } from '../../repositories/proposal.repository';
import { calculateServiceMonths, formatServiceDuration } from '../../helpers/serviceYearsHelper';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import { parseHeaderMap, resolvePersonnelInfo, buildPendingKeys, validatePersonnelNameMatch } from '../../helpers/excel/excelHelper';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../../constants/proposalStatus.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { DANH_HIEU_MAP, KNC_YEARS_REQUIRED_NAM, KNC_YEARS_REQUIRED_NU } from '../../constants/danhHieu.constants';
import { GENDER } from '../../constants/gender.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import type { CommemorativeMedalValidItem } from './types';

/**
 * Previews KNC VSNXD import from Excel (validation only, no DB writes).
 * Returns valid rows with history and detailed validation errors.
 */
export async function previewImport(buffer: Buffer) {
  const workbook = await loadWorkbook(buffer);
  const worksheet = getAndValidateWorksheet(workbook, { sheetName: AWARD_EXCEL_SHEETS.KNC });

  const headerMap = parseHeaderMap(worksheet);


  const cols = resolveTemplateColumns(headerMap, KNC_TEMPLATE_COLUMNS);
  const idCol = cols.id;
  const hoTenCol = cols.ho_ten;
  const namCol = cols.nam;
  const thangCol = cols.thang;
  const capBacCol = cols.cap_bac;
  const chucVuCol = cols.chuc_vu;
  const soQuyetDinhCol = cols.so_quyet_dinh;
  const ghiChuCol = cols.ghi_chu;

  if (!idCol || !namCol) {
    throw new ValidationError(
      `Thiếu cột bắt buộc: ID, Năm. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
    );
  }

  const errors = [];
  const valid = [];
  let total = 0;
  const seenInFile = new Set();
  const currentYear = new Date().getFullYear();

  const allPersonnelIds = new Set<string>();
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    if (idValue) {
      const pid = String(idValue).trim();
      if (pid) allPersonnelIds.add(pid);
    }
  }

  const [personnelList, existingKncList, existingDecisions, pendingProposals] = await Promise.all([
    allPersonnelIds.size > 0
      ? quanNhanRepository.findManyRaw({
          where: { id: { in: [...allPersonnelIds] } },
          select: {
            id: true,
            ho_ten: true,
            gioi_tinh: true,
            ngay_nhap_ngu: true,
            cap_bac: true,
            ChucVu: { select: { ten_chuc_vu: true } },
          },
        })
      : Promise.resolve([]),
    allPersonnelIds.size > 0
      ? commemorativeMedalRepository.findManyRaw({
          where: { quan_nhan_id: { in: [...allPersonnelIds] } },
        })
      : Promise.resolve([]),
    decisionFileRepository.findManyRaw({
      select: { so_quyet_dinh: true },
    }),
    proposalRepository.findManyRaw({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
      },
    }),
  ]);

  const pendingPersonnelIds = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id ? String(item.personnel_id) : null)
  );

  const personnelMap = new Map(personnelList.map(p => [p.id, p]));
  const existingKncMap = new Map(existingKncList.map(k => [k.quan_nhan_id, k]));
  const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const idValue = idCol ? row.getCell(idCol).value : null;
    const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
    const namVal = row.getCell(namCol).value;
    const thangVal = thangCol ? row.getCell(thangCol).value : null;
    const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
    const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
    const so_quyet_dinh = soQuyetDinhCol
      ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
      : null;
    const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

    if (!idValue && !namVal) continue;

    total++;

    const missingFields = [];
    if (!idValue) missingFields.push('ID');
    if (!namVal) missingFields.push('Năm');
    if (!thangVal) missingFields.push('Tháng');
    if (missingFields.length > 0) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
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
        message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
      });
      continue;
    }

    const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
    if (nameMismatch) {
      errors.push({ row: rowNumber, ho_ten, nam: namVal, message: nameMismatch });
      continue;
    }

    const nam = parseInt(String(namVal), 10);
    if (!Number.isInteger(nam)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam: namVal,
        message: `Giá trị năm không hợp lệ: ${namVal}`,
      });
      continue;
    }
    if (nam < 1900 || nam > currentYear) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
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
        message: `Tháng "${thangVal}" không hợp lệ. Chỉ được nhập 1-12`,
      });
      continue;
    }

    // Decision number must exist in the system (not just non-empty)
    if (!so_quyet_dinh) {
      errors.push({ row: rowNumber, ho_ten, nam, message: 'Thiếu số quyết định' });
      continue;
    }
    if (!validDecisionNumbers.has(so_quyet_dinh)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
      });
      continue;
    }

    // KNC is a one-time award — reject if same person appears twice in file
    if (seenInFile.has(personnel.id)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Trùng lặp trong file — quân nhân ${ho_ten ?? personnel.ho_ten} đã xuất hiện ở dòng trước`,
      });
      continue;
    }
    seenInFile.add(personnel.id);

    // KNC already awarded — lifetime limit reached
    const existingKnc = existingKncMap.get(personnel.id);
    if (existingKnc) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Quân nhân đã được tặng ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} (năm ${existingKnc.nam})`,
      });
      continue;
    }

    if (pendingPersonnelIds.has(personnelId)) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: `Quân nhân đang có đề xuất ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} chờ duyệt`,
      });
      continue;
    }

    // Eligibility depends on gender and service start date
    if (!personnel.ngay_nhap_ngu) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: 'Không có ngày nhập ngũ trong hồ sơ, không thể kiểm tra điều kiện',
      });
      continue;
    }

    // Reject explicit if gender is missing/invalid — falling back to NAM would silently apply
    // the stricter 25-year threshold and could mis-reject eligible female personnel.
    if (personnel.gioi_tinh !== GENDER.MALE && personnel.gioi_tinh !== GENDER.FEMALE) {
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        message: 'Chưa cập nhật thông tin giới tính',
      });
      continue;
    }

    const ngayNhapNgu = new Date(personnel.ngay_nhap_ngu);
    const referenceDate = new Date(nam, thang, 0); // last day of selected month — eligibility reference date
    const serviceMonths = calculateServiceMonths(ngayNhapNgu, referenceDate);
    const isFemale = personnel.gioi_tinh === GENDER.FEMALE;
    const requiredYears = isFemale ? KNC_YEARS_REQUIRED_NU : KNC_YEARS_REQUIRED_NAM;

    const requiredMonths = requiredYears * 12;
    if (serviceMonths < requiredMonths) {
      const diff = requiredMonths - serviceMonths;
      errors.push({
        row: rowNumber,
        ho_ten,
        nam,
        thang,
        message: `Chưa đủ điều kiện: ${isFemale ? 'Nữ' : 'Nam'} cần >= ${requiredYears} năm phục vụ, hiện ${formatServiceDuration(serviceMonths)}, còn thiếu ${formatServiceDuration(diff)}`,
      });
      continue;
    }

    // History from batched data — existingKnc is already checked as null here,
    // so history is always empty (person has no KNC yet). Keep the structure for consistency.
    const history = existingKnc
      ? [
          {
            nam: existingKnc.nam,
            so_quyet_dinh: existingKnc.so_quyet_dinh,
            ghi_chu: existingKnc.ghi_chu,
          },
        ]
      : [];

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
        message: `Thiếu ${missingInfoFields.join(', ')} (cả trong file và hệ thống)`,
      });
      continue;
    }

    valid.push({
      row: rowNumber,
      personnel_id: personnel.id,
      ho_ten: hoTen,
      cap_bac: capBac,
      chuc_vu: chucVu,
      nam,
      thang,
      so_quyet_dinh,
      ghi_chu,
      service_years: Math.floor(serviceMonths / 12),
      gioi_tinh: personnel.gioi_tinh,
      history,
    });
  }

  return { total, valid, errors };
}

/**
 * Persists validated import rows into the database.
 */
export async function confirmImport(validItems: CommemorativeMedalValidItem[], adminId: string) {
  void adminId;
  const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

  const [pendingProposals, existingRecords] = await Promise.all([
    proposalRepository.findManyRaw({
      where: { loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN, status: PROPOSAL_STATUS.PENDING },
    }),
    commemorativeMedalRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { quan_nhan_id: true, nam: true },
    }),
  ]);

  const pendingPersonnelIds = buildPendingKeys(
    pendingProposals as Array<Record<string, unknown>>,
    'data_nien_han',
    item => (item.personnel_id ? String(item.personnel_id) : null)
  );
  const pendingConflicts: string[] = [];
  for (const item of validItems) {
    if (pendingPersonnelIds.has(item.personnel_id)) {
      pendingConflicts.push(
        `${item.ho_ten}: đang có đề xuất ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} chờ duyệt`
      );
    }
  }
  if (pendingConflicts.length > 0) {
    throw new ValidationError(pendingConflicts.join('; '));
  }
  const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

  const conflicts: string[] = [];
  for (const item of validItems) {
    if (existingSet.has(item.personnel_id)) {
      conflicts.push(`${item.ho_ten}: đã có ${DANH_HIEU_MAP.KNC_VSNXD_QDNDVN} trên hệ thống`);
    }
  }
  if (conflicts.length > 0) {
    throw new ValidationError(conflicts.join('; '));
  }

  return await prisma.$transaction(
    async prismaTx => {
      const results = [];
      for (const item of validItems) {
        const result = await commemorativeMedalRepository.upsertRaw(
          {
            where: { quan_nhan_id: item.personnel_id },
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
