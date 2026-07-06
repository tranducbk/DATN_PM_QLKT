import { NCKH_TEMPLATE_COLUMNS } from '../../constants/awardExcel.constants';
import { resolveTemplateColumns } from '../../helpers/excel/excelHelper';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { scientificAchievementRepository } from '../../repositories/scientificAchievement.repository';
import { decisionFileRepository } from '../../repositories/decisionFile.repository';
import { loadWorkbook, getAndValidateWorksheet } from '../../helpers/excel/excelImportHelper';
import { DANH_HIEU_NCKH, resolveNckhCode } from '../../constants/danhHieu.constants';
import { ValidationError } from '../../middlewares/errorHandler';
import { parseHeaderMap, resolvePersonnelInfo, validatePersonnelNameMatch } from '../../helpers/excel/excelHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../../constants/excel.constants';
import { AWARD_EXCEL_SHEETS } from '../../constants/awardExcel.constants';
import { PreviewError, PreviewValidItem, ConfirmImportItem } from './types';

export async function previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, { sheetName: AWARD_EXCEL_SHEETS.NCKH });

    const headerMap = parseHeaderMap(worksheet);


    const cols = resolveTemplateColumns(headerMap, NCKH_TEMPLATE_COLUMNS);
    const idCol = cols.id;
    const hoTenCol = cols.ho_ten;
    const capBacCol = cols.cap_bac;
    const chucVuCol = cols.chuc_vu;
    const namCol = cols.nam;
    const loaiCol = cols.loai;
    const moTaCol = cols.mo_ta;
    const soQuyetDinhCol = cols.so_quyet_dinh;
    const ghiChuCol = cols.ghi_chu;

    if (!idCol || !namCol || !loaiCol || !moTaCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm, Loại, Mô tả. Tìm thấy headers: ${Object.keys(headerMap).join(
          ', '
        )}`
      );
    }

    const errors: PreviewError[] = [];
    const valid: PreviewValidItem[] = [];
    let total = 0;
    const seenInFile = new Set<string>();
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

    const [personnelList, existingAchievementsList, existingDecisions] = await Promise.all([
      allPersonnelIds.size > 0
        ? quanNhanRepository.findManyRaw({
            where: { id: { in: [...allPersonnelIds] } },
            select: { id: true, ho_ten: true, cap_bac: true, ChucVu: { select: { ten_chuc_vu: true } } },
          })
        : Promise.resolve([]),
      allPersonnelIds.size > 0
        ? scientificAchievementRepository.findManyRaw({
            where: { quan_nhan_id: { in: [...allPersonnelIds] } },
            select: { quan_nhan_id: true, nam: true, loai: true, mo_ta: true, so_quyet_dinh: true },
          })
        : Promise.resolve([]),
      decisionFileRepository.findManyRaw({
        select: { so_quyet_dinh: true },
      }),
    ]);

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    // Map<personnelId, records[]> for history
    const achievementsByPersonnel = new Map<string, typeof existingAchievementsList>();
    for (const a of existingAchievementsList) {
      const list = achievementsByPersonnel.get(a.quan_nhan_id) || [];
      list.push(a);
      achievementsByPersonnel.set(a.quan_nhan_id, list);
    }
    // Set<key> for duplicate-in-DB check
    const existingAchievementKeys = new Set(
      existingAchievementsList.map(a => `${a.quan_nhan_id}_${a.nam}_${a.loai}_${a.mo_ta}`)
    );
    const validDecisionNumbers = new Set(existingDecisions.map(d => d.so_quyet_dinh));
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const idValue = idCol ? row.getCell(idCol).value : null;
      const ho_ten = hoTenCol ? String(row.getCell(hoTenCol).value ?? '').trim() : '';
      const namVal = row.getCell(namCol).value;
      const loai_raw = loaiCol ? String(row.getCell(loaiCol).value ?? '').trim() : '';
      const mo_ta = moTaCol ? String(row.getCell(moTaCol).value ?? '').trim() : '';
      const cap_bac = capBacCol ? String(row.getCell(capBacCol).value ?? '').trim() : null;
      const chuc_vu = chucVuCol ? String(row.getCell(chucVuCol).value ?? '').trim() : null;
      const so_quyet_dinh = soQuyetDinhCol
        ? String(row.getCell(soQuyetDinhCol).value ?? '').trim()
        : null;
      const ghi_chu = ghiChuCol ? String(row.getCell(ghiChuCol).value ?? '').trim() : null;

      if (!idValue && !namVal && !loai_raw) continue;

      if (idValue && !loai_raw) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: '',
          message: 'Bỏ qua — không có loại thành tích nào được điền',
        });
        continue;
      }

      total++;

      const missingFields: string[] = [];
      if (!idValue) missingFields.push('ID');
      if (!namVal) missingFields.push('Năm');
      if (!loai_raw) missingFields.push('Loại');
      if (!mo_ta) missingFields.push('Mô tả');
      if (missingFields.length > 0) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
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
          loai: loai_raw,
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
          loai: loai_raw,
          message: `Không tìm thấy quân nhân tương ứng với mã trong file.`,
        });
        continue;
      }

      const nameMismatch = validatePersonnelNameMatch(ho_ten, personnel.ho_ten);
      if (nameMismatch) {
        errors.push({ row: rowNumber, ho_ten, nam: namVal, loai: loai_raw, message: nameMismatch });
        continue;
      }

      const nam = parseInt(String(namVal));
      if (!Number.isInteger(nam)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam: namVal,
          loai: loai_raw,
          message: `Giá trị năm không hợp lệ: ${namVal}`,
        });
        continue;
      }
      if (nam < 1900 || nam > currentYear) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Năm ${nam} không hợp lệ. Chỉ được nhập đến năm hiện tại (${currentYear})`,
        });
        continue;
      }

      const loai = resolveNckhCode(loai_raw);
      if (!loai) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai: loai_raw,
          message: `Loại "${loai_raw}" không hợp lệ. Chỉ chấp nhận: ${Object.values(DANH_HIEU_NCKH).join(', ')}`,
        });
        continue;
      }

      if (!so_quyet_dinh) {
        errors.push({ row: rowNumber, ho_ten, nam, loai, message: 'Thiếu số quyết định' });
        continue;
      }
      if (!validDecisionNumbers.has(so_quyet_dinh)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Số quyết định "${so_quyet_dinh}" không tồn tại trên hệ thống`,
        });
        continue;
      }

      const fileKey = `${personnel.id}_${nam}_${loai}_${mo_ta}`;
      if (seenInFile.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: `Trùng lặp trong file — cùng quân nhân, năm ${nam}, loại ${loai}, mô tả "${mo_ta}"`,
        });
        continue;
      }
      seenInFile.add(fileKey);

      if (existingAchievementKeys.has(fileKey)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          loai,
          message: 'Thành tích khoa học đã tồn tại',
        });
        continue;
      }

      const allRecords = achievementsByPersonnel.get(personnel.id) || [];
      const history = [...allRecords]
        .sort((a, b) => b.nam - a.nam)
        .map(r => ({
          nam: r.nam,
          loai: r.loai,
          mo_ta: r.mo_ta,
          so_quyet_dinh: r.so_quyet_dinh,
        }));

      const { hoTen, capBac, chucVu, missingFields: missingInfoFields } = resolvePersonnelInfo(
        { ho_ten, cap_bac, chuc_vu },
        personnel
      );
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
        loai,
        mo_ta,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

export async function confirmImport(validItems: ConfirmImportItem[], adminId: string) {
    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          const result = await scientificAchievementRepository.create(
            {
              quan_nhan_id: item.personnel_id,
              nam: item.nam,
              loai: resolveNckhCode(item.loai) ?? item.loai,
              mo_ta: item.mo_ta,
              cap_bac: item.cap_bac ?? null,
              chuc_vu: item.chuc_vu ?? null,
              so_quyet_dinh: item.so_quyet_dinh ?? null,
              ghi_chu: item.ghi_chu ?? null,
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
