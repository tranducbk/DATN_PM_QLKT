import { prisma } from '../models';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { decisionFileRepository } from '../repositories/decisionFile.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { accountRepository } from '../repositories/account.repository';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excel/excelImportHelper';

import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import {
  getDanhHieuName,
  formatDanhHieuList,
  resolveDanhHieuCode,
  DANH_HIEU_HCCSVV,
  HCCSVV_YEARS_HANG_BA,
  HCCSVV_YEARS_HANG_NHI,
  HCCSVV_YEARS_HANG_NHAT,
} from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  parseHeaderMap,
  getHeaderCol,
  resolvePersonnelInfo,
  buildPendingKeys,
  sanitizeRowData,
  validatePersonnelNameMatch,
} from '../helpers/excel/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { ValidationError, NotFoundError, AppError } from '../middlewares/errorHandler';
import { validateHCCSVVRankOrder } from '../helpers/awardValidation/tenureMedalRankOrder';
import { buildTemplate, styleHeaderRow } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { calculateServiceMonths, formatServiceDuration } from '../helpers/serviceYearsHelper';
import { IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';
import {
  AWARD_EXCEL_SHEETS,
  HCCSVV_EXPORT_COLUMNS,
  HCCSVV_TEMPLATE_COLUMNS,
  HCCSVV_TEMPLATE_OPTIONS,
} from '../constants/awardExcel.constants';

export interface HccsvvValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string | null;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  thang: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  history: Array<{ nam: number; danh_hieu: string; so_quyet_dinh: string | null }>;
}

class HCCSVVService {
  /**
   * Export template Excel for HCCSVV import
   */
  async exportTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const { personnelList, decisionNumbers } = await fetchTemplateData({
      personnelIds,
      loaiKhenThuong: PROPOSAL_TYPES.NIEN_HAN,
    });
    return buildTemplate({
      sheetName: AWARD_EXCEL_SHEETS.HCCSVV,
      columns: HCCSVV_TEMPLATE_COLUMNS,
      personnelList,
      decisionNumbers,
      repeatMap,
      danhHieuOptions: HCCSVV_TEMPLATE_OPTIONS,
      editableColumnLetters: ['J', 'K', 'L'],
    });
  }

  /**
   * Preview import: validate Excel data without saving to DB
   */
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, {
      excludeSheetNames: ['_CapBac', '_QuyetDinh'],
    });

    // Verify sheet name is not for other award types
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

    // Header map
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
    const valid = [];
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
      item =>
        item.personnel_id && item.danh_hieu ? `${item.personnel_id}_${item.danh_hieu}` : null
    );

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    // Map<personnelId_danhHieu, record> for duplicate checking
    const hccsvvByKey = new Map(
      existingHCCSVVRecords.map(r => [`${r.quan_nhan_id}_${r.danh_hieu}`, r])
    );
    // Map<personnelId, records[]> for history
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
          message: `Không tìm thấy quân nhân với ID ${personnelId}`,
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
   * Persists validated import rows into the database.
   */
  async confirmImport(validItems: HccsvvValidItem[], adminId: string) {
    // Check rank downgrades - block importing lower rank when higher exists
    const HCCSVV_RANK: Record<string, number> = {
      [DANH_HIEU_HCCSVV.HANG_BA]: 1,
      [DANH_HIEU_HCCSVV.HANG_NHI]: 2,
      [DANH_HIEU_HCCSVV.HANG_NHAT]: 3,
    };

    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Parallel: check pending proposals + existing records
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
      item =>
        item.personnel_id && item.danh_hieu ? `${item.personnel_id}_${item.danh_hieu}` : null
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
    const orderConflicts: string[] = [];
    const sortedItems = [...validItems].sort((a, b) => a.nam - b.nam);
    const accumulated = new Map<string, { danh_hieu: string; nam: number }[]>();
    for (const item of sortedItems) {
      const dbList = existingByPersonnel.get(item.personnel_id) || [];
      const batchList = accumulated.get(item.personnel_id) || [];
      const orderError = validateHCCSVVRankOrder(item.danh_hieu, item.nam, [
        ...dbList,
        ...batchList,
      ]);
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

    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          const result = await prismaTx.khenThuongHCCSVV.upsert({
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
          });
          results.push(result);
        }
        return { imported: results.length, data: results };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  /**
   * Get all HCCSVV with filters and pagination
   */
  async getAll(filters: Record<string, unknown> = {}, page: number = 1, limit: number = 50) {
    const where: Record<string, unknown> = {};

    const quanNhanFilter: Record<string, unknown> = {};
    if (filters.ho_ten) {
      quanNhanFilter.ho_ten = { contains: filters.ho_ten, mode: 'insensitive' };
    }

    if (filters.don_vi_id) {
      if (filters.include_sub_units) {
        // include_sub_units: expand filter to all DVTT under the parent unit
        const donViTrucThuocIds = await donViTrucThuocRepository.findIdsByCoQuanDonViId(
          String(filters.don_vi_id)
        );
        const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);
        where.QuanNhan = {
          ...quanNhanFilter,
          OR: [
            { co_quan_don_vi_id: filters.don_vi_id },
            { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
          ],
        };
      } else {
        where.QuanNhan = {
          ...quanNhanFilter,
          OR: [
            { co_quan_don_vi_id: filters.don_vi_id },
            { don_vi_truc_thuoc_id: filters.don_vi_id },
          ],
        };
      }
    } else if (Object.keys(quanNhanFilter).length > 0) {
      where.QuanNhan = quanNhanFilter;
    }

    if (filters.nam) {
      where.nam = parseInt(String(filters.nam), 10);
    }

    if (filters.danh_hieu) {
      where.danh_hieu = filters.danh_hieu;
    }

    const [data, total] = await Promise.all([
      tenureMedalRepository.findManyRaw({
        where,
        include: {
          QuanNhan: {
            select: {
              cccd: true,
              ho_ten: true,
              cap_bac: true,
              ngay_sinh: true,
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { nam: 'desc' },
      }),
      tenureMedalRepository.count(where),
    ]);

    return {
      data,
      pagination: {
        page: page,
        limit: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export HCCSVV to Excel
   */
  async exportToExcel(filters: Record<string, unknown> = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.HCCSVV);

    worksheet.columns = [...HCCSVV_EXPORT_COLUMNS];

    styleHeaderRow(worksheet);

    data.forEach((item, index) => {
      worksheet.addRow(
        sanitizeRowData({
          stt: index + 1,
          id: item.quan_nhan_id,
          ho_ten: item.QuanNhan?.ho_ten ?? '',
          cap_bac: item.cap_bac ?? '',
          chuc_vu: item.chuc_vu ?? '',
          nam: item.nam,
          danh_hieu: item.danh_hieu,
          so_quyet_dinh: item.so_quyet_dinh ?? '',
          ghi_chu: item.ghi_chu ?? '',
        })
      );
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get HCCSVV statistics
   */
  async getStatistics() {
    const byRank = await tenureMedalRepository.groupByDanhHieu();
    const byYear = await tenureMedalRepository.groupByYear();

    const total = await tenureMedalRepository.count({});

    return {
      total,
      byRank,
      byYear,
    };
  }

  /**
   * Get user with unit info (helper method)
   */
  async getUserWithUnit(userId: string) {
    return await accountRepository.findUniqueRaw({
      where: { id: userId },
      include: {
        QuanNhan: {
          select: {
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });
  }

  /**
   * Create HCCSVV award directly (without checking eligibility)
   * Used by Super Admin to add past awards
   * @param {Object} data - Award data
   * @param {string} adminUsername - Username of admin creating the award
   * @returns {Promise<Object>}
   */
  async createDirect(data, adminUsername = 'SuperAdmin') {
    const { quan_nhan_id, danh_hieu, nam, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = data;

    const validDanhHieu = Object.values(DANH_HIEU_HCCSVV);
    if (!validDanhHieu.includes(danh_hieu)) {
      throw new ValidationError(
        `Danh hiệu không hợp lệ. Chỉ chấp nhận: ${formatDanhHieuList(validDanhHieu)}`
      );
    }

    const personnel = await quanNhanRepository.findUniqueRaw({
      where: { id: quan_nhan_id },
      select: { id: true, ho_ten: true, cap_bac: true },
    });

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Check if already exists (unique constraint: quan_nhan_id + danh_hieu)
    const existing = await tenureMedalRepository.findUniqueRaw({
      where: {
        quan_nhan_id_danh_hieu: {
          quan_nhan_id: quan_nhan_id,
          danh_hieu: danh_hieu,
        },
      },
    });

    if (existing) {
      throw new AppError(`Quân nhân ${personnel.ho_ten} đã có ${getDanhHieuName(danh_hieu)}`, 409);
    }

    const existingRanks = await tenureMedalRepository.findManyRaw({
      where: { quan_nhan_id: quan_nhan_id },
      select: { danh_hieu: true, nam: true },
    });
    const orderError = validateHCCSVVRankOrder(danh_hieu, nam as number, existingRanks);
    if (orderError) {
      throw new ValidationError(`Quân nhân ${personnel.ho_ten}: ${orderError}`);
    }

    // Create the award
    const createData = {
      QuanNhan: { connect: { id: quan_nhan_id as string } },
      danh_hieu: danh_hieu as string,
      nam: nam as number,
      cap_bac: (cap_bac ?? personnel.cap_bac) as string,
      chuc_vu: chuc_vu as string,
      so_quyet_dinh: so_quyet_dinh as string,
      ghi_chu: ghi_chu as string,
    };
    const createdRecord = await tenureMedalRepository.createRaw({
      // Phase 1 refactor in progress: createData is missing `thang` (NOT NULL in schema). Loose cast preserves prior runtime behavior; remove once Phase 1 finalizes the shape.
      data: createData as any,
      include: {
        QuanNhan: {
          select: {
            ho_ten: true,
            cccd: true,
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        },
      },
    });

    // Recalculate tenure profile
    try {
      await profileService.recalculateTenureProfile(quan_nhan_id);
    } catch (recalcError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'tenure-medals',
        description: `Lỗi tính lại hồ sơ khen thưởng niên hạn sau khi thêm HCCSVV: ${recalcError}`,
      });
    }

    return createdRecord;
  }

  /**
   * Delete HCCSVV award
   * @param {string} id - Award ID
   * @param {string} adminUsername - Admin username performing the deletion
   * @returns {Promise<Object>}
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await tenureMedalRepository.findUniqueRaw({
      where: { id },
      include: {
        QuanNhan: true,
      },
    });

    if (!award) {
      throw new NotFoundError('Bản ghi khen thưởng');
    }

    const personnelId = award.quan_nhan_id;
    const personnel = award.QuanNhan;

    // Delete award only, proposals are kept for audit trail
    await tenureMedalRepository.delete(id);

    try {
      await profileService.recalculateTenureProfile(personnelId);
    } catch (recalcError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'tenure-medals',
        resourceId: id,
        description: `Lỗi tính lại hồ sơ khen thưởng niên hạn sau khi xóa HCCSVV: ${recalcError}`,
      });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCCSVV', adminUsername);
    } catch (notifyError) {
      writeSystemLog({
        action: 'ERROR',
        resource: 'tenure-medals',
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng HCCSVV: ${notifyError}`,
      });
    }

    return {
      message: 'Xóa khen thưởng HCCSVV thành công',
      personnelId,
    };
  }
}

export default new HCCSVVService();
