import { prisma } from '../models';
import { emitNotificationToUser } from '../utils/socketService';
import type { ThongBao, Prisma } from '../generated/prisma';
import { NotFoundError } from '../middlewares/errorHandler';

interface CreateNotificationData {
  recipient_id: string | null;
  recipient_role: string;
  type: string;
  title: string;
  message: string;
  resource?: string;
  resource_id?: string | null;
  link?: string;
  system_log_id?: string | null;
}

interface NotificationFilters {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}

interface NotificationListResult {
  notifications: ThongBao[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class NotificationService {
  async createNotification(data: CreateNotificationData): Promise<ThongBao> {
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

    if (recipient_id) {
      emitNotificationToUser(recipient_id, notification as unknown as Record<string, unknown>);
    }

    return notification;
  }

  async createBulkNotifications(
    notifications: Prisma.ThongBaoCreateManyInput[]
  ): Promise<Prisma.BatchPayload> {
    const result = await prisma.thongBao.createMany({
      data: notifications,
    });

    return result;
  }

  async getNotificationsByUserId(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<NotificationListResult> {
    const { page = 1, limit = 20, isRead, type } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ThongBaoWhereInput = {
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
        skip: Number(skip),
        take: Number(limit),
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
          createdAt: 'desc',
        },
      }),
      prisma.thongBao.count({ where }),
    ]);

    return {
      notifications,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await prisma.thongBao.count({
      where: {
        nguoi_nhan_id: userId,
        is_read: false,
      },
    });

    return count;
  }

  async markAsRead(notificationId: string, userId: string): Promise<ThongBao> {
    const notification = await prisma.thongBao.findFirst({
      where: {
        id: notificationId,
        nguoi_nhan_id: userId,
      },
    });

    if (!notification) {
      throw new NotFoundError('Thông báo');
    }

    const updated = await prisma.thongBao.update({
      where: { id: notificationId },
      data: {
        is_read: true,
        readAt: new Date(),
      },
    });

    return updated;
  }

  async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    const result = await prisma.thongBao.updateMany({
      where: {
        nguoi_nhan_id: userId,
        is_read: false,
      },
      data: {
        is_read: true,
        readAt: new Date(),
      },
    });

    return result;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<{ message: string }> {
    const notification = await prisma.thongBao.findFirst({
      where: {
        id: notificationId,
        nguoi_nhan_id: userId,
      },
    });

    if (!notification) {
      throw new NotFoundError('Thông báo');
    }

    await prisma.thongBao.delete({
      where: { id: notificationId },
    });

    return { message: 'Xóa thông báo thành công' };
  }

  async deleteAllNotifications(userId: string): Promise<{ message: string; deleted: number }> {
    const result = await prisma.thongBao.deleteMany({
      where: { nguoi_nhan_id: userId },
    });
    return { message: `Đã xóa ${result.count} thông báo`, deleted: result.count };
  }

  async cleanupOldNotifications(): Promise<Prisma.BatchPayload> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.thongBao.deleteMany({
      where: {
        is_read: true,
        readAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    return result;
  }
}

export default new NotificationService();
