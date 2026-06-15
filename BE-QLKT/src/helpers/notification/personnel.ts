/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION BUILDER — QUÂN NHÂN (personnel)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Builder thông báo cho các thay đổi về quân nhân do Admin thực hiện:
 *  - notifyManagerOnPersonnelAdded : thêm quân nhân mới  → báo MANAGER đơn vị.
 *  - notifyOnPersonnelTransfer     : chuyển quân nhân sang đơn vị khác.
 *
 *  Điểm phức tạp nằm ở CHUYỂN ĐƠN VỊ — phải quy mọi đơn vị về CQDV (cấp mà
 *  MANAGER quản lý) rồi mới quyết định báo ai:
 *  - Cùng CQDV (chỉ đổi DVTT bên trong): chỉ báo MANAGER của CQDV đó 1 lần.
 *  - Khác CQDV: báo MANAGER đơn vị MỚI ("chuyển đến") và MANAGER đơn vị CŨ
 *    ("chuyển đi"), tránh báo trùng nếu một người quản cả hai.
 *  Ngoài MANAGER, luôn báo cho chính quân nhân (nếu có tài khoản).
 * ════════════════════════════════════════════════════════════════════════════
 */

import {
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  getDisplayName,
} from './helpers';
import { accountRepository } from '../../repositories/account.repository';
import { notificationRepository } from '../../repositories/notification.repository';
import { donViTrucThuocRepository } from '../../repositories/unit.repository';

interface PersonnelBasicInfo {
  id: string;
  ho_ten?: string | null;
  cccd?: string | null;
  don_vi_id?: string | null;
}

interface NotificationInput {
  nguoi_nhan_id: string;
  recipient_role: string;
  type: string;
  title: string;
  message: string;
  resource: string;
  tai_nguyen_id: string;
  link: string | null;
  [key: string]: unknown;
}

// Admin thêm quân nhân mới → báo MANAGER quản lý CQDV của quân nhân đó.
// personnel.don_vi_id ở đây mang nghĩa CQDV (cấp mà MANAGER phụ trách).
async function notifyManagerOnPersonnelAdded(
  personnel: PersonnelBasicInfo,
  adminUsername: string
): Promise<number> {
  const managers = await accountRepository.findManyRaw({
    where: {
      role: ROLES.MANAGER,
      QuanNhan: {
        co_quan_don_vi_id: personnel.don_vi_id,
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (managers.length === 0) {
    return 0;
  }

  const adminDisplayName = await getDisplayName(adminUsername);

  const notifications = managers.map(manager => ({
    nguoi_nhan_id: manager.id,
    recipient_role: manager.role,
    type: NOTIFICATION_TYPES.PERSONNEL_ADDED,
    title: 'Quân nhân mới được thêm',
    message: `${adminDisplayName} đã thêm quân nhân mới: ${personnel.ho_ten} (CCCD: ${personnel.cccd})`,
    resource: RESOURCE_TYPES.PERSONNEL,
    tai_nguyen_id: personnel.id,
    link: `/manager/personnel/${personnel.id}`,
  }));

  await notificationRepository.createMany(
    notifications
  );
  notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));

  return notifications.length;
}

interface UnitInfo {
  id: string;
  ten_don_vi: string;
  isCoQuanDonVi: boolean;
}

// Admin chuyển quân nhân giữa các đơn vị. So sánh CQDV cũ/mới để quyết định
// kịch bản thông báo, rồi luôn báo thêm cho chính quân nhân.
async function notifyOnPersonnelTransfer(
  personnel: PersonnelBasicInfo,
  oldUnit: UnitInfo | null,
  newUnit: UnitInfo | null,
  adminUsername: string
): Promise<number> {
  try {
    const notifications: NotificationInput[] = [];
    const adminDisplayName = await getDisplayName(adminUsername);

    // Quy mọi đơn vị (kể cả DVTT) về id của CQDV cha — vì MANAGER quản ở cấp
    // CQDV. Nếu đơn vị đã là CQDV thì dùng luôn id của nó.
    const getCoQuanDonViId = async (unitInfo: UnitInfo | null): Promise<string | null> => {
      if (!unitInfo || !unitInfo.id) return null;

      if (unitInfo.isCoQuanDonVi) {
        return unitInfo.id;
      }

      const donViTrucThuoc = await donViTrucThuocRepository.findCoQuanDonViIdById(unitInfo.id);
      return donViTrucThuoc?.co_quan_don_vi_id || null;
    };

    const oldCoQuanDonViId = await getCoQuanDonViId(oldUnit);
    const newCoQuanDonViId = await getCoQuanDonViId(newUnit);

    // Cùng CQDV nghĩa là chỉ đổi DVTT bên trong → MANAGER vẫn là người đó.
    const isSameCoQuanDonVi =
      oldCoQuanDonViId && newCoQuanDonViId && oldCoQuanDonViId === newCoQuanDonViId;

    if (isSameCoQuanDonVi) {
      // Chuyển nội bộ trong cùng CQDV: chỉ cần báo MANAGER của CQDV đó một lần.
      const managers = await accountRepository.findManyRaw({
        where: {
          role: ROLES.MANAGER,
          QuanNhan: {
            co_quan_don_vi_id: oldCoQuanDonViId,
          },
        },
        select: {
          id: true,
          role: true,
        },
      });

      managers.forEach(manager => {
        notifications.push({
          nguoi_nhan_id: manager.id,
          recipient_role: manager.role,
          type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
          title: 'Quân nhân chuyển đơn vị trực thuộc',
          message: `${adminDisplayName} đã chuyển quân nhân ${personnel.ho_ten || 'Chưa xác định'} từ ${oldUnit?.ten_don_vi || 'đơn vị cũ'} sang ${newUnit?.ten_don_vi || 'đơn vị mới'}`,
          resource: RESOURCE_TYPES.PERSONNEL,
          tai_nguyen_id: personnel.id,
          link: `/manager/personnel/${personnel.id}`,
        });
      });
    } else {
      // Khác CQDV: báo riêng MANAGER đơn vị mới ("chuyển đến") và đơn vị cũ
      // ("chuyển đi") với nội dung khác nhau.
      if (newCoQuanDonViId) {
        const newUnitManagers = await accountRepository.findManyRaw({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              co_quan_don_vi_id: newCoQuanDonViId,
            },
          },
          select: {
            id: true,
            role: true,
          },
        });

        newUnitManagers.forEach(manager => {
          notifications.push({
            nguoi_nhan_id: manager.id,
            recipient_role: manager.role,
            type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
            title: 'Quân nhân mới chuyển đến',
            message: `${adminDisplayName} đã chuyển quân nhân ${personnel.ho_ten || 'Chưa xác định'} đến đơn vị của bạn${newUnit && !newUnit.isCoQuanDonVi ? ` (${newUnit.ten_don_vi})` : ''}`,
            resource: RESOURCE_TYPES.PERSONNEL,
            tai_nguyen_id: personnel.id,
            link: `/manager/personnel/${personnel.id}`,
          });
        });
      }

      if (oldCoQuanDonViId) {
        const oldUnitManagers = await accountRepository.findManyRaw({
          where: {
            role: ROLES.MANAGER,
            QuanNhan: {
              co_quan_don_vi_id: oldCoQuanDonViId,
            },
          },
          select: {
            id: true,
            role: true,
          },
        });

        oldUnitManagers.forEach(manager => {
          // Một MANAGER có thể quản cả CQDV cũ lẫn mới → tránh báo trùng:
          // nếu đã được báo ở nhánh "chuyển đến" thì không báo lại "chuyển đi".
          const alreadyNotified = notifications.some(
            (n: NotificationInput) => n.nguoi_nhan_id === manager.id
          );
          if (!alreadyNotified) {
            notifications.push({
              nguoi_nhan_id: manager.id,
              recipient_role: manager.role,
              type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
              title: 'Quân nhân đã chuyển đi',
              message: `Quân nhân ${personnel.ho_ten || 'Chưa xác định'} đã được ${adminDisplayName} chuyển sang đơn vị khác`,
              resource: RESOURCE_TYPES.PERSONNEL,
              tai_nguyen_id: personnel.id,
              link: null,
            });
          }
        });
      }
    }

    // Luôn báo cho chính quân nhân (nếu có tài khoản), bất kể cùng hay khác
    // CQDV — đây là người trực tiếp bị ảnh hưởng bởi việc chuyển đơn vị.
    const personnelAccount = await accountRepository.findFirstRaw({
      where: {
        quan_nhan_id: personnel.id,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (personnelAccount) {
      notifications.push({
        nguoi_nhan_id: personnelAccount.id,
        recipient_role: personnelAccount.role,
        type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
        title: 'Bạn đã được chuyển đơn vị',
        message: `${adminDisplayName} đã chuyển bạn từ đơn vị ${oldUnit?.ten_don_vi || 'cũ'} sang đơn vị ${newUnit?.ten_don_vi || 'mới'}`,
        resource: RESOURCE_TYPES.PERSONNEL,
        tai_nguyen_id: personnel.id,
        link: personnelAccount.role === ROLES.MANAGER ? '/manager/dashboard' : '/user/dashboard',
      });
    }

    if (notifications.length > 0) {
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationPersonnel.notifyOnPersonnelTransfer failed', { error });
    return 0;
  }
}

export { notifyManagerOnPersonnelAdded, notifyOnPersonnelTransfer };
