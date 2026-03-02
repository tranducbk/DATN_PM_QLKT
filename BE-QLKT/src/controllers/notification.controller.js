const { prisma } = require('../models');

class NotificationController {
  /**
   * GET /api/notifications
   * Lấy danh sách thông báo của user hiện tại
   */
  async getNotifications(req, res) {
    try {
      const { page = 1, limit = 20, isRead, type } = req.query;
      const currentUser = req.user;

      const skip = (page - 1) * limit;
      const where = {
        nguoi_nhan_id: currentUser.id,
      };

      // Lọc theo trạng thái đọc
      if (isRead !== undefined) {
        where.is_read = isRead === 'true';
      }

      // Lọc theo loại thông báo
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

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách thông báo thành công',
        data: {
          notifications,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy danh sách thông báo',
      });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Lấy số lượng thông báo chưa đọc
   */
  async getUnreadCount(req, res) {
    try {
      const currentUser = req.user;

      const count = await prisma.thongBao.count({
        where: {
          nguoi_nhan_id: currentUser.id,
          is_read: false,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Lấy số lượng thông báo chưa đọc thành công',
        data: { count },
      });
    } catch (error) {
      console.error('Get unread count error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi lấy số lượng thông báo chưa đọc',
      });
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const notificationId = parseInt(id, 10);

      if (isNaN(notificationId)) {
        return res.status(400).json({
          success: false,
          message: 'ID thông báo không hợp lệ',
        });
      }

      // Kiểm tra thông báo có tồn tại và thuộc về user hiện tại
      const notification = await prisma.thongBao.findFirst({
        where: {
          id: notificationId,
          nguoi_nhan_id: currentUser.id,
        },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông báo',
        });
      }

      const updatedNotification = await prisma.thongBao.update({
        where: { id: notificationId },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Đánh dấu đã đọc thành công',
        data: updatedNotification,
      });
    } catch (error) {
      console.error('Mark as read error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi đánh dấu đã đọc',
      });
    }
  }

  /**
   * PATCH /api/notifications/read-all
   * Đánh dấu tất cả thông báo đã đọc
   */
  async markAllAsRead(req, res) {
    try {
      const currentUser = req.user;

      const result = await prisma.thongBao.updateMany({
        where: {
          nguoi_nhan_id: currentUser.id,
          is_read: false,
        },
        data: {
          is_read: true,
          read_at: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Đánh dấu tất cả đã đọc thành công',
        data: { count: result.count },
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi đánh dấu tất cả đã đọc',
      });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Xóa thông báo
   */
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      const notificationId = parseInt(id, 10);

      if (isNaN(notificationId)) {
        return res.status(400).json({
          success: false,
          message: 'ID thông báo không hợp lệ',
        });
      }

      // Kiểm tra thông báo có tồn tại và thuộc về user hiện tại
      const notification = await prisma.thongBao.findFirst({
        where: {
          id: notificationId,
          nguoi_nhan_id: currentUser.id,
        },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông báo',
        });
      }

      await prisma.thongBao.delete({
        where: { id: notificationId },
      });

      return res.status(200).json({
        success: true,
        message: 'Xóa thông báo thành công',
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi xóa thông báo',
      });
    }
  }
}

module.exports = new NotificationController();
