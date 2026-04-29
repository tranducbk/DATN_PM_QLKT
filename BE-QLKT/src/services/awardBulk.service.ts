import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { accountRepository } from '../repositories/account.repository';
import * as notificationHelper from '../helpers/notification';
import { writeSystemLog } from '../helpers/systemLogHelper';
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
import { AppError, ValidationError } from '../middlewares/errorHandler';
import type { QuanNhan } from '../generated/prisma';
import { TYPES_WITH_PERSONNEL_DUP } from './awardBulk/dispatchTables';
import {
  checkDuplicateAwards,
  checkDuplicateUnitAwards,
  validatePersonnelConditions,
  throwValidationErrors,
} from './awardBulk/validation';
import { CREATE_HANDLERS, calculateThoiGian } from './awardBulk/handlers';
import type {
  BulkCreateAwardsParams,
  BulkCreateContext,
  TitleDataItem,
} from './awardBulk/types';

export type { TitleDataItem } from './awardBulk/types';

class AwardBulkService {
  checkDuplicateAwards = checkDuplicateAwards;
  checkDuplicateUnitAwards = checkDuplicateUnitAwards;
  validatePersonnelConditions = validatePersonnelConditions;
  calculateThoiGian = calculateThoiGian;

  async bulkCreateAwards({
    type,
    nam,
    thang,
    selectedPersonnel,
    selectedUnits,
    titleData,
    ghiChu,
    adminId,
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
    if (typesNeedingPersonnelValidation.includes(type as ProposalType)) {
      const validationErrors = await this.validatePersonnelConditions(type, selectedPersonnel);
      errors.push(...validationErrors);
    }

    if (type === PROPOSAL_TYPES.NCKH) {
      const validNCKHCodes = Object.keys(DANH_HIEU_NCKH);
      for (const item of titleData) {
        if (!item.loai || !validNCKHCodes.includes(item.loai)) {
          errors.push(
            `Thành tích khoa học phải có loại hợp lệ: ${validNCKHCodes.join(', ')} (quân nhân: ${item.personnel_id})`
          );
        }
        if (!item.mo_ta || item.mo_ta.trim() === '') {
          errors.push(`Thành tích khoa học phải có mô tả (quân nhân: ${item.personnel_id})`);
        }
      }
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
    };

    const handler = CREATE_HANDLERS[type as ProposalType];
    if (!handler) {
      throw new ValidationError(
        `Loại khen thưởng "${type}" chưa được hỗ trợ trong chức năng thêm đồng loạt.`
      );
    }
    await handler(ctx);
    importedCount = importedCountRef.value;

    try {
      const admin = await accountRepository.findUniqueRaw({
        where: { id: adminId },
        select: { username: true },
      });

      if (admin) {
        await notificationHelper.notifyOnBulkAwardAdded(
          Array.from(affectedPersonnelIds),
          selectedUnits || [],
          type,
          nam,
          titleData,
          admin.username
        );
      }
    } catch (e) {
      void writeSystemLog({
        action: 'ERROR',
        resource: 'award-bulk',
        description: `Lỗi gửi thông báo thêm khen thưởng đồng loạt: ${e}`,
      });
    }

    const affectedCount = affectedPersonnelIds.size;
    const affectedUnitCount =
      type === PROPOSAL_TYPES.DON_VI_HANG_NAM ? affectedUnitIds.size : 0;
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
        action: 'ERROR',
        resource: 'awards',
        description: `[Thêm khen thưởng đồng loạt] ${LOAI_DE_XUAT_MAP[type as keyof typeof LOAI_DE_XUAT_MAP] || type} năm ${nam}: ${importedCount} thành công, ${errors.length} lỗi. Chi tiết: ${errors.join('; ')}`,
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
