import { emitNotificationToUser } from '../utils/socketService';
import type { ThongBao, Prisma } from '../generated/prisma';
import { NotFoundError } from '../middlewares/errorHandler';
import { notificationRepository } from '../repositories/notification.repository';

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

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  NOTIFICATION SERVICE — fan-out + real-time push
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KIẾN TRÚC 2 LAYER (persist + push):
 *
 *  ① PERSIST (DB):
 *     INSERT vào bảng ThongBao → user có thể xem lại lịch sử thông báo
 *     khi offline lúc đó hoặc reload trang.
 *
 *  ② PUSH (Socket.IO):
 *     Sau khi insert thành công → emitNotificationToUser(recipient_id, ...)
 *     → user đang online thấy badge tăng + dropdown update real-time.
 *
 *  WHY HAI LAYER (không chỉ push):
 *  - Socket có thể fail (network drop, server restart) → mất notification.
 *  - User logout/offline khi event xảy ra → cần lưu để xem sau.
 *  - Audit trail: ai được noti gì, lúc nào.
 *
 *  PATTERN FAN-OUT (createBulkNotifications):
 *  Khi 1 event ảnh hưởng nhiều user (vd: ADMIN duyệt đề xuất có 50 quân
 *  nhân được khen thưởng → 50 noti gửi đi):
 *    - createMany trong 1 query duy nhất thay vì 50 createOne.
 *    - Sau đó loop emit qua socket (50 lần emit là rẻ — chỉ là gửi
 *      message qua TCP đã connect).
 *
 *  KEY DESIGN:
 *  - `tai_nguyen_id` (resource_id) + `resource`: link tới record gốc
 *    (đề xuất, khen thưởng, ...). FE click noti → router.push(link).
 *  - `nhat_ky_he_thong_id`: link tới audit log entry → SUPER_ADMIN trace
 *    được ai trigger noti này.
 *  - `recipient_role`: redundant với recipient_id nhưng giúp query "tất
 *    cả noti gửi cho role X" nhanh hơn (vd: thông báo system tới tất cả
 *    MANAGER).
 *
 *  FIRE-AND-FORGET KHI EMIT:
 *  emitNotificationToUser KHÔNG await — socket emit là non-blocking.
 *  Nếu fail → noti vẫn còn trong DB, user sẽ thấy khi reload.
 *
 *  WHY KHÔNG dùng message queue (RabbitMQ/Kafka):
 *  - Scale hiện tại không cần (vài chục noti/giây max).
 *  - Trade-off: thêm dependency + deploy phức tạp.
 *  - Khi scale lên (vài nghìn user) NÊN migrate sang queue.
 * ════════════════════════════════════════════════════════════════════════════
 */
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

    // Bước ① — lưu DB trước. Tên cột DB là tiếng Việt (nguoi_nhan_id,
    // tai_nguyen_id, ...) nên phải map từ field tiếng Anh của input sang.
    const notification = await notificationRepository.create({
      nguoi_nhan_id: recipient_id,
      recipient_role,
      type,
      title,
      message,
      resource,
      tai_nguyen_id: resource_id || null,
      link,
      nhat_ky_he_thong_id: system_log_id,
    });

    // Bước ② — chỉ push real-time khi noti có người nhận cụ thể.
    // recipient_id = null nghĩa là noti theo role (không nhắm 1 user) → bỏ qua emit.
    if (recipient_id) {
      emitNotificationToUser(recipient_id, notification as unknown as Record<string, unknown>);
    }

    return notification;
  }

  async createBulkNotifications(
    notifications: Prisma.ThongBaoCreateManyInput[]
  ): Promise<Prisma.BatchPayload> {
    const result = await notificationRepository.createMany(notifications);

    return result;
  }

  async getNotificationsByUserId(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<NotificationListResult> {
    const { page = 1, limit = 20, isRead, type } = filters;
    const skip = (page - 1) * limit;

    // Luôn khóa theo userId → user chỉ thấy noti gửi cho chính mình.
    const where: Prisma.ThongBaoWhereInput = {
      nguoi_nhan_id: userId,
    };

    // Filter optional: chỉ thêm điều kiện khi FE truyền. isRead phân biệt
    // false (chưa đọc) với undefined (không lọc) nên dùng !== undefined.
    if (isRead !== undefined) {
      where.is_read = isRead;
    }

    if (type) {
      where.type = type;
    }

    // Lấy trang dữ liệu + đếm tổng song song (2 query độc lập) để giảm latency.
    const [notifications, total] = await Promise.all([
      notificationRepository.findManyRaw({
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
      notificationRepository.count(where),
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
    const count = await notificationRepository.count({
      nguoi_nhan_id: userId,
      is_read: false,
    });

    return count;
  }

  async markAsRead(notificationId: string, userId: string): Promise<ThongBao> {
    // Query kèm nguoi_nhan_id để chặn user đánh dấu noti của người khác.
    // Không tìm thấy → có thể noti không tồn tại HOẶC không thuộc user này;
    // cả hai đều trả NotFound (không lộ sự tồn tại của noti người khác).
    const notification = await notificationRepository.findManyRaw({
      where: {
        id: notificationId,
        nguoi_nhan_id: userId,
      },
      take: 1,
    });

    if (!notification[0]) {
      throw new NotFoundError('Thông báo');
    }

    const updated = await notificationRepository.update(notificationId, {
      is_read: true,
      readAt: new Date(),
    });

    return updated;
  }

  async markAllAsRead(userId: string): Promise<Prisma.BatchPayload> {
    // Chỉ update các noti CHƯA đọc của user → tránh ghi đè readAt cũ
    // và giảm số dòng phải update (đã đọc rồi thì bỏ qua).
    const result = await notificationRepository.updateMany(
      {
        nguoi_nhan_id: userId,
        is_read: false,
      },
      {
        is_read: true,
        readAt: new Date(),
      }
    );

    return result;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<{ message: string }> {
    const notification = await notificationRepository.findManyRaw({
      where: {
        id: notificationId,
        nguoi_nhan_id: userId,
      },
      take: 1,
    });

    if (!notification[0]) {
      throw new NotFoundError('Thông báo');
    }

    await notificationRepository.delete(notificationId);

    return { message: 'Xóa thông báo thành công' };
  }

  async deleteAllNotifications(userId: string): Promise<{ message: string; deleted: number }> {
    const result = await notificationRepository.deleteMany({ nguoi_nhan_id: userId });
    return { message: `Đã xóa ${result.count} thông báo`, deleted: result.count };
  }

  // Dọn rác định kỳ: xóa noti ĐÃ đọc và đọc cách đây > 30 ngày, tránh
  // bảng phình mãi. Noti chưa đọc luôn giữ lại dù cũ đến đâu.
  async cleanupOldNotifications(): Promise<Prisma.BatchPayload> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await notificationRepository.deleteMany({
      is_read: true,
      readAt: {
        lt: thirtyDaysAgo,
      },
    });

    return result;
  }
}

export default new NotificationService();
