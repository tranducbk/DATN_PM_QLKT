import {
  prisma,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  getDisplayName,
} from './helpers';

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

async function notifyManagerOnPersonnelAdded(
  personnel: PersonnelBasicInfo,
  adminUsername: string
): Promise<number> {
  try {
    const managers = await prisma.taiKhoan.findMany({
      where: {
        role: 'MANAGER',
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

    await prisma.thongBao.createMany({
      data: notifications,
    });
    notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));

    return notifications.length;
  } catch (error) {
    throw error;
  }
}

interface UnitInfo {
  id: string;
  ten_don_vi: string;
  isCoQuanDonVi: boolean;
}

async function notifyOnPersonnelTransfer(
  personnel: PersonnelBasicInfo,
  oldUnit: UnitInfo | null,
  newUnit: UnitInfo | null,
  adminUsername: string
): Promise<number> {
  try {
    const notifications: NotificationInput[] = [];
    const adminDisplayName = await getDisplayName(adminUsername);

    const getCoQuanDonViId = async (unitInfo: UnitInfo | null): Promise<string | null> => {
      if (!unitInfo || !unitInfo.id) return null;

      if (unitInfo.isCoQuanDonVi) {
        return unitInfo.id;
      }

      const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
        where: { id: unitInfo.id },
        select: { co_quan_don_vi_id: true },
      });
      return donViTrucThuoc?.co_quan_don_vi_id || null;
    };

    const oldCoQuanDonViId = await getCoQuanDonViId(oldUnit);
    const newCoQuanDonViId = await getCoQuanDonViId(newUnit);

    const isSameCoQuanDonVi =
      oldCoQuanDonViId && newCoQuanDonViId && oldCoQuanDonViId === newCoQuanDonViId;

    if (isSameCoQuanDonVi) {
      const managers = await prisma.taiKhoan.findMany({
        where: {
          role: 'MANAGER',
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
      if (newCoQuanDonViId) {
        const newUnitManagers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
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
        const oldUnitManagers = await prisma.taiKhoan.findMany({
          where: {
            role: 'MANAGER',
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

    const personnelAccount = await prisma.taiKhoan.findFirst({
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
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    return 0;
  }
}

export { notifyManagerOnPersonnelAdded, notifyOnPersonnelTransfer };
