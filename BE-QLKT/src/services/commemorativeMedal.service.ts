import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { commemorativeMedalRepository } from '../repositories/commemorativeMedal.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { accountRepository } from '../repositories/account.repository';

import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import * as notificationHelper from '../helpers/notification';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { NotFoundError } from '../middlewares/errorHandler';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { buildTemplate, buildAwardExportBuffer } from '../helpers/excel/excelTemplateHelper';
import { durationToMonths } from '../helpers/serviceYearsHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.COMMEMORATIVE_MEDALS];
import {
  AWARD_EXCEL_SHEETS,
  KNC_EXPORT_COLUMNS,
  KNC_TEMPLATE_COLUMNS,
} from '../constants/awardExcel.constants';

import type { CommemorativeMedalValidItem } from './commemorativeMedal/types';
import {
  previewImport as runPreviewImport,
  confirmImport as runConfirmImport,
} from './commemorativeMedal/import';
export type { CommemorativeMedalValidItem };

class CommemorativeMedalService {
  /**
   * Export template Excel for Commemorative Medal (KNC VSNXD) import
   * Pre-filled with selected personnel
   */
  async exportTemplate(personnelIds: string[] = [], repeatMap: Record<string, number> = {}) {
    const { personnelList, decisionNumbers } = await fetchTemplateData({
      personnelIds,
      loaiKhenThuong: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    });
    return buildTemplate({
      sheetName: AWARD_EXCEL_SHEETS.KNC,
      columns: KNC_TEMPLATE_COLUMNS,
      personnelList,
      decisionNumbers,
      repeatMap,
      editableColumnLetters: ['K'],
    });
  }

  /**
   * Previews KNC VSNXD import from Excel (validation only, no DB writes).
   * Returns valid rows with history and detailed validation errors.
   */
  async previewImport(buffer: Buffer) {
    return runPreviewImport(buffer);
  }

  /**
   * Persists validated import rows into the database.
   */
  async confirmImport(validItems: CommemorativeMedalValidItem[], adminId: string) {
    return runConfirmImport(validItems, adminId);
  }

  /**
   * Get all Commemorative Medals with filters and pagination
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

    const [data, total] = await Promise.all([
      commemorativeMedalRepository.findManyRaw({
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
      commemorativeMedalRepository.count(where),
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
   * Export Commemorative Medals to Excel
   */
  async exportToExcel(filters: Record<string, unknown> = {}) {
    const { data } = await this.getAll(filters, 1, 10000);
    return buildAwardExportBuffer(
      data,
      AWARD_EXCEL_SHEETS.KNC,
      [...KNC_EXPORT_COLUMNS],
      (item, index) => ({
        stt: index + 1,
        cccd: item.QuanNhan.cccd,
        ho_ten: item.QuanNhan.ho_ten,
        don_vi:
          item.QuanNhan.CoQuanDonVi?.ten_don_vi ?? item.QuanNhan.DonViTrucThuoc?.ten_don_vi ?? '',
        nam: item.nam,
        thang: item.thang,
        cap_bac: item.cap_bac,
        chuc_vu: item.chuc_vu,
        thoi_gian: durationToMonths(item.thoi_gian),
        so_quyet_dinh: item.so_quyet_dinh,
        ghi_chu: item.ghi_chu ?? '',
      })
    );
  }

  /**
   * Get Commemorative Medals statistics
   */
  async getStatistics() {
    const byYear = await commemorativeMedalRepository.groupByYear();

    const total = await commemorativeMedalRepository.count({});

    return {
      total,
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
   * Get Commemorative Medal by personnel ID
   */
  async getByPersonnelId(personnelId: string) {
    const result = await commemorativeMedalRepository.findUniqueRaw({
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

  /**
   * Get personnel by ID (helper method)
   */
  async getPersonnelById(personnelId: string) {
    return await quanNhanRepository.findUnitScope(personnelId);
  }

  /**
   * Delete Commemorative Medal
   * @param {string} id - Award ID
   * @param {string} adminUsername - Admin username performing the deletion
   * @returns {Promise<Object>}
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    const award = await commemorativeMedalRepository.findUniqueRaw({
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
    await commemorativeMedalRepository.delete(id);

    // KNC VSNXD does not affect annual/tenure/contribution profiles

    try {
      await notificationHelper.notifyOnAwardDeleted(
        award,
        personnel,
        PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        adminUsername
      );
    } catch (notifyError) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.COMMEMORATIVE_MEDALS,
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

  /**
   * Checks whether a personnel already holds KNC VSNXD QDNDVN or has a pending proposal for it.
   * @param personnelId - Personnel ID
   * @returns `{ alreadyReceived, reason, award?/proposal? }`
   */
  async checkAlreadyReceived(personnelId: string) {
    const existingAward = await commemorativeMedalRepository.findUniqueRaw({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

    const pendingProposal = await proposalRepository.findFirstRaw({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
      },
    });
    if (pendingProposal)
      return { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal };

    return { alreadyReceived: false, reason: null };
  }
}

export default new CommemorativeMedalService();
