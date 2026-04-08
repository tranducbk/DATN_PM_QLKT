import { Request, Response } from 'express';
import notificationService from '../services/notification.service';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class NotificationController {
  getNotifications = catchAsync(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const { isRead, type } = req.query;
    const currentUser = req.user!;

    const result = await notificationService.getNotificationsByUserId(currentUser.id, {
      page,
      limit,
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      type: type as string,
    });

    return ResponseHelper.success(res, {
      message: 'Lấy danh sách thông báo thành công',
      data: {
        notifications: result.notifications,
        pagination: { total: result.total, page, limit, totalPages: result.totalPages },
      },
    });
  });

  getUnreadCount = catchAsync(async (req: Request, res: Response) => {
    const count = await notificationService.getUnreadCount(req.user!.id);
    return ResponseHelper.success(res, {
      message: 'Lấy số lượng thông báo chưa đọc thành công',
      data: { count },
    });
  });

  markAsRead = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    if (!id) return ResponseHelper.badRequest(res, 'ID thông báo không hợp lệ');
    const updated = await notificationService.markAsRead(id, req.user!.id);
    return ResponseHelper.success(res, { message: 'Đánh dấu đã đọc thành công', data: updated });
  });

  markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    const result = await notificationService.markAllAsRead(req.user!.id);
    return ResponseHelper.success(res, {
      message: 'Đánh dấu tất cả đã đọc thành công',
      data: { count: result.count },
    });
  });

  deleteNotification = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    if (!id) return ResponseHelper.badRequest(res, 'ID thông báo không hợp lệ');
    await notificationService.deleteNotification(id, req.user!.id);
    return ResponseHelper.success(res, { message: 'Xóa thông báo thành công' });
  });

  deleteAllNotifications = catchAsync(async (req: Request, res: Response) => {
    const result = await notificationService.deleteAllNotifications(req.user!.id);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new NotificationController();
