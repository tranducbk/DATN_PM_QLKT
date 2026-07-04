import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { scientificAchievementRepository } from '../repositories/scientificAchievement.repository';
import ExcelJS from 'exceljs';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { DANH_HIEU_NCKH, resolveNckhCode } from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { NotFoundError, ValidationError } from '../middlewares/errorHandler';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS];
import { buildTemplate, styleHeaderRow } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { sanitizeRowData } from '../helpers/excel/excelHelper';
import { EXPORT_FETCH_LIMIT } from '../constants/excel.constants';
import {
  AWARD_EXCEL_SHEETS,
  NCKH_EXPORT_COLUMNS,
  NCKH_TEMPLATE_COLUMNS,
} from '../constants/awardExcel.constants';

interface CreateAchievementData {
  personnel_id: string;
  nam: number;
  loai: string;
  mo_ta: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

interface ExportFilters {
  nam?: number;
  tu_nam?: number;
  den_nam?: number;
  loai?: string;
  don_vi_id?: string;
  personnel_ids?: string[];
}

import type { ConfirmImportItem } from './scientificAchievement/types';
import {
  previewImport as runPreviewImport,
  confirmImport as runConfirmImport,
} from './scientificAchievement/import';
export type { ConfirmImportItem };

class ScientificAchievementService {
  async getAchievements(personnelId: string) {
    if (!personnelId) {
      throw new ValidationError('Personnel ID is required');
    }

    const personnel = await quanNhanRepository.findIdById(personnelId);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const achievements = await scientificAchievementRepository.findManyRaw({
      where: { quan_nhan_id: personnelId },
      orderBy: { nam: 'desc' },
    });

    return achievements;
  }

  async createAchievement(data: CreateAchievementData) {
    const { personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = data;

    const personnel = await quanNhanRepository.findIdById(personnel_id);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    const loaiCode = resolveNckhCode(loai);
    if (!loaiCode) {
      throw new ValidationError(
        'Loại thành tích không hợp lệ. Chỉ chấp nhận: ' + Object.values(DANH_HIEU_NCKH).join(', ')
      );
    }

    const newAchievement = await scientificAchievementRepository.create({
      quan_nhan_id: personnel_id,
      nam,
      loai: loaiCode,
      mo_ta,
      cap_bac: cap_bac || null,
      chuc_vu: chuc_vu || null,
      so_quyet_dinh: so_quyet_dinh || null,
      ghi_chu: ghi_chu || null,
    });

    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (e) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
        description: logMessages.recalcError('cập nhật', AWARD_LABEL, e),
      });
    }

    return newAchievement;
  }

  async deleteAchievement(id: string, adminUsername = 'Admin') {
    const achievement = await scientificAchievementRepository.findUniqueRaw({
      where: { id },
      include: {
        QuanNhan: {
          select: {
            id: true,
            ho_ten: true,
            co_quan_don_vi_id: true,
            don_vi_truc_thuoc_id: true,
          },
        },
      },
    });

    if (!achievement) {
      throw new NotFoundError('Thành tích');
    }

    const personnelId = achievement.quan_nhan_id;
    const personnel = achievement.QuanNhan;

    await scientificAchievementRepository.delete(id);

    try {
      await profileService.recalculateAnnualProfile(personnelId);
    } catch (error) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
        description: logMessages.recalcError('xóa', AWARD_LABEL, error),
      });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(
        achievement,
        personnel,
        PROPOSAL_TYPES.NCKH,
        adminUsername
      );
    } catch (error) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
        description: logMessages.notifyError('xóa', AWARD_LABEL, error),
      });
    }

    return {
      message: 'Xóa thành tích thành công',
      personnelId,
      achievement,
    };
  }

  async exportToExcel(filters: ExportFilters = {}) {
    const { nam, tu_nam, den_nam, loai, don_vi_id, personnel_ids } = filters;

    const where: Record<string, unknown> = {};
    if (nam) {
      where.nam = parseInt(String(nam));
    } else if (tu_nam || den_nam) {
      const rangeFilter: any = {};
      if (tu_nam) rangeFilter.gte = parseInt(String(tu_nam));
      if (den_nam) rangeFilter.lte = parseInt(String(den_nam));
      where.nam = rangeFilter;
    }
    if (loai) where.loai = loai;
    if (personnel_ids && personnel_ids.length > 0) {
      where.quan_nhan_id = { in: personnel_ids };
    }
    if (don_vi_id) {
      where.QuanNhan = {
        OR: [{ co_quan_don_vi_id: don_vi_id }, { don_vi_truc_thuoc_id: don_vi_id }],
      };
    }

    const achievements = await scientificAchievementRepository.findManyRaw({
      where,
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: true,
            ChucVu: true,
          },
        },
      },
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      take: EXPORT_FETCH_LIMIT,
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.NCKH);

    worksheet.columns = [...NCKH_EXPORT_COLUMNS];

    styleHeaderRow(worksheet);

    achievements.forEach((achievement, index) => {
      const quanNhan = achievement.QuanNhan;
      const donVi = quanNhan?.DonViTrucThuoc?.ten_don_vi ?? quanNhan?.CoQuanDonVi?.ten_don_vi ?? '';

      worksheet.addRow(
        sanitizeRowData({
          stt: index + 1,
          id: quanNhan?.id ?? '',
          ho_ten: quanNhan?.ho_ten ?? '',
          cap_bac: achievement.cap_bac ?? quanNhan?.cap_bac ?? '',
          chuc_vu: achievement.chuc_vu ?? quanNhan?.ChucVu?.ten_chuc_vu ?? '',
          don_vi: donVi,
          nam: achievement.nam,
          loai: achievement.loai ?? '',
          mo_ta: achievement.mo_ta ?? '',
          so_quyet_dinh: achievement.so_quyet_dinh ?? '',
          ghi_chu: achievement.ghi_chu ?? '',
        })
      );
    });

    return workbook;
  }

  async generateTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const { personnelList, decisionNumbers } = await fetchTemplateData({
      personnelIds,
      loaiKhenThuong: PROPOSAL_TYPES.NCKH,
    });
    return buildTemplate({
      sheetName: AWARD_EXCEL_SHEETS.NCKH,
      columns: NCKH_TEMPLATE_COLUMNS,
      personnelList,
      decisionNumbers,
      repeatMap,
    });
  }

  async previewImport(buffer: Buffer) {
    return runPreviewImport(buffer);
  }

  async confirmImport(validItems: ConfirmImportItem[], adminId: string) {
    return runConfirmImport(validItems, adminId);
  }

  /**
   * Returns paginated list of scientific achievements with optional filters.
   * @param params - Filter and pagination params
   * @returns Achievements list and total count
   */
  async getAchievementsList(params: {
    page: number;
    limit: number;
    nam?: string;
    loai?: string;
    quanNhanWhere?: Record<string, unknown> | null;
  }) {
    const { page, limit, nam, loai, quanNhanWhere } = params;
    const where: Record<string, unknown> = {};
    if (nam) where.nam = parseInt(nam);
    if (loai) where.loai = loai;
    if (quanNhanWhere) where.QuanNhan = quanNhanWhere;

    const [achievements, total] = await Promise.all([
      scientificAchievementRepository.findManyRaw({
        where,
        include: {
          QuanNhan: { include: { CoQuanDonVi: true, DonViTrucThuoc: true, ChucVu: true } },
        },
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      scientificAchievementRepository.count(where),
    ]);

    return { achievements, total };
  }
}

export default new ScientificAchievementService();
