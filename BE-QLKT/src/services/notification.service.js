const { prisma } = require('../models');
const { emitNotificationToUser } = require('../utils/socketService');

class NotificationService {
  /**
   * Tạo thông báo mới
   */
  async createNotification(data) {
    const {
      recipient_id,
      recipient_role,
      type,
      title,
      message,
      resource,
      resource_id,
      link,
      system_log_id,
    } = data;

    const notification = await prisma.thongBao.create({
      data: {
        nguoi_nhan_id: recipient_id,
        recipient_role,
        type,
        title,
        message,
        resource,
        tai_nguyen_id: resource_id || null,
        link,
        nhat_ky_he_thong_id: system_log_id,
      },
    });

    // Push real-time đến user nếu đang online
    if (recipient_id) {
      emitNotificationToUser(recipient_id, notification);
    }

    return notification;
  }

  /**
   * Tạo thông báo cho nhiều người dùng
   */
  async createBulkNotifications(notifications) {
    const result = await prisma.thongBao.createMany({
      data: notifications,
    });

    return result;
  }

  /**
   * Lấy danh sách thông báo của user
   */
  async getNotificationsByUserId(userId, filters = {}) {
    const { page = 1, limit = 20, isRead, type } = filters;
    const skip = (page - 1) * limit;

    const where = {
      nguoi_nhan_id: userId,
    };

    if (isRead !== undefined) {
      where.is_read = isRead;
    }

    if (type) {
      where.type = type;
    }

    const [notifications, total] = await Promise.all([
      prisma.thongBao.findMany({
        skip: parseInt(skip),
        take: parseInt(limit),
        where,
        include: {
          NhatKyHeThong: {
            select: {
              action: true,
              resource: true,
              description: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      }),
      prisma.thongBao.count({ where }),
    ]);

    return {
      notifications,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Đếm số thông báo chưa đọc
   */
  async getUnreadCount(userId) {
    const count = await prisma.thongBao.count({
      where: {
        nguoi_nhan_id: userId,
        is_read: false,
      },
    });

    return count;
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId, userId) {
    // Kiểm tra thông báo có tồn tại và thuộc về user
    const notification = await prisma.thongBao.findFirst({
      where: {
        id: notificationId,
        nguoi_nhan_id: userId,
      },
    });

    if (!notification) {
      throw new Error('Không tìm thấy thông báo');
    }

    const updated = await prisma.thongBao.update({
      where: { id: notificationId },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    return updated;
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(userId) {
    const result = await prisma.thongBao.updateMany({
      where: {
        nguoi_nhan_id: userId,
        is_read: false,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    return result;
  }

  /**
   * Xóa thông báo
   */
  async deleteNotification(notificationId, userId) {
    // Kiểm tra thông báo có tồn tại và thuộc về user
    const notification = await prisma.thongBao.findFirst({
      where: {
        id: notificationId,
        nguoi_nhan_id: userId,
      },
    });

    if (!notification) {
      throw new Error('Không tìm thấy thông báo');
    }

    await prisma.thongBao.delete({
      where: { id: notificationId },
    });

    return { message: 'Xóa thông báo thành công' };
  }

  /**
   * Xóa tất cả thông báo của user
   */
  async deleteAllNotifications(userId) {
    const result = await prisma.thongBao.deleteMany({
      where: { nguoi_nhan_id: userId },
    });
    return { message: `Đã xóa ${result.count} thông báo`, deleted: result.count };
  }

  /**
   * Xóa thông báo đã đọc cũ (sau 30 ngày)
   */
  async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.thongBao.deleteMany({
      where: {
        is_read: true,
        read_at: {
          lt: thirtyDaysAgo,
        },
      },
    });

    return result;
  }
}

module.exports = new NotificationService();
