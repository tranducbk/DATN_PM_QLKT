const {
  prisma,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  getDisplayName,
} = require('./helpers');

/**
 * Gửi thông báo khi có quân nhân mới được thêm vào
 * -> MANAGER của đơn vị nhận thông báo
 */
async function notifyManagerOnPersonnelAdded(personnel, adminUsername) {
  try {
    // Lấy tất cả MANAGER của đơn vị
    const managers = await prisma.taiKhoan.findMany({
      where: {
        role: 'MANAGER',
        QuanNhan: {
          don_vi_id: personnel.don_vi_id,
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

    // Tạo thông báo cho từng manager
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

/**
 * Gửi thông báo khi quân nhân chuyển đơn vị
 * -> Manager đơn vị mới nhận thông báo "Quân nhân [Tên] đã được chuyển đến đơn vị của bạn"
 * -> Manager đơn vị cũ nhận thông báo "Quân nhân [Tên] đã chuyển đi khỏi đơn vị"
 * -> Quân nhân (nếu có tài khoản) nhận thông báo "Bạn đã được chuyển sang đơn vị [Tên đơn vị]"
 * @param {Object} personnel - Thông tin quân nhân
 * @param {Object} oldUnit - Thông tin đơn vị cũ { id, ten_don_vi, isCoQuanDonVi }
 * @param {Object} newUnit - Thông tin đơn vị mới { id, ten_don_vi, isCoQuanDonVi }
 * @param {string} adminUsername - Username của admin thực hiện chuyển đơn vị
 */
async function notifyOnPersonnelTransfer(personnel, oldUnit, newUnit, adminUsername) {
  try {
    const notifications = [];
    const adminDisplayName = await getDisplayName(adminUsername);

    // Helper function để lấy co_quan_don_vi_id từ unit info
    const getCoQuanDonViId = async unitInfo => {
      if (!unitInfo || !unitInfo.id) return null;

      if (unitInfo.isCoQuanDonVi) {
        return unitInfo.id;
      }

      // Nếu là đơn vị trực thuộc, lấy co_quan_don_vi_id từ đơn vị cha
      const donViTrucThuoc = await prisma.donViTrucThuoc.findUnique({
        where: { id: unitInfo.id },
        select: { co_quan_don_vi_id: true },
      });
      return donViTrucThuoc?.co_quan_don_vi_id || null;
    };

    // Lấy co_quan_don_vi_id của cả 2 đơn vị
    const oldCoQuanDonViId = await getCoQuanDonViId(oldUnit);
    const newCoQuanDonViId = await getCoQuanDonViId(newUnit);

    // Kiểm tra xem có phải chuyển trong cùng cơ quan đơn vị không
    const isSameCoQuanDonVi =
      oldCoQuanDonViId && newCoQuanDonViId && oldCoQuanDonViId === newCoQuanDonViId;

    if (isSameCoQuanDonVi) {
      // Trường hợp: Chuyển giữa các đơn vị trực thuộc trong cùng cơ quan đơn vị
      // Chỉ gửi thông báo cho Manager của cơ quan đơn vị cha
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
      // Trường hợp: Chuyển giữa các cơ quan đơn vị khác nhau

      // 1. Thông báo cho Manager đơn vị MỚI
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

      // 2. Thông báo cho Manager đơn vị CŨ
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
          // Tránh trùng lặp nếu manager thuộc cả 2 đơn vị (trường hợp hiếm)
          const alreadyNotified = notifications.some(n => n.nguoi_nhan_id === manager.id);
          if (!alreadyNotified) {
            notifications.push({
              nguoi_nhan_id: manager.id,
              recipient_role: manager.role,
              type: NOTIFICATION_TYPES.PERSONNEL_TRANSFERRED,
              title: 'Quân nhân đã chuyển đi',
              message: `Quân nhân ${personnel.ho_ten || 'Chưa xác định'} đã được ${adminDisplayName} chuyển sang đơn vị khác`,
              resource: RESOURCE_TYPES.PERSONNEL,
              tai_nguyen_id: personnel.id,
              link: null, // Không có link vì quân nhân đã rời đơn vị
            });
          }
        });
      }
    }

    // 3. Thông báo cho chính quân nhân (nếu có tài khoản)
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

    // Tạo thông báo
    if (notifications.length > 0) {
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    // Không throw error để không ảnh hưởng đến quá trình chuyển đơn vị
    return 0;
  }
}

module.exports = {
  notifyManagerOnPersonnelAdded,
  notifyOnPersonnelTransfer,
};
