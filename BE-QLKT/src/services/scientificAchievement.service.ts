/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SCIENTIFIC ACHIEVEMENT SERVICE — CRUD + Excel I/O cho NCKH
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  NCKH = Thành tích Nghiên cứu Khoa học hàng năm.
 *  KHÁC khen thưởng khác: KHÔNG phải huân chương, mà là THÀNH TÍCH ghi
 *  nhận hàng năm (đề tài, sáng kiến, công bố).
 *
 *  UNIQUE TUPLE: (quan_nhan_id, nam, mo_ta)
 *  - 1 quân nhân nhiều thành tích/năm (vd: 2 đề tài cấp đơn vị).
 *  - Nhưng 2 thành tích trùng mô tả + năm = trùng → reject.
 *  - App-layer check + DB không có composite unique (nên thêm).
 *
 *  ROLE TRONG CHUỖI DANH HIỆU:
 *  - NCKH là PREREQUISITE cho BKBQP/CSTDTQ/BKTTCP cá nhân.
 *  - Eligibility yêu cầu "NCKH mỗi năm trong chuỗi CSTDCS".
 *  - Recalc annual profile sau khi insert NCKH → cập nhật `nckh_lien_tuc`
 *    + flag du_dieu_kien_* (xem profile/annual.ts).
 *
 *  EXCEL TEMPLATE format:
 *  - CCCD | Năm | Loại đề tài | Mô tả | Cấp bậc | Chức vụ | Số QĐ
 *  - `loai` = enum (DE_TAI_CAP_BO, SANG_KIEN_DON_VI, ...).
 *  - `mo_ta` = free text (search dễ duplicate).
 *
 *  IMPORT TRIGGER PROFILE RECALC:
 *  Sau bulk import, loop trigger safeRecalculateAnnualProfile để cập
 *  nhật chuỗi danh hiệu của tất cả quân nhân bị ảnh hưởng.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
  loai?: string;
  don_vi_id?: string;
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

    // Xác nhận quân nhân tồn tại trước, tránh trả danh sách rỗng gây hiểu nhầm.
    const personnel = await quanNhanRepository.findIdById(personnelId);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Toàn bộ thành tích NCKH của quân nhân này, năm mới nhất lên đầu.
    const achievements = await scientificAchievementRepository.findManyRaw({
      where: { quan_nhan_id: personnelId },
      orderBy: { nam: 'desc' },
    });

    return achievements;
  }

  async createAchievement(data: CreateAchievementData) {
    const { personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = data;

    // Quân nhân phải tồn tại mới gắn được thành tích.
    const personnel = await quanNhanRepository.findIdById(personnel_id);

    if (!personnel) {
      throw new NotFoundError('Quân nhân');
    }

    // Chuẩn hóa loại nhập tay (đề tài/sáng kiến...) về mã chuẩn; sai → từ chối kèm
    // danh sách loại hợp lệ.
    const loaiCode = resolveNckhCode(loai);
    if (!loaiCode) {
      throw new ValidationError(
        'Loại thành tích không hợp lệ. Chỉ chấp nhận: ' + Object.values(DANH_HIEU_NCKH).join(', ')
      );
    }

    // Tạo bản ghi thành tích; field tùy chọn để trống đưa về null cho nhất quán.
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

    // NCKH là điều kiện cần của chuỗi BKBQP/CSTDTQ/BKTTCP → recalc lại hồ sơ hằng năm.
    // Recalc lỗi không được chặn việc tạo thành tích → chỉ log, vẫn trả record.
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
    // Đọc kèm QuanNhan (tên + đơn vị) ngay bây giờ để còn dữ liệu dựng thông báo
    // sau khi record đã bị xóa.
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

    // Xóa NCKH có thể làm đứt điều kiện chuỗi danh hiệu → tính lại hồ sơ; lỗi chỉ log.
    try {
      await profileService.recalculateAnnualProfile(personnelId);
    } catch (error) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
        description: logMessages.recalcError('xóa', AWARD_LABEL, error),
      });
    }

    // Báo cho quân nhân/đơn vị biết thành tích bị xóa; lỗi gửi thông báo không chặn luồng.
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

  // NCKH là THÀNH TÍCH nghiên cứu (không phải khen thưởng) nên filter theo `loai`
  // (DTKH/SKKH) thay vì `danh_hieu`. Khung export y hệt các loại khác: build where
  // tăng dần → query → addRow + sanitizeRowData → return Workbook (controller lo HTTP).
  async exportToExcel(filters: ExportFilters = {}) {
    const { nam, loai, don_vi_id } = filters;

    const where: Record<string, unknown> = {};
    if (nam) where.nam = nam;
    if (loai) where.loai = loai;
    // Lọc theo đơn vị: khớp quân nhân thuộc CQDV HOẶC DVTT trùng id (đơn vị cha/con).
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
      // Tên đơn vị hiển thị ưu tiên DVTT (đơn vị cụ thể của quân nhân) rồi mới CQDV.
      // cap_bac/chuc_vu ưu tiên giá trị lưu tại bản ghi thành tích, fallback hồ sơ.
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

  // Template NCKH dùng chung buildTemplate như personal. Không truyền danhHieuOptions
  // (NCKH chọn loại qua cột riêng trong NCKH_TEMPLATE_COLUMNS, không phải dropdown
  // danh hiệu), nhưng vẫn lấy decisionNumbers để gắn dropdown số QĐ.
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

  /*
   * NCKH IMPORT 2 bước — preview (validate) + confirm (ghi DB) tách sang
   * ./scientificAchievement/import. NCKH là THÀNH TÍCH (DTKH/SKKH), 1 quân nhân có
   * NHIỀU thành tích/năm (khác khen thưởng 1 record/năm) → không chặn trùng theo
   * (id, năm), chỉ validate loại + mô tả + số QĐ.
   */
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
    // quanNhanWhere do controller dựng sẵn theo phạm vi đơn vị người xem (lọc theo quyền).
    if (quanNhanWhere) where.QuanNhan = quanNhanWhere;

    // Lấy đồng thời 1 trang dữ liệu + tổng số bản ghi (phục vụ phân trang).
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
