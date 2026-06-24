import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { positionRepository } from '../../repositories/position.repository';
import { rotatePositionHistory } from './positionHistory';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { ROLES } from '../../constants/roles.constants';
import { RESOURCE_SLUGS } from '../../constants/resourceSlugs.constants';
import { GENDER } from '../../constants/gender.constants';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import profileService from '../profile.service';
import * as notificationHelper from '../../helpers/notification';
import { writeSystemLog } from '../../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../constants/auditActions.constants';
import { logMessages } from '../../constants/logMessages.constants';
import { adjustUnitCount } from './unitCount';
import { diffPersonnelChanges } from '../../helpers/profileFieldDiff';

type DateInput = Date | null;

export interface UpdatePersonnelInput {
  unit_id?: string;
  position_id?: string;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
  ho_ten?: string;
  gioi_tinh?: string | null;
  ngay_sinh?: DateInput;
  cccd?: string;
  cap_bac?: string | null;
  ngay_nhap_ngu?: DateInput;
  ngay_xuat_ngu?: DateInput;
  que_quan_2_cap?: string | null;
  que_quan_3_cap?: string | null;
  tru_quan?: string | null;
  cho_o_hien_nay?: string | null;
  ngay_vao_dang?: DateInput;
  ngay_vao_dang_chinh_thuc?: DateInput;
  so_the_dang_vien?: string | null;
  so_dien_thoai?: string | null;
}

/**
 * Updates personnel data, including unit and position reassignment.
 * @param id - Personnel ID to update
 * @param data - Fields to update
 * @param userRole - Role of the requesting user
 * @param userQuanNhanId - QuanNhan ID of the requesting user
 * @param adminUsername - Username for transfer notification
 * @returns Updated personnel record with optional unit transfer info
 */
export async function updatePersonnel(
  id: string,
  data: UpdatePersonnelInput,
  userRole: string,
  userQuanNhanId: string,
  adminUsername: string
) {
  const {
    unit_id,
    position_id,
    co_quan_don_vi_id,
    don_vi_truc_thuoc_id,
    ho_ten,
    gioi_tinh,
    ngay_sinh,
    cccd,
    cap_bac,
    ngay_nhap_ngu,
    ngay_xuat_ngu,
    que_quan_2_cap,
    que_quan_3_cap,
    tru_quan,
    cho_o_hien_nay,
    ngay_vao_dang,
    ngay_vao_dang_chinh_thuc,
    so_the_dang_vien,
    so_dien_thoai,
  } = data;
  const unitId = unit_id;
  const positionId = position_id;
  const coQuanDonViId = co_quan_don_vi_id ?? undefined;
  const donViTrucThuocId = don_vi_truc_thuoc_id ?? undefined;
  const cccdValue = cccd;

  const personnel = await quanNhanRepository.findByIdWithAccountRole(String(id));

  if (!personnel) {
    throw new NotFoundError('Quân nhân');
  }

  if (userRole === ROLES.MANAGER && userQuanNhanId !== id) {
    const targetRole = personnel.TaiKhoan?.role;
    if (targetRole === ROLES.MANAGER) {
      throw new ForbiddenError('Bạn không có quyền sửa thông tin của quản lý khác');
    }
  }

  // USER can only edit their own profile.
  if (userRole === ROLES.USER) {
    if (userQuanNhanId !== id) {
      throw new ForbiddenError('Bạn không có quyền sửa thông tin của người khác');
    }

    // USER cannot change unit_id or position_id.
    if (unitId || positionId) {
      throw new ForbiddenError('Bạn không có quyền thay đổi đơn vị hoặc chức vụ');
    }
  }

  // MANAGER can only edit personnel in their unit scope.
  if (userRole === ROLES.MANAGER && userQuanNhanId) {
    const manager = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (manager) {
      let hasPermission = false;

      // Case 1: manager belongs to a parent unit.
      if (manager.co_quan_don_vi_id && !manager.don_vi_truc_thuoc_id) {
        if (personnel.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
          hasPermission = true;
        } else if (personnel.don_vi_truc_thuoc_id) {
          const donViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(
            personnel.don_vi_truc_thuoc_id
          );
          if (donViTrucThuoc && donViTrucThuoc.co_quan_don_vi_id === manager.co_quan_don_vi_id) {
            hasPermission = true;
          }
        }
      }
      // Case 2: manager belongs to a child unit.
      else if (manager.don_vi_truc_thuoc_id) {
        if (personnel.don_vi_truc_thuoc_id === manager.don_vi_truc_thuoc_id) {
          hasPermission = true;
        } else if (personnel.co_quan_don_vi_id) {
          const managerDonViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(
            manager.don_vi_truc_thuoc_id
          );
          if (
            managerDonViTrucThuoc &&
            personnel.co_quan_don_vi_id === managerDonViTrucThuoc.co_quan_don_vi_id
          ) {
            hasPermission = true;
          }
        }
      }

      if (!hasPermission) {
        throw new ForbiddenError('Bạn không có quyền sửa thông tin quân nhân ngoài đơn vị');
      }
    }
  }

  // Re-check CCCD uniqueness when changed.
  if (cccdValue && cccdValue !== personnel.cccd) {
    const existingPersonnel = await quanNhanRepository.findIdByCccd(cccdValue);

    if (existingPersonnel) {
      throw new ValidationError('CCCD đã tồn tại trong hệ thống');
    }
  }

  const currentUnitId = personnel.don_vi_truc_thuoc_id || personnel.co_quan_don_vi_id;
  if (unitId && unitId !== currentUnitId) {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findIdById(unitId),
      donViTrucThuocRepository.findIdById(unitId),
    ]);

    if (!coQuanDonVi && !donViTrucThuoc) {
      throw new NotFoundError('Đơn vị');
    }
  }

  if (positionId && positionId !== personnel.chuc_vu_id) {
    const position = await positionRepository.findUniqueRaw({
      where: { id: positionId },
      select: { id: true },
    });

    if (!position) {
      throw new NotFoundError('Chức vụ');
    }
  }

  // Gender is required on update.
  if (gioi_tinh !== undefined) {
    if (!gioi_tinh || (gioi_tinh !== GENDER.MALE && gioi_tinh !== GENDER.FEMALE)) {
      throw new ValidationError('Giới tính là bắt buộc và phải là NAM hoặc NU');
    }
  } else if (!personnel.gioi_tinh) {
    throw new ValidationError('Giới tính là bắt buộc. Vui lòng cập nhật thông tin giới tính.');
  }

  // Prepare update payload — only include fields that were explicitly provided.
  const updateData: Prisma.QuanNhanUncheckedUpdateInput = {
    ...(ho_ten !== undefined && { ho_ten }),
    ...(gioi_tinh !== undefined && { gioi_tinh }),
    ...(ngay_sinh !== undefined && { ngay_sinh }),
    ...(cccd !== undefined && { cccd: cccdValue }),
    ...(cap_bac !== undefined && { cap_bac }),
    ...(ngay_nhap_ngu !== undefined && { ngay_nhap_ngu }),
    ...(ngay_xuat_ngu !== undefined && { ngay_xuat_ngu }),
    ...(que_quan_2_cap !== undefined && { que_quan_2_cap }),
    ...(que_quan_3_cap !== undefined && { que_quan_3_cap }),
    ...(tru_quan !== undefined && { tru_quan }),
    ...(cho_o_hien_nay !== undefined && { cho_o_hien_nay }),
    ...(ngay_vao_dang !== undefined && { ngay_vao_dang }),
    ...(ngay_vao_dang_chinh_thuc !== undefined && { ngay_vao_dang_chinh_thuc }),
    ...(so_the_dang_vien !== undefined && { so_the_dang_vien }),
    ...(so_dien_thoai !== undefined && { so_dien_thoai }),
    chuc_vu_id: positionId || personnel.chuc_vu_id,
  };

  // Unit assignment priority: explicit ids from frontend first.
  if (co_quan_don_vi_id !== undefined || don_vi_truc_thuoc_id !== undefined) {
    // Auto-fill parent unit when child unit is provided.
    if (donViTrucThuocId) {
      const donViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(donViTrucThuocId);

      if (donViTrucThuoc) {
        updateData.co_quan_don_vi_id = donViTrucThuoc.co_quan_don_vi_id;
        updateData.don_vi_truc_thuoc_id = donViTrucThuocId;
      } else {
        throw new NotFoundError('Đơn vị trực thuộc');
      }
    } else if (coQuanDonViId) {
      updateData.co_quan_don_vi_id = coQuanDonViId;
      updateData.don_vi_truc_thuoc_id = null;
    } else {
      updateData.co_quan_don_vi_id =
        coQuanDonViId !== undefined ? coQuanDonViId : personnel.co_quan_don_vi_id;
      updateData.don_vi_truc_thuoc_id = null;
    }
  } else if (unitId && unitId !== currentUnitId) {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      coQuanDonViRepository.findById(unitId),
      donViTrucThuocRepository.findIdAndParentById(unitId),
    ]);

    if (coQuanDonVi) {
      updateData.co_quan_don_vi_id = unitId;
      updateData.don_vi_truc_thuoc_id = null;
    } else if (donViTrucThuoc) {
      updateData.co_quan_don_vi_id = donViTrucThuoc.co_quan_don_vi_id;
      updateData.don_vi_truc_thuoc_id = unitId;
    }
  } else {
    // Keep current unit mapping.
    updateData.co_quan_don_vi_id = personnel.co_quan_don_vi_id;
    updateData.don_vi_truc_thuoc_id = personnel.don_vi_truc_thuoc_id;
  }

  // A MANAGER must stay at CQDV level: a DVTT would set both unit fields and collapse its
  // proposal scope onto the parent CQDV (it would see sibling units). Demote to USER first.
  if (personnel.TaiKhoan?.role === ROLES.MANAGER && updateData.don_vi_truc_thuoc_id) {
    throw new ValidationError(
      'Tài khoản chỉ huy chỉ được ở cấp Cơ quan đơn vị. Vui lòng hạ quyền xuống Người dùng trước khi chuyển vào Đơn vị trực thuộc.'
    );
  }

  // Only ADMIN/SUPER_ADMIN may transfer a personnel to another unit or change their current position;
  // MANAGER edits other info within their own unit only.
  if (userRole === ROLES.MANAGER) {
    const coQuanChanged =
      updateData.co_quan_don_vi_id !== undefined &&
      updateData.co_quan_don_vi_id !== personnel.co_quan_don_vi_id;
    const donViChanged =
      updateData.don_vi_truc_thuoc_id !== undefined &&
      updateData.don_vi_truc_thuoc_id !== personnel.don_vi_truc_thuoc_id;
    if (coQuanChanged || donViChanged) {
      throw new ForbiddenError('Chỉ Phòng chính trị mới được chuyển đơn vị của quân nhân');
    }
    if (positionId !== undefined && positionId !== personnel.chuc_vu_id) {
      throw new ForbiddenError('Chỉ Phòng chính trị mới được thay đổi chức vụ của quân nhân');
    }
  }

  // Use transaction to keep all writes consistent.
  const { updatedPersonnel, unitTransferInfo } = await prisma.$transaction(async prismaTx => {
    const txUpdatedPersonnel = await quanNhanRepository.update(String(id), updateData, prismaTx);

    // If position changed, close old history and open a new one.
    if (positionId && positionId !== personnel.chuc_vu_id) {
      await rotatePositionHistory(prismaTx, id, positionId, new Date());
    }

    let txUnitTransferInfo = null;

    const oldCoQuanDonViId = personnel.co_quan_don_vi_id;
    const oldDonViTrucThuocId = personnel.don_vi_truc_thuoc_id;
    const newCoQuanDonViId = updateData.co_quan_don_vi_id as string | null | undefined;
    const newDonViTrucThuocId = updateData.don_vi_truc_thuoc_id as string | null | undefined;

    const coQuanDonViChanged = oldCoQuanDonViId !== newCoQuanDonViId;
    const donViTrucThuocChanged = oldDonViTrucThuocId !== newDonViTrucThuocId;
    const unitChanged = coQuanDonViChanged || donViTrucThuocChanged;

    if (unitChanged) {
      let oldUnitInfo = null;
      let newUnitInfo = null;

      // DVTT takes priority over CQDV when determining effective unit
      const oldPrimaryUnitId = oldDonViTrucThuocId || oldCoQuanDonViId;
      const oldIsCqdv = !oldDonViTrucThuocId && !!oldCoQuanDonViId;
      if (oldPrimaryUnitId) {
        const oldUnit = oldIsCqdv
          ? await coQuanDonViRepository.findNameById(oldPrimaryUnitId, prismaTx)
          : await donViTrucThuocRepository.findNameById(oldPrimaryUnitId, prismaTx);
        if (oldUnit) {
          oldUnitInfo = {
            id: oldUnit.id,
            ten_don_vi: oldUnit.ten_don_vi,
            isCoQuanDonVi: oldIsCqdv,
          };
          await adjustUnitCount(prismaTx, oldPrimaryUnitId, oldIsCqdv, 'decrement');
        }
      }

      const newPrimaryUnitId = newDonViTrucThuocId || newCoQuanDonViId;
      const newIsCqdv = !newDonViTrucThuocId && !!newCoQuanDonViId;
      if (newPrimaryUnitId) {
        const newUnit = newIsCqdv
          ? await coQuanDonViRepository.findNameById(newPrimaryUnitId, prismaTx)
          : await donViTrucThuocRepository.findNameById(newPrimaryUnitId, prismaTx);
        if (newUnit) {
          newUnitInfo = {
            id: newUnit.id,
            ten_don_vi: newUnit.ten_don_vi,
            isCoQuanDonVi: newIsCqdv,
          };
          await adjustUnitCount(prismaTx, newPrimaryUnitId, newIsCqdv, 'increment');
        }
      }

      // Keep transfer info for response and notification.
      if (oldUnitInfo || newUnitInfo) {
        txUnitTransferInfo = {
          oldUnit: oldUnitInfo,
          newUnit: newUnitInfo,
        };
      }
    }

    return { updatedPersonnel: txUpdatedPersonnel, unitTransferInfo: txUnitTransferInfo };
  });

  // Recalculate profile outside transaction.
  try {
    await profileService.recalculateAnnualProfile(id);
  } catch (recalcError) {
    void writeSystemLog({
      action: AUDIT_ACTIONS.ERROR,
      resource: RESOURCE_SLUGS.PERSONNEL,
      description: logMessages.recalcPersonnelError(id, recalcError),
    });
  }

  // Send transfer notification outside transaction.
  if (unitTransferInfo && adminUsername) {
    try {
      await notificationHelper.notifyOnPersonnelTransfer(
        updatedPersonnel,
        unitTransferInfo.oldUnit,
        unitTransferInfo.newUnit,
        adminUsername
      );
    } catch (notifError) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.PERSONNEL,
        description: logMessages.notifyError('chuyển đơn vị', `quân nhân ${id}`, notifError),
      });
    }
  }

  const changes = diffPersonnelChanges(personnel, data);

  return {
    ...updatedPersonnel,
    unitTransferInfo,
    changes,
  };
}
