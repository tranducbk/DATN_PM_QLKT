import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { buildMedalListWhere } from '../helpers/unitHelper';
import { accountRepository } from '../repositories/account.repository';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { buildTemplate, buildAwardExportBuffer } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { NotFoundError } from '../middlewares/errorHandler';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import {
  AWARD_EXCEL_SHEETS,
  HCCSVV_EXPORT_COLUMNS,
  HCCSVV_TEMPLATE_COLUMNS,
  HCCSVV_TEMPLATE_OPTIONS,
} from '../constants/awardExcel.constants';
import {
  previewImport as doPreviewImport,
  confirmImport as doConfirmImport,
} from './tenureMedal/import';
import type { HccsvvValidItem } from './tenureMedal/types';

export type { HccsvvValidItem } from './tenureMedal/types';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.TENURE_MEDALS];

class TenureMedalService {
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
   * @param buffer - Raw Excel file buffer
   * @returns Validation result with valid rows, errors, and total count
   */
  async previewImport(buffer: Buffer) {
    return doPreviewImport(buffer);
  }

  /**
   * Persists validated import rows into the database.
   * @param validItems - Pre-validated items from previewImport
   * @returns Count and data of imported records
   */
  async confirmImport(validItems: HccsvvValidItem[]) {
    return doConfirmImport(validItems);
  }

  /**
   * Get all HCCSVV with filters and pagination
   */
  async getAll(filters: Record<string, unknown> = {}, page: number = 1, limit: number = 50) {
    const where = await buildMedalListWhere(filters);

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
    return buildAwardExportBuffer(
      data,
      AWARD_EXCEL_SHEETS.HCCSVV,
      [...HCCSVV_EXPORT_COLUMNS],
      (item, index) => ({
        stt: index + 1,
        id: item.quan_nhan_id,
        ho_ten: item.QuanNhan?.ho_ten ?? '',
        cap_bac: item.cap_bac ?? '',
        chuc_vu: item.chuc_vu ?? '',
        nam: item.nam,
        thang: item.thang,
        danh_hieu: item.danh_hieu,
        so_quyet_dinh: item.so_quyet_dinh ?? '',
        ghi_chu: item.ghi_chu ?? '',
      })
    );
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
   * Delete HCCSVV award
   * @param id - Award ID
   * @param adminUsername - Admin username performing the deletion
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await tenureMedalRepository.findUniqueRaw({
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
    await tenureMedalRepository.delete(id);

    try {
      await profileService.recalculateTenureProfile(personnelId);
    } catch (recalcError) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.TENURE_MEDALS,
        resourceId: id,
        description: logMessages.recalcError('xóa', AWARD_LABEL, recalcError),
      });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(
        award,
        personnel,
        PROPOSAL_TYPES.NIEN_HAN,
        adminUsername
      );
    } catch (notifyError) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.TENURE_MEDALS,
        resourceId: id,
        description: logMessages.notifyError('xóa', AWARD_LABEL, notifyError),
      });
    }

    return {
      message: `Xóa khen thưởng ${AWARD_LABEL} thành công`,
      personnelId,
      award,
    };
  }
}

export default new TenureMedalService();
