const { prisma } = require('../models');

class NotificationService {
  /**
   * Tạo thông báo mới
   */
  async createNotification(data) {
    try {
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

      return notification;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Tạo thông báo cho nhiều người dùng
   */
  async createBulkNotifications(notifications) {
    try {
      const result = await prisma.thongBao.createMany({
        data: notifications,
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Lấy danh sách thông báo của user
   */
  async getNotificationsByUserId(userId, filters = {}) {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đếm số thông báo chưa đọc
   */
  async getUnreadCount(userId) {
    try {
      const count = await prisma.thongBao.count({
        where: {
          nguoi_nhan_id: userId,
          is_read: false,
        },
      });

      return count;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId, userId) {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(userId) {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa thông báo
   */
  async deleteNotification(notificationId, userId) {
    try {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Xóa thông báo đã đọc cũ (sau 30 ngày)
   */
  async cleanupOldNotifications() {
    try {
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
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new NotificationService();
