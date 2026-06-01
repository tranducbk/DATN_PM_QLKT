/*
 * ════════════════════════════════════════════════════════════════════════════
 *  TENURE MEDAL SERVICE — CRUD + Excel I/O cho HCCSVV (Huy chương CSVV)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  TRÁCH NHIỆM:
 *  - CRUD record KhenThuongHCCSVV.
 *  - Excel template export (mẫu) + import (preview + confirm).
 *  - Trigger recalc profile/tenure.ts sau insert/update/delete.
 *
 *  RANK ORDER VALIDATION (xem helpers/awardValidation/tenureMedalRankOrder.ts):
 *  - Hạng Nhì → phải đã có Hạng Ba với năm < year.
 *  - Hạng Nhất → phải đã có Hạng Ba + Hạng Nhì.
 *
 *  EXCEL IMPORT FLOW — 2-STEP (preview + confirm):
 *  ① previewImport: parse + validate → trả {valid, invalid, summary}.
 *  ② confirmImport: user confirm → ghi DB trong transaction.
 *  Lý do tách: user review lỗi trước khi commit + atomic confirm.
 *
 *  RECALC SAU IMPORT:
 *  Bulk import → loop trigger safeRecalculateTenureProfile cho từng quân
 *  nhân. Trade-off: chậm với 100+ row. NÊN tối ưu batch recalc.
 * ════════════════════════════════════════════════════════════════════════════
 */

import ExcelJS from 'exceljs';
import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { accountRepository } from '../repositories/account.repository';
import profileService from './profile.service';
import * as notificationHelper from '../helpers/notification';
import { sanitizeRowData } from '../helpers/excel/excelHelper';
import { buildTemplate, styleHeaderRow } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { writeSystemLog } from '../helpers/systemLogHelper';
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
import { previewImport as doPreviewImport, confirmImport as doConfirmImport } from './tenureMedal/import';
import type { HccsvvValidItem } from './tenureMedal/types';

export type { HccsvvValidItem } from './tenureMedal/types';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.TENURE_MEDALS];

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
      writeSystemLog({
        action: 'ERROR',
        resource: AWARD_SLUGS.TENURE_MEDALS,
        resourceId: id,
        description: `Lỗi tính lại hồ sơ khen thưởng niên hạn sau khi xóa ${AWARD_LABEL}: ${recalcError}`,
      });
    }

    try {
      await notificationHelper.notifyOnAwardDeleted(award, personnel, 'HCCSVV', adminUsername);
    } catch (notifyError) {
      writeSystemLog({
        action: 'ERROR',
        resource: AWARD_SLUGS.TENURE_MEDALS,
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

export default new HCCSVVService();
