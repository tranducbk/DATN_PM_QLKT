/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION BUILDER — QUÂN NHÂN (personnel)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Builder thông báo cho các thay đổi về quân nhân:
 *  - notifyOnPersonnelTransfer  : Admin chuyển quân nhân sang đơn vị khác.
 *  - notifyOnPersonnelDeleted   : Admin xóa quân nhân → báo MANAGER đơn vị.
 *  - notifyOnSelfProfileUpdate  : quân nhân tự sửa hồ sơ → báo Admin + MANAGER.
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
import { NOTIFICATION_TITLES } from '../../constants/notificationMessages.constants';
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

    // Quy đơn vị cũ và mới về CQDV cha để so sánh có cùng cấp quản lý không.
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
          title: NOTIFICATION_TITLES.PERSONNEL_TRANSFERRED_SUBUNIT,
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
        // MANAGER của CQDV mới — báo "có quân nhân chuyển đến".
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
            title: NOTIFICATION_TITLES.PERSONNEL_TRANSFERRED_IN,
            message: `${adminDisplayName} đã chuyển quân nhân ${personnel.ho_ten || 'Chưa xác định'} đến đơn vị của bạn${newUnit && !newUnit.isCoQuanDonVi ? ` (${newUnit.ten_don_vi})` : ''}`,
            resource: RESOURCE_TYPES.PERSONNEL,
            tai_nguyen_id: personnel.id,
            link: `/manager/personnel/${personnel.id}`,
          });
        });
      }

      if (oldCoQuanDonViId) {
        // MANAGER của CQDV cũ — báo "quân nhân đã chuyển đi".
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
              title: NOTIFICATION_TITLES.PERSONNEL_TRANSFERRED_OUT,
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
        title: NOTIFICATION_TITLES.PERSONNEL_SELF_TRANSFERRED,
        message: `${adminDisplayName} đã chuyển bạn từ đơn vị ${oldUnit?.ten_don_vi || 'cũ'} sang đơn vị ${newUnit?.ten_don_vi || 'mới'}`,
        resource: RESOURCE_TYPES.PERSONNEL,
        tai_nguyen_id: personnel.id,
        link: personnelAccount.role === ROLES.MANAGER ? '/manager/dashboard' : '/user/dashboard',
      });
    }

    if (notifications.length > 0) {
      // Ghi cả lô vào DB rồi đẩy socket real-time ('new_notification') cho từng người.
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationPersonnel.notifyOnPersonnelTransfer failed', { error });
    return 0;
  }
}

interface DeletedPersonnelInfo {
  id: string;
  ho_ten?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}

/**
 * Notifies the managers of a deleted personnel's unit. The personnel's own account
 * is gone (cascade), so only unit managers are notified.
 * @param personnel - Snapshot captured before deletion (id, name, unit ids)
 * @param adminUsername - Username of the admin who performed the deletion
 * @returns Number of notifications created
 */
async function notifyOnPersonnelDeleted(
  personnel: DeletedPersonnelInfo,
  adminUsername: string
): Promise<number> {
  try {
    // Xác định đơn vị của quân nhân: CQDV trước, DVTT sau (CQDV là cấp cha).
    const donViId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
    if (!donViId) return 0;

    const adminDisplayName = await getDisplayName(adminUsername);
    // Tìm MANAGER quản đơn vị (CQDV hoặc DVTT) của quân nhân vừa bị xóa.
    const managers = await accountRepository.findManyRaw({
      where: {
        role: ROLES.MANAGER,
        QuanNhan: {
          OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
        },
      },
      select: { id: true, role: true },
    });

    // Mỗi MANAGER 1 thông báo; link = null vì hồ sơ đã bị xóa, không còn trang để mở.
    const notifications: NotificationInput[] = managers.map(manager => ({
      nguoi_nhan_id: manager.id,
      recipient_role: manager.role,
      type: NOTIFICATION_TYPES.PERSONNEL_DELETED,
      title: NOTIFICATION_TITLES.PERSONNEL_DELETED,
      message: `${adminDisplayName} đã xóa quân nhân ${
        personnel.ho_ten || 'Chưa xác định'
      } cùng toàn bộ dữ liệu khen thưởng khỏi hệ thống`,
      resource: RESOURCE_TYPES.PERSONNEL,
      tai_nguyen_id: personnel.id,
      link: null,
    }));

    if (notifications.length > 0) {
      // Ghi cả lô vào DB rồi đẩy socket real-time ('new_notification') cho từng người.
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationPersonnel.notifyOnPersonnelDeleted failed', { error });
    return 0;
  }
}

interface SelfUpdateInfo {
  id: string;
  ho_ten?: string | null;
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}

/**
 * Notifies all admins and the managers of the personnel's unit when a soldier
 * edits their own profile.
 * @param personnel - The personnel who updated their own profile
 * @returns Number of notifications created
 */
async function notifyOnSelfProfileUpdate(
  personnel: SelfUpdateInfo,
  changedFields: string[] = []
): Promise<number> {
  try {
    // Tên hiển thị, fallback khi thiếu ho_ten (không lộ id kỹ thuật cho người dùng).
    const name = personnel.ho_ten || 'Một quân nhân';
    // Liệt kê các trường vừa đổi (nếu có) để chèn thêm vào câu thông báo.
    const detail = changedFields.length > 0 ? `: ${changedFields.join(', ')}` : '';

    // Quy về CQDV cha khi quân nhân chỉ có DVTT — MANAGER quản ở cấp CQDV.
    let coQuanDonViId = personnel.co_quan_don_vi_id || null;
    if (!coQuanDonViId && personnel.don_vi_truc_thuoc_id) {
      const dvtt = await donViTrucThuocRepository.findCoQuanDonViIdById(
        personnel.don_vi_truc_thuoc_id
      );
      coQuanDonViId = dvtt?.co_quan_don_vi_id || null;
    }

    // Người nhận = toàn bộ Admin + MANAGER của CQDV quân nhân (nếu xác định được).
    const recipients = await accountRepository.findManyRaw({
      where: {
        OR: [
          { role: ROLES.ADMIN },
          // Thêm điều kiện MANAGER của CQDV nếu xác định được; nếu không thì spread mảng rỗng.
          ...(coQuanDonViId
            ? [{ role: ROLES.MANAGER, QuanNhan: { co_quan_don_vi_id: coQuanDonViId } }]
            : []),
        ],
      },
      select: { id: true, role: true },
    });

    const notifications: NotificationInput[] = recipients.map(recipient => ({
      nguoi_nhan_id: recipient.id,
      recipient_role: recipient.role,
      type: NOTIFICATION_TYPES.PERSONNEL_UPDATED,
      title: NOTIFICATION_TITLES.PERSONNEL_SELF_UPDATED,
      message: `Quân nhân ${name} đã cập nhật thông tin cá nhân${detail}`,
      resource: RESOURCE_TYPES.PERSONNEL,
      tai_nguyen_id: personnel.id,
      // Link tới trang hồ sơ theo vai trò người nhận: admin vs manager.
      link:
        recipient.role === ROLES.ADMIN
          ? `/admin/personnel/${personnel.id}`
          : `/manager/personnel/${personnel.id}`,
    }));

    if (notifications.length > 0) {
      // Ghi cả lô vào DB rồi đẩy socket real-time ('new_notification') cho từng người.
      await notificationRepository.createMany(notifications);
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    console.error('NotificationPersonnel.notifyOnSelfProfileUpdate failed', { error });
    return 0;
  }
}

export { notifyOnPersonnelTransfer, notifyOnPersonnelDeleted, notifyOnSelfProfileUpdate };
