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

import { tenureMedalRepository } from '../repositories/tenureMedal.repository';
import { buildMedalListWhere } from '../helpers/unitHelper';
import profileService from './profile.service';
import { buildTemplate, buildAwardExportBuffer } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { finalizeMedalAwardDeletion, getAccountUnitScope } from './medalAwardHelpers';
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
  // HCCSVV (niên hạn) theo đúng khuôn export chung qua buildTemplate. Khác biệt:
  // dropdown danh hiệu là 3 hạng Ba/Nhì/Nhất (HCCSVV_TEMPLATE_OPTIONS) và có 3
  // cột admin điền ('J','K','L') thay vì 2.
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
  // Import HCCSVV 2 bước (preview chỉ validate, confirm ghi DB trong transaction)
  // tách sang ./tenureMedal/import; 2 hàm dưới chỉ là cửa cho controller gọi.
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
    // buildMedalListWhere dịch filter từ UI (năm, đơn vị, danh hiệu...) thành điều kiện Prisma.
    const where = await buildMedalListWhere(filters);

    // 1 trang dữ liệu (kèm thông tin quân nhân + đơn vị) và tổng số bản ghi, chạy song song.
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
  // Tái dùng this.getAll (đã sẵn logic filter + join QuanNhan) thay vì viết lại
  // where — limit 10000 để lấy trọn cho báo cáo. buildAwardExportBuffer trả thẳng
  // BUFFER (khác annualReward trả Workbook để controller gói).
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
    // Thống kê cho dashboard: đếm theo hạng danh hiệu, theo năm, và tổng số.
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
    // Lấy phạm vi đơn vị (CQDV/DVTT) của tài khoản để lọc dữ liệu theo quyền người dùng.
    return getAccountUnitScope(userId);
  }

  /**
   * Delete HCCSVV award
   * @param id - Award ID
   * @param adminUsername - Admin username performing the deletion
   */
  async deleteAward(id: string, adminUsername: string = 'Admin') {
    // Đọc kèm QuanNhan (tên + đơn vị) để dựng thông báo; không tìm thấy → 404.
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

    // Gom các bước xóa dùng chung cho mọi loại huân chương (xóa record → recalc hồ sơ
    // → gửi thông báo). Truyền deleteFn + recalcProfile riêng cho HCCSVV (niên hạn).
    return finalizeMedalAwardDeletion({
      id,
      award,
      personnel: award.QuanNhan,
      personnelId: award.quan_nhan_id,
      adminUsername,
      awardLabel: AWARD_LABEL,
      resourceSlug: AWARD_SLUGS.TENURE_MEDALS,
      proposalType: PROPOSAL_TYPES.NIEN_HAN,
      deleteFn: () => tenureMedalRepository.delete(id),
      recalcProfile: pid => profileService.recalculateTenureProfile(pid),
    });
  }
}

export default new TenureMedalService();
