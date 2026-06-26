/*
 * ════════════════════════════════════════════════════════════════════════════
 *  MILITARY FLAG SERVICE — CRUD + Excel I/O cho HC_QKQT
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  HC_QKQT = Huân chương Quân kỳ Quyết thắng.
 *
 *  ĐIỀU KIỆN:
 *  - Sĩ quan/QNCN đủ 25 năm phục vụ.
 *  - LIFETIME — 1 quân nhân chỉ nhận 1 lần (unique trên quan_nhan_id).
 *  - Không phân biệt giới tính (khác KNC).
 *
 *  ELIGIBILITY:
 *  Dùng `serviceYearsEligibility.evaluateServiceYears` để check thâm niên.
 *  Throw nếu chưa đủ 25 năm hoặc thiếu ngay_nhap_ngu.
 *
 *  EXCEL IMPORT: 2-step preview + confirm. Validate CCCD + năm nhận
 *  trước khi commit.
 *
 *  RECALC: không có hồ sơ riêng cho HC_QKQT (1 record = đủ, không cần
 *  profile aggregate). FE query trực tiếp khi cần.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { buildMedalListWhere } from '../helpers/unitHelper';
import { militaryFlagRepository } from '../repositories/militaryFlag.repository';
import { proposalRepository } from '../repositories/proposal.repository';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import { NotFoundError } from '../middlewares/errorHandler';
import { buildTemplate, buildAwardExportBuffer } from '../helpers/excel/excelTemplateHelper';
import { fetchTemplateData } from './excel/templateData.service';
import { finalizeMedalAwardDeletion, getAccountUnitScope } from './medalAwardHelpers';
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

  // HC QKQT cũng 1 hạng duy nhất → không dropdown danh hiệu, 1 cột điền ('K').
  // Cùng khuôn template chung qua buildTemplate.
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
    // buildMedalListWhere: ráp điều kiện lọc + phạm vi đơn vị (gồm cả ĐVTT con nếu cần)
    const where = await buildMedalListWhere(filters as Record<string, unknown>);

    // Song song: lấy 1 trang dữ liệu + đếm tổng số bản ghi (phục vụ phân trang)
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

  // Export HC QKQT theo khuôn chung (getAll → buildAwardExportBuffer).
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
    return getAccountUnitScope(userId);
  }

  async getByPersonnelId(personnelId: string) {
    // HC_QKQT là lifetime → mỗi quân nhân tối đa 1 bản ghi (unique theo quan_nhan_id)
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
    // Bọc thành mảng (0 hoặc 1 phần tử) để FE dùng chung kiểu danh sách
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

    // HC_QKQT không có hồ sơ aggregate riêng → KHÔNG truyền recalcProfile (khác HCBVTQ)
    return finalizeMedalAwardDeletion({
      id,
      award,
      personnel: award.QuanNhan,
      personnelId: award.quan_nhan_id,
      adminUsername,
      awardLabel: AWARD_LABEL,
      resourceSlug: AWARD_SLUGS.MILITARY_FLAG,
      proposalType: PROPOSAL_TYPES.HC_QKQT,
      deleteFn: () => militaryFlagRepository.delete(id),
    });
  }

  /**
   * Checks whether a personnel already holds HC QKQT or has a pending proposal for it.
   * @param personnelId - Personnel ID
   * @returns `{ alreadyReceived, reason, award?/proposal? }`
   */
  async checkAlreadyReceived(personnelId: string) {
    // Đã có bản ghi HC_QKQT → đã nhận (lifetime, không cấp lại)
    const existingAward = await militaryFlagRepository.findUniqueRaw({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) return { alreadyReceived: true, reason: 'Đã nhận', award: existingAward };

    // loai_de_xuat = HC_QKQT khoá đúng loại; data_nien_han là cột JSON chia sẻ (cùng
    // cấu trúc với KNC/HCCSVV, không phải logic niên hạn). array_contains tìm đề xuất
    // đang chờ duyệt có chứa quân nhân này.
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
