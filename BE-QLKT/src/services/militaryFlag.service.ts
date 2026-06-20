import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { militaryFlagRepository } from '../repositories/militaryFlag.repository';
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
import { fetchTemplateData } from './excel/templateData.service';
import {
  AWARD_EXCEL_SHEETS,
  HCQKQT_TEMPLATE_COLUMNS,
  MILITARY_FLAG_EXPORT_COLUMNS,
} from '../constants/awardExcel.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.MILITARY_FLAG];

import type { ConfirmImportItem } from './militaryFlag/types';
import {
  previewImport as runPreviewImport,
  confirmImport as runConfirmImport,
} from './militaryFlag/import';
export type { ConfirmImportItem };

interface MilitaryFlagFilters {
  ho_ten?: string;
  don_vi_id?: string;
  include_sub_units?: boolean;
  nam?: number;
}

class MilitaryFlagService {
  async previewImport(buffer: Buffer) {
    return runPreviewImport(buffer);
  }

  async confirmImport(validItems: ConfirmImportItem[]) {
    return runConfirmImport(validItems);
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

  async getAll(filters: MilitaryFlagFilters = {}, page: number = 1, limit: number = 50) {
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
    return buildAwardExportBuffer(
      data,
      AWARD_EXCEL_SHEETS.HC_QKQT,
      [...MILITARY_FLAG_EXPORT_COLUMNS],
      (item, index) => ({
        stt: index + 1,
        id: item.quan_nhan_id,
        ho_ten: item.QuanNhan?.ho_ten ?? '',
        cap_bac: item.cap_bac ?? '',
        chuc_vu: item.chuc_vu ?? '',
        nam: item.nam,
        thang: item.thang,
        so_quyet_dinh: item.so_quyet_dinh ?? '',
        ghi_chu: item.ghi_chu ?? '',
        don_vi:
          item.QuanNhan?.CoQuanDonVi?.ten_don_vi ??
          item.QuanNhan?.DonViTrucThuoc?.ten_don_vi ??
          '',
      })
    );
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

    await militaryFlagRepository.delete(id);

    try {
      await notificationHelper.notifyOnAwardDeleted(
        award,
        personnel,
        PROPOSAL_TYPES.HC_QKQT,
        adminUsername
      );
    } catch (error) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.MILITARY_FLAG,
        resourceId: id,
        description: logMessages.notifyError('xóa', AWARD_LABEL, error),
      });
    }

    return {
      message: `Xóa khen thưởng ${AWARD_LABEL} thành công`,
      personnelId,
      award,
    };
  }

  /**
   * Checks whether a personnel already holds HC QKQT or has a pending proposal for it.
   * @param personnelId - Personnel ID
   * @returns `{ alreadyReceived, reason, award?/proposal? }`
   */
  async checkAlreadyReceived(personnelId: string) {
    const existingAward = await militaryFlagRepository.findUniqueRaw({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

    const pendingProposal = await proposalRepository.findFirstRaw({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
      },
    });
    if (pendingProposal)
      return { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal };

    return { alreadyReceived: false, reason: null };
  }
}

export default new MilitaryFlagService();
