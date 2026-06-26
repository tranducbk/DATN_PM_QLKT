import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { accountRepository } from '../repositories/account.repository';
import { decisionFileRepository } from '../repositories/decisionFile.repository';
import * as notificationHelper from '../helpers/notification';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { buildBulkAwardSummaryMessage } from '../helpers/award/awardSummaryMessage';
import {
  formatDanhHieuList,
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
  DANH_HIEU_NCKH,
  LOAI_DE_XUAT_MAP,
} from '../constants/danhHieu.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import { ROLES } from '../constants/roles.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import { AppError, ValidationError } from '../middlewares/errorHandler';
import type { QuanNhan } from '../generated/prisma';
import { TYPES_WITH_PERSONNEL_DUP } from './awardBulk/dispatchTables';
import {
  checkDuplicateAwards,
  checkDuplicateUnitAwards,
  validatePersonnelConditions,
  throwValidationErrors,
} from './awardBulk/validation';
import { CREATE_HANDLERS } from './awardBulk/handlers';
import type { BulkCreateAwardsParams, BulkCreateContext } from './awardBulk/types';

export type { TitleDataItem } from './awardBulk/types';

class AwardBulkService {
  checkDuplicateAwards = checkDuplicateAwards;
  checkDuplicateUnitAwards = checkDuplicateUnitAwards;
  validatePersonnelConditions = validatePersonnelConditions;

  /*
   * ═══════════════════════════════════════════════════════════════════════
   *  BULK CREATE AWARDS — ADMIN tạo khen thưởng hàng loạt (bypass đề xuất)
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  KHÁC VỚI APPROVE FLOW:
   *  - Approve flow: Manager nộp đề xuất → Admin duyệt → import (qua bảng
   *    BangDeXuat trung gian, có audit trail).
   *  - Bulk flow:    Admin trực tiếp tạo khen thưởng, KHÔNG qua đề xuất.
   *                  Dùng cho: import lịch sử cũ, tạo khen thưởng đột xuất
   *                  hàng loạt, fix data sai.
   *
   *  WHY hai flow:
   *  Bulk nhanh + linh hoạt cho ADMIN nhưng KHÔNG có quy trình kiểm soát
   *  như approve. Vì vậy chỉ ADMIN/SUPER_ADMIN dùng được (xem route guard).
   *
   *  3 LỚP VALIDATION (trước khi insert):
   *  1. checkDuplicateAwards/UnitAwards: trùng cá nhân/đơn vị + năm + danh
   *     hiệu trong DB.
   *  2. validatePersonnelConditions: đủ điều kiện eligibility (chuỗi
   *     CSTDCS, thâm niên, ...). Có flag bypassEligibility cho admin
   *     muốn override (vd: import data cũ).
   *  3. (per-handler validation trong CREATE_HANDLERS dispatch).
   *
   *  DISPATCH HANDLER PATTERN (CREATE_HANDLERS map):
   *  Khác Strategy pattern (object instance), đây là FUNCTION MAP:
   *      { CA_NHAN_HANG_NAM: createCaNhanHangNam, ... }
   *  Dispatch: const handler = CREATE_HANDLERS[type]; handler(items, ctx).
   *  Đơn giản hơn strategy vì bulk không cần submit/approve phase tách biệt.
   *
   *  PARALLEL CREATE:
   *  Handler dùng prisma.$transaction([createMany, ...]) → atomic.
   *  Nếu BẤT KỲ item fail → rollback tất cả. Bulk operation "all-or-nothing".
   *
   *  NOTIFICATION FAN-OUT:
   *  Sau khi tạo thành công, notify từng quân nhân được khen thưởng. Dùng
   *  Promise.all để gửi song song (fire-and-forget — fail noti không
   *  rollback award).
   * ═══════════════════════════════════════════════════════════════════════
   */
  async bulkCreateAwards({
    type,
    nam,
    thang,
    selectedPersonnel,
    selectedUnits,
    titleData,
    ghiChu,
    adminId,
    bypassEligibility,
  }: BulkCreateAwardsParams) {
    const errors: string[] = [];
    const createdRecords: unknown[] = [];
    const errorDetails: { personnelId: string; error: string }[] = [];
    const affectedPersonnelIds = new Set<string>();
    const affectedUnitIds = new Set<string>();
    let importedCount = 0;

    const duplicateErrors: string[] = [];

    if (TYPES_WITH_PERSONNEL_DUP.includes(type as ProposalType)) {
      const personnelDuplicates = await this.checkDuplicateAwards(type, nam, titleData);
      duplicateErrors.push(...personnelDuplicates);
    }

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const unitDuplicates = await this.checkDuplicateUnitAwards(nam, titleData);
      duplicateErrors.push(...unitDuplicates);
    }

    if (duplicateErrors.length > 0) {
      throw new AppError(
        `Phát hiện khen thưởng trùng (cùng năm và cùng danh hiệu):\n${duplicateErrors.join('\n')}`,
        409
      );
    }

    const typesNeedingPersonnelValidation: ProposalType[] = [
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      PROPOSAL_TYPES.NIEN_HAN,
      PROPOSAL_TYPES.HC_QKQT,
    ];
    if (!bypassEligibility && typesNeedingPersonnelValidation.includes(type as ProposalType)) {
      const validationErrors = await this.validatePersonnelConditions(type, selectedPersonnel);
      errors.push(...validationErrors);
    }

    if (type === PROPOSAL_TYPES.NCKH) {
      const validNCKHCodes = Object.keys(DANH_HIEU_NCKH);
      titleData.forEach((item, index) => {
        if (!item.loai || !validNCKHCodes.includes(item.loai)) {
          errors.push(
            `Dòng ${index + 1}: Thành tích khoa học phải có loại hợp lệ (${validNCKHCodes.join(', ')})`
          );
        }
        if (!item.mo_ta || item.mo_ta.trim() === '') {
          errors.push(`Dòng ${index + 1}: Thành tích khoa học phải có mô tả`);
        }
      });
    }

    if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
      const allowedDanhHieu = [...DANH_HIEU_DON_VI_CO_BAN, ...DANH_HIEU_DON_VI_BANG_KHEN];
      for (const item of titleData) {
        if (!item.danh_hieu || !allowedDanhHieu.includes(item.danh_hieu)) {
          errors.push(
            `Danh hiệu đơn vị không hợp lệ: ${item.danh_hieu}. Chỉ chấp nhận: ${formatDanhHieuList(allowedDanhHieu)}`
          );
        }
      }
    }

    if (type === PROPOSAL_TYPES.CA_NHAN_HANG_NAM) {
      const allowedDanhHieu = Object.values(DANH_HIEU_CA_NHAN_HANG_NAM) as string[];
      for (const item of titleData) {
        if (!item.danh_hieu || !allowedDanhHieu.includes(item.danh_hieu)) {
          errors.push(
            `Danh hiệu không hợp lệ: ${item.danh_hieu}. Chỉ chấp nhận: ${formatDanhHieuList(allowedDanhHieu)}`
          );
        }
      }
    }

    if (errors.length > 0) {
      throwValidationErrors(errors, type, nam, adminId);
    }

    const personnelMap = new Map<string, QuanNhan>();
    if (
      type === PROPOSAL_TYPES.HC_QKQT ||
      type === PROPOSAL_TYPES.NIEN_HAN ||
      type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN
    ) {
      const personnelIds = titleData.map(item => item.personnel_id as string).filter(Boolean);
      const personnel = await quanNhanRepository.findManyByIds(personnelIds);
      for (const p of personnel) personnelMap.set(p.id, p);
    }

    const importedCountRef = { value: importedCount };
    const ctx: BulkCreateContext = {
      type,
      nam,
      thang,
      selectedPersonnel,
      titleData,
      ghiChu,
      adminId,
      personnelMap,
      errors,
      createdRecords,
      errorDetails,
      affectedPersonnelIds,
      affectedUnitIds,
      importedCount: importedCountRef,
      bypassEligibility,
    };

    // Award FK (so_quyet_dinh) rejects unknown decision numbers and aborts the batch,
    // so register every decision number before insert (no-op for existing ones).
    const decisionsToSync = new Set<string>();
    for (const item of titleData) {
      if (item.so_quyet_dinh) decisionsToSync.add(item.so_quyet_dinh);
    }
    if (decisionsToSync.size > 0) {
      const admin = (await accountRepository.findUniqueRaw({
        where: { id: adminId },
        include: { QuanNhan: { select: { ho_ten: true } } },
      })) as { username?: string; QuanNhan?: { ho_ten?: string | null } } | null;
      const nguoiKy = admin?.QuanNhan?.ho_ten || admin?.username || 'Chưa cập nhật';
      const ngayKy = new Date();
      for (const soQuyetDinh of decisionsToSync) {
        await decisionFileRepository.upsertRaw({
          where: { so_quyet_dinh: soQuyetDinh },
          create: {
            so_quyet_dinh: soQuyetDinh,
            nam,
            ngay_ky: ngayKy,
            nguoi_ky: nguoiKy,
            file_path: null,
            loai_khen_thuong: type,
            ghi_chu: 'Tự động đồng bộ từ thêm khen thưởng đồng loạt',
          },
          update: {},
        });
      }
    }

    const handler = CREATE_HANDLERS[type as ProposalType];
    if (!handler) {
      throw new ValidationError(
        `Loại khen thưởng "${type}" chưa được hỗ trợ trong chức năng thêm đồng loạt.`
      );
    }
    await handler(ctx);
    importedCount = importedCountRef.value;

    // Fire-and-forget — notification errors must not block the bulk-award response.
    void (async () => {
      try {
        const admin = await accountRepository.findUniqueRaw({
          where: { id: adminId },
          select: { username: true },
        });
        if (!admin) return;
        await notificationHelper.notifyOnBulkAwardAdded(
          Array.from(affectedPersonnelIds),
          selectedUnits || [],
          type,
          nam,
          titleData,
          admin.username
        );
        // SA bypass flow — also notify all ADMINs for forensic transparency
        if (bypassEligibility) {
          await notificationHelper.notifyAdminsOnBulkBypass(
            Array.from(affectedPersonnelIds),
            selectedUnits || [],
            type,
            nam,
            admin.username
          );
        }
      } catch (e) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: RESOURCE_SLUGS.AWARD_BULK,
          description: logMessages.notifyError('thêm', 'khen thưởng đồng loạt', e),
        });
      }
    })();

    const affectedCount = affectedPersonnelIds.size;
    const affectedUnitCount = type === PROPOSAL_TYPES.DON_VI_HANG_NAM ? affectedUnitIds.size : 0;
    const message = buildBulkAwardSummaryMessage({
      type,
      importedCount,
      errorCount: errors.length,
      affectedPersonnelCount: affectedCount,
      affectedUnitCount,
    });

    if (errors.length > 0) {
      void writeSystemLog({
        userId: adminId,
        userRole: ROLES.ADMIN,
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.AWARDS,
        description: `Thêm khen thưởng đồng loạt ${LOAI_DE_XUAT_MAP[type as keyof typeof LOAI_DE_XUAT_MAP] || type} năm ${nam}: ${importedCount} thành công, ${errors.length} lỗi. Chi tiết: ${errors.join('; ')}`,
      });
    }

    return {
      message,
      data: {
        importedCount,
        errorCount: errors.length,
        created: createdRecords.length > 0 ? createdRecords : undefined,
        errors: errorDetails.length > 0 ? errorDetails : undefined,
        affectedPersonnelIds: Array.from(affectedPersonnelIds),
      },
    };
  }
}

export default new AwardBulkService();
