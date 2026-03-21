const { prisma } = require('../../models');
const { NOTIFICATION_TYPES, RESOURCE_TYPES } = require('../../constants/notificationTypes');
const { ROLES } = require('../../constants/roles');
const { emitNotificationToUser } = require('../../utils/socketService');
const {
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
} = require('../../constants/danhHieu.constants');

// Helper function to format proposal type to Vietnamese
const formatProposalType = loaiDeXuat => {
  const prefix = 'Đề xuất khen thưởng ';
  const typeName = LOAI_DE_XUAT_MAP[loaiDeXuat];
  return typeName ? prefix + typeName.toLowerCase() : 'Đề xuất khen thưởng';
};

/**
 * Helper function để lấy tên hiển thị (ưu tiên ho_ten, nếu không có thì dùng username)
 * @param {string} username - Username của người dùng
 * @returns {Promise<string>} - Tên hiển thị (ho_ten hoặc username)
 */
async function getDisplayName(username) {
  try {
    const account = await prisma.taiKhoan.findUnique({
      where: { username },
      include: {
        QuanNhan: {
          select: {
            ho_ten: true,
          },
        },
      },
    });

    if (account?.QuanNhan?.ho_ten) {
      return account.QuanNhan.ho_ten;
    }

    return username;
  } catch (error) {
    return username;
  }
}

/**
 * Gửi thông báo hệ thống chung
 */
async function sendSystemNotification(
  recipients,
  type,
  title,
  message,
  resource = null,
  resourceId = null,
  link = null
) {
  try {
    const notifications = recipients.map(recipient => ({
      nguoi_nhan_id: recipient.id,
      recipient_role: recipient.role,
      type,
      title,
      message,
      resource,
      tai_nguyen_id: resourceId || null,
      link,
    }));

    if (notifications.length > 0) {
      await prisma.thongBao.createMany({
        data: notifications,
      });
      notifications.forEach(n => emitNotificationToUser(n.nguoi_nhan_id, n));
    }

    return notifications.length;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  prisma,
  NOTIFICATION_TYPES,
  RESOURCE_TYPES,
  ROLES,
  emitNotificationToUser,
  DANH_HIEU_MAP,
  LOAI_DE_XUAT_MAP,
  getDanhHieuName,
  formatProposalType,
  getDisplayName,
  sendSystemNotification,
};
