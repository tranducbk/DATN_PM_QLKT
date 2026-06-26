import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { buildMedalListWhere } from '../helpers/unitHelper';
import { commemorativeMedalRepository } from '../repositories/commemorativeMedal.repository';
import { proposalRepository } from '../repositories/proposal.repository';

import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { NotFoundError } from '../middlewares/errorHandler';
import { buildTemplate, buildAwardExportBuffer } from '../helpers/excel/excelTemplateHelper';
import { durationToMonths } from '../helpers/serviceYearsHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { finalizeMedalAwardDeletion, getAccountUnitScope } from './medalAwardHelpers';
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
    const where = await buildMedalListWhere(filters);

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
    return getAccountUnitScope(userId);
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

    // KNC VSNXD does not affect annual/tenure/contribution profiles, so no recalc.
    return finalizeMedalAwardDeletion({
      id,
      award,
      personnel: award.QuanNhan,
      personnelId: award.quan_nhan_id,
      adminUsername,
      awardLabel: AWARD_LABEL,
      resourceSlug: AWARD_SLUGS.COMMEMORATIVE_MEDALS,
      proposalType: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      deleteFn: () => commemorativeMedalRepository.delete(id),
    });
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
