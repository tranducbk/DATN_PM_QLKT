import { prisma } from '../models';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { militaryFlagRepository } from '../repositories/militaryFlag.repository';
import { decisionFileRepository } from '../repositories/decisionFile.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { accountRepository } from '../repositories/account.repository';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import ExcelJS from 'exceljs';
import { loadWorkbook, getAndValidateWorksheet } from '../helpers/excel/excelImportHelper';
import * as notificationHelper from '../helpers/notification';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler';
import { parseHeaderMap, getHeaderCol, resolvePersonnelInfo, buildPendingKeys, sanitizeRowData, validatePersonnelNameMatch } from '../helpers/excel/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildTemplate, styleHeaderRow } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { IMPORT_TRANSACTION_TIMEOUT } from '../constants/excel.constants';
import {
  AWARD_EXCEL_SHEETS,
  HCQKQT_TEMPLATE_COLUMNS,
  MILITARY_FLAG_EXPORT_COLUMNS,
} from '../constants/awardExcel.constants';
import { HCQKQT_YEARS_REQUIRED } from '../constants/danhHieu.constants';
import { calculateServiceMonths, formatServiceDuration } from '../helpers/serviceYearsHelper';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.MILITARY_FLAG];

interface PreviewError {
  row: number;
  ho_ten: string;
  nam: number | unknown;
  thang?: number | unknown;
  message: string;
}

interface PreviewValidItem {
  row: number;
  personnel_id: string;
  ho_ten: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  nam: number;
  thang: number;
  so_quyet_dinh: string | null;
  ghi_chu: string | null;
  history: {
    nam: number;
    so_quyet_dinh: string | null;
  }[];
}

export interface ConfirmImportItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  thang?: number;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

interface MilitaryFlagFilters {
  ho_ten?: string;
  don_vi_id?: string;
  include_sub_units?: boolean;
  nam?: number;
}

class MilitaryFlagService {
  async previewImport(buffer: Buffer) {
    const workbook = await loadWorkbook(buffer);
    const worksheet = getAndValidateWorksheet(workbook, {
      sheetName: AWARD_EXCEL_SHEETS.HC_QKQT,
    });

    const headerMap = parseHeaderMap(worksheet);

    const idCol = getHeaderCol(headerMap, ['id', 'ma_quan_nhan', 'personnel_id']);
    const hoTenCol = getHeaderCol(headerMap, ['ho_va_ten', 'ho_ten', 'hoten', 'hovaten', 'ten']);
    const capBacCol = getHeaderCol(headerMap, ['cap_bac', 'capbac', 'cap_bc']);
    const chucVuCol = getHeaderCol(headerMap, ['chuc_vu', 'chucvu', 'chc_vu']);
    const namCol = getHeaderCol(headerMap, ['nam', 'year']);
    const thangCol = getHeaderCol(headerMap, ['thang', 'month', 'tháng']);
    const soQuyetDinhCol = getHeaderCol(headerMap, ['so_quyet_dinh', 'soquyetdinh', 'so_qd']);
    const ghiChuCol = getHeaderCol(headerMap, ['ghi_chu', 'ghichu', 'ghi_ch']);

    if (!idCol || !namCol) {
      throw new ValidationError(
        `Thiếu cột bắt buộc: ID, Năm. Tìm thấy headers: ${Object.keys(headerMap).join(', ')}`
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

    const [personnelList, existingAwardsList, existingDecisions, pendingProposals] = await Promise.all([
      allPersonnelIds.size > 0
        ? quanNhanRepository.findManyRaw({
            where: { id: { in: [...allPersonnelIds] } },
            select: { id: true, ho_ten: true, cap_bac: true, ngay_nhap_ngu: true, ChucVu: { select: { ten_chuc_vu: true } } },
          })
        : Promise.resolve([]),
      allPersonnelIds.size > 0
        ? militaryFlagRepository.findManyRaw({
            where: { quan_nhan_id: { in: [...allPersonnelIds] } },
          })
        : Promise.resolve([]),
      decisionFileRepository.findManyRaw({
        select: { so_quyet_dinh: true },
      }),
      proposalRepository.findManyRaw({
        where: {
          loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
          status: PROPOSAL_STATUS.PENDING,
        },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      (item) => item.personnel_id as string
    );

    const personnelMap = new Map(personnelList.map(p => [p.id, p]));
    const existingAwardsMap = new Map(existingAwardsList.map(a => [a.quan_nhan_id, a]));
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

      const missingFields: string[] = [];
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
          message: `Không tìm thấy quân nhân với ID ${personnelId}`,
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

      if (seenInFile.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Trùng lặp trong file — quân nhân ${ho_ten ?? personnel.ho_ten} đã xuất hiện ở dòng trước`,
        });
        continue;
      }
      seenInFile.add(personnelId);

      const existingAward = existingAwardsMap.get(personnelId);
      if (existingAward) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: `Quân nhân đã có HC QKQT trên hệ thống (năm ${existingAward.nam})`,
        });
        continue;
      }

      if (pendingPersonnelIds.has(personnelId)) {
        errors.push({
          row: rowNumber,
          ho_ten,
          nam,
          message: 'Quân nhân đang có đề xuất HC Quân kỳ quyết thắng chờ duyệt',
        });
        continue;
      }

      if (personnel.ngay_nhap_ngu) {
        const refDate = new Date(nam, thang, 0);
        const serviceMonths = calculateServiceMonths(new Date(personnel.ngay_nhap_ngu), refDate);
        const requiredMonths = HCQKQT_YEARS_REQUIRED * 12;
        if (serviceMonths < requiredMonths) {
          const diff = requiredMonths - serviceMonths;
          errors.push({
            row: rowNumber,
            ho_ten,
            nam,
            thang,
            message: `Chưa đủ ${HCQKQT_YEARS_REQUIRED} năm phục vụ (hiện ${formatServiceDuration(serviceMonths)}, còn thiếu ${formatServiceDuration(diff)})`,
          });
          continue;
        }
      }

      // History from batched data — existingAward is already checked as null/undefined here,
      // so history is always empty (person has no HC QKQT yet). Keep the structure for consistency.
      const history = existingAward
        ? [{ nam: existingAward.nam, so_quyet_dinh: existingAward.so_quyet_dinh }]
        : [];

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
        personnel_id: personnelId,
        ho_ten: hoTen,
        cap_bac: capBac,
        chuc_vu: chucVu,
        nam,
        thang,
        so_quyet_dinh,
        ghi_chu,
        history,
      });
    }

    return { total, valid, errors };
  }

  async confirmImport(validItems: ConfirmImportItem[]) {
    const personnelIds = [...new Set(validItems.map(item => item.personnel_id))];

    // Parallel: check pending proposals + existing records
    const [pendingProposals, existingRecords] = await Promise.all([
      proposalRepository.findManyRaw({
        where: { loai_de_xuat: PROPOSAL_TYPES.HC_QKQT, status: PROPOSAL_STATUS.PENDING },
      }),
      militaryFlagRepository.findManyRaw({
        where: { quan_nhan_id: { in: personnelIds } },
        select: { quan_nhan_id: true, nam: true },
      }),
    ]);

    const pendingPersonnelIds = buildPendingKeys(
      pendingProposals as Array<Record<string, unknown>>,
      'data_nien_han',
      (item) => item.personnel_id as string
    );
    const pendingConflicts: string[] = [];
    for (const item of validItems) {
      if (pendingPersonnelIds.has(item.personnel_id)) {
        pendingConflicts.push(`${item.ho_ten}: đang có đề xuất HC Quân kỳ quyết thắng chờ duyệt`);
      }
    }
    if (pendingConflicts.length > 0) {
      throw new ValidationError(pendingConflicts.join('; '));
    }
    const existingSet = new Set(existingRecords.map(r => r.quan_nhan_id));

    const conflicts: string[] = [];
    for (const item of validItems) {
      if (existingSet.has(item.personnel_id)) {
        conflicts.push(
          `${item.ho_ten}: đã có Huy chương Quân kỳ quyết thắng trên hệ thống`
        );
      }
    }
    if (conflicts.length > 0) {
      throw new ValidationError(conflicts.join('; '));
    }

    return await prisma.$transaction(
      async prismaTx => {
        const results = [];
        for (const item of validItems) {
          const result = await prismaTx.huanChuongQuanKyQuyetThang.upsert({
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
          });
          results.push(result);
        }
        return { imported: results.length, data: results };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT }
    );
  }

  async exportTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const { personnelList, decisionNumbers } = await fetchTemplateData({
      personnelIds,
      loaiKhenThuong: PROPOSAL_TYPES.HC_QKQT,
    });
    return buildTemplate({
      sheetName: AWARD_EXCEL_SHEETS.HC_QKQT,
      columns: HCQKQT_TEMPLATE_COLUMNS,
      personnelList,
      decisionNumbers,
      repeatMap,
      editableColumnLetters: ['K'],
    });
  }

  async getAll(
    filters: MilitaryFlagFilters = {},
    page: number = 1,
    limit: number = 50
  ) {
    const where: Record<string, unknown> = {};

    const quanNhanFilter: Record<string, unknown> = {};
    if (filters.ho_ten) {
      quanNhanFilter.ho_ten = { contains: filters.ho_ten, mode: 'insensitive' };
    }

    if (filters.don_vi_id) {
      if (filters.include_sub_units) {
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

    const [data, total] = await Promise.all([
      militaryFlagRepository.findManyRaw({
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
      militaryFlagRepository.count(where),
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

  async exportToExcel(filters: MilitaryFlagFilters = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.HC_QKQT);

    worksheet.columns = [...MILITARY_FLAG_EXPORT_COLUMNS];

    styleHeaderRow(worksheet);

    data.forEach((item, index) => {
      worksheet.addRow(sanitizeRowData({
        stt: index + 1,
        id: item.quan_nhan_id,
        ho_ten: item.QuanNhan?.ho_ten ?? '',
        cap_bac: item.cap_bac ?? '',
        chuc_vu: item.chuc_vu ?? '',
        nam: item.nam,
        so_quyet_dinh: item.so_quyet_dinh ?? '',
        ghi_chu: item.ghi_chu ?? '',
        don_vi:
          item.QuanNhan?.CoQuanDonVi?.ten_don_vi ?? item.QuanNhan?.DonViTrucThuoc?.ten_don_vi ?? '',
      }));
    });

    return await workbook.xlsx.writeBuffer();
  }

  async getStatistics() {
    const byYear = await militaryFlagRepository.groupByYear();

    const total = await militaryFlagRepository.count({});

    return {
      total,
      byYear,
    };
  }

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

  async getByPersonnelId(personnelId: string) {
    const result = await militaryFlagRepository.findUniqueRaw({
      where: { quan_nhan_id: personnelId },
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
    });
    return result ? [result] : [];
  }

  async getPersonnelById(personnelId: string) {
    return await quanNhanRepository.findUnitScope(personnelId);
  }

  async deleteAward(id: string, adminUsername = 'Admin') {
    const award = await militaryFlagRepository.findUniqueRaw({
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

    await militaryFlagRepository.delete(id);

    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCQKQT', adminUsername);
    } catch (error) {
      writeSystemLog({
        action: 'ERROR',
        resource: AWARD_SLUGS.MILITARY_FLAG,
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng ${AWARD_LABEL}: ${error}`,
      });
    }

    return {
      message: `Xóa khen thưởng ${AWARD_LABEL} thành công`,
      personnelId,
    };
  }
}

export default new MilitaryFlagService();
