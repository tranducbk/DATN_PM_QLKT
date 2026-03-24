import { Request, Response } from 'express';
import { prisma } from '../models';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class NotificationController {
  getNotifications = catchAsync(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const { isRead, type } = req.query;
    const currentUser = req.user!;

    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { nguoi_nhan_id: currentUser.id };
    if (isRead !== undefined) where.is_read = isRead === 'true';
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      prisma.thongBao.findMany({
        skip,
        take: limit,
        where,
        include: {
          NhatKyHeThong: { select: { action: true, resource: true, description: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.thongBao.count({ where }),
    ]);

    return ResponseHelper.success(res, {
      message: 'Lấy danh sách thông báo thành công',
      data: {
        notifications,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
    });
  });

  getUnreadCount = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const count = await prisma.thongBao.count({
      where: { nguoi_nhan_id: currentUser.id, is_read: false },
    });
    return ResponseHelper.success(res, {
      message: 'Lấy số lượng thông báo chưa đọc thành công',
      data: { count },
    });
  });

  markAsRead = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const currentUser = req.user!;
    const notificationId = id ? parseInt(id, 10) : NaN;
    if (isNaN(notificationId)) {
      return ResponseHelper.badRequest(res, 'ID thông báo không hợp lệ');
    }
    const notification = await prisma.thongBao.findFirst({
      where: { id: notificationId, nguoi_nhan_id: currentUser.id },
    });
    if (!notification) {
      return ResponseHelper.notFound(res, 'Không tìm thấy thông báo');
    }
    const updatedNotification = await prisma.thongBao.update({
      where: { id: notificationId },
      data: { is_read: true, read_at: new Date() },
    });
    return ResponseHelper.success(res, {
      message: 'Đánh dấu đã đọc thành công',
      data: updatedNotification,
    });
  });

  markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const result = await prisma.thongBao.updateMany({
      where: { nguoi_nhan_id: currentUser.id, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
    return ResponseHelper.success(res, {
      message: 'Đánh dấu tất cả đã đọc thành công',
      data: { count: result.count },
    });
  });

  deleteNotification = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    const currentUser = req.user!;
    const notificationId = id ? parseInt(id, 10) : NaN;
    if (isNaN(notificationId)) {
      return ResponseHelper.badRequest(res, 'ID thông báo không hợp lệ');
    }
    const notification = await prisma.thongBao.findFirst({
      where: { id: notificationId, nguoi_nhan_id: currentUser.id },
    });
    if (!notification) {
      return ResponseHelper.notFound(res, 'Không tìm thấy thông báo');
    }
    await prisma.thongBao.delete({ where: { id: notificationId } });
    return ResponseHelper.success(res, { message: 'Xóa thông báo thành công' });
  });

  deleteAllNotifications = catchAsync(async (req: Request, res: Response) => {
    const result = await prisma.thongBao.deleteMany({
      where: { nguoi_nhan_id: req.user!.id },
    });
    return ResponseHelper.success(res, { message: `Đã xóa ${result.count} thông báo` });
  });
}

export default new NotificationController();
