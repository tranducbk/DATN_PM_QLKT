import ExcelJS from 'exceljs';
import { buildMedalListWhere } from '../helpers/unitHelper';
import { contributionMedalRepository } from '../repositories/contributionMedal.repository';
import { accountRepository } from '../repositories/account.repository';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { getDanhHieuName } from '../constants/danhHieu.constants';
import { NotFoundError } from '../middlewares/errorHandler';
import { sanitizeRowData } from '../helpers/excel/excelHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { buildTemplate, styleHeaderRow } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import {
  AWARD_EXCEL_SHEETS,
  HCBVTQ_EXPORT_COLUMNS,
  HCBVTQ_TEMPLATE_COLUMNS,
  HCBVTQ_TEMPLATE_OPTIONS,
} from '../constants/awardExcel.constants';
import {
  previewImport as doPreviewImport,
  confirmImport as doConfirmImport,
} from './contributionMedal/import';
import type { ContributionAwardValidItem } from './contributionMedal/types';

export type { ContributionAwardValidItem } from './contributionMedal/types';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.CONTRIBUTION_MEDALS];

class ContributionAwardService {
  /**
   * Export template Excel for Contribution Awards (HCBVTQ) import.
   * @param personnelIds - Pre-fill with selected personnel
   * @param repeatMap - Map of personnel id to repeat count for pre-fill rows
   * @returns Excel workbook buffer
   */
  async exportTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const { personnelList, decisionNumbers } = await fetchTemplateData({
      personnelIds,
      loaiKhenThuong: PROPOSAL_TYPES.CONG_HIEN,
    });
    return buildTemplate({
      sheetName: AWARD_EXCEL_SHEETS.HCBVTQ,
      columns: HCBVTQ_TEMPLATE_COLUMNS,
      personnelList,
      decisionNumbers,
      repeatMap,
      danhHieuOptions: HCBVTQ_TEMPLATE_OPTIONS,
      editableColumnLetters: ['J', 'K'],
    });
  }

  /**
   * Preview import: validate Excel data without saving to DB.
   * @param buffer - Raw Excel file buffer
   * @returns Validation result with valid rows, errors, and total count
   */
  async previewImport(buffer: Buffer) {
    return doPreviewImport(buffer);
  }

  /**
   * Persists validated import rows into the database.
   * @param validItems - Pre-validated items from previewImport
   * @param adminId - Admin performing the import (audit context)
   * @returns Count and data of imported records
   */
  async confirmImport(validItems: ContributionAwardValidItem[], adminId: string) {
    return doConfirmImport(validItems);
  }

  /**
   * Get all Contribution Awards with filters and pagination.
   * @param filters - Optional filters (ho_ten, don_vi_id, nam, danh_hieu)
   * @param page - Page number
   * @param limit - Page size
   * @returns Awards data with pagination metadata
   */
  async getAll(filters: Record<string, unknown> = {}, page: number = 1, limit: number = 50) {
    const where = await buildMedalListWhere(filters);

    const [data, total] = await Promise.all([
      contributionMedalRepository.findManyRaw({
        where,
        include: {
          QuanNhan: {
            select: {
              id: true,
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
      contributionMedalRepository.count(where),
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
   * Export Contribution Awards to Excel.
   * @param filters - Optional filters applied before export
   * @returns Excel workbook buffer
   */
  async exportToExcel(filters: Record<string, unknown> = {}) {
    const { data } = await this.getAll(filters, 1, 10000);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(AWARD_EXCEL_SHEETS.HCBVTQ);

    worksheet.columns = [...HCBVTQ_EXPORT_COLUMNS];

    styleHeaderRow(worksheet);

    const convertThoiGian = thoiGian => {
      if (!thoiGian) return '';
      if (typeof thoiGian === 'object') {
        const years = thoiGian.years ?? 0;
        const months = thoiGian.months ?? 0;
        return years * 12 + months;
      } else if (typeof thoiGian === 'number') {
        return thoiGian;
      } else if (typeof thoiGian === 'string') {
        try {
          const parsed = JSON.parse(thoiGian);
          const years = parsed.years ?? 0;
          const months = parsed.months ?? 0;
          return years * 12 + months;
        } catch (error) {
          console.error('Failed to parse thoi_gian JSON when exporting contribution medals:', error);
          return thoiGian;
        }
      }
      return '';
    };

    data.forEach((item, index) => {
      worksheet.addRow(
        sanitizeRowData({
          stt: index + 1,
          id: item.QuanNhan?.id ?? '',
          cccd: item.QuanNhan?.cccd ?? '',
          ho_ten: item.QuanNhan?.ho_ten ?? '',
          cap_bac: item.cap_bac ?? '',
          chuc_vu: item.chuc_vu ?? '',
          don_vi:
            item.QuanNhan?.CoQuanDonVi?.ten_don_vi ??
            item.QuanNhan?.DonViTrucThuoc?.ten_don_vi ??
            '',
          nam: item.nam,
          danh_hieu: getDanhHieuName(item.danh_hieu),
          thoi_gian_nhom_0_7: convertThoiGian(item.thoi_gian_nhom_0_7),
          thoi_gian_nhom_0_8: convertThoiGian(item.thoi_gian_nhom_0_8),
          thoi_gian_nhom_0_9_1_0: convertThoiGian(item.thoi_gian_nhom_0_9_1_0),
          so_quyet_dinh: item.so_quyet_dinh ?? '',
          ghi_chu: item.ghi_chu ?? '',
        })
      );
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Get Contribution Awards statistics.
   * @returns Total count plus breakdowns by rank and year
   */
  async getStatistics() {
    const byRank = await contributionMedalRepository.groupByDanhHieu();
    const byYear = await contributionMedalRepository.groupByYear();

    const total = await contributionMedalRepository.count({});

    return {
      total,
      byRank,
      byYear,
    };
  }

  /**
   * Get user with unit info.
   * @param userId - Account id
   * @returns Account with nested personnel unit ids
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
   * Delete Contribution Award.
   * @param id - Award ID
   * @param adminUsername - Admin username performing the deletion
   * @returns Deletion result with affected personnel and award snapshot
   * @throws NotFoundError - When the award does not exist
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await contributionMedalRepository.findUniqueRaw({
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

    if (!award) {
      throw new NotFoundError('Bản ghi khen thưởng');
    }

    const personnelId = award.quan_nhan_id;
    const personnel = award.QuanNhan;

    // Delete award only, proposals are kept for audit trail
    await contributionMedalRepository.delete(id);

    try {
      await profileService.recalculateContributionProfile(personnelId);
    } catch (recalcError) {
      void writeSystemLog({
        action: 'ERROR',
        resource: AWARD_SLUGS.CONTRIBUTION_MEDALS,
        resourceId: id,
        description: `Lỗi tính lại hồ sơ khen thưởng cống hiến sau khi xóa ${AWARD_LABEL}: ${recalcError}`,
      });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCBVTQ', adminUsername);
    } catch (notifyError) {
      void writeSystemLog({
        action: 'ERROR',
        resource: AWARD_SLUGS.CONTRIBUTION_MEDALS,
        resourceId: id,
        description: `Lỗi gửi thông báo xóa khen thưởng ${AWARD_LABEL}: ${notifyError}`,
      });
    }

    return {
      message: `Xóa khen thưởng ${AWARD_LABEL} thành công`,
      personnelId,
      award,
    };
  }
}

export default new ContributionAwardService();
