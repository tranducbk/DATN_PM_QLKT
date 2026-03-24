import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { verifyToken } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Lấy danh sách thông báo của user hiện tại
 * @access  Private - All authenticated users
 */
router.get('/', verifyToken, notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Lấy số lượng thông báo chưa đọc
 * @access  Private - All authenticated users
 */
router.get('/unread-count', verifyToken, notificationController.getUnreadCount);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Đánh dấu thông báo đã đọc
 * @access  Private - All authenticated users
 */
router.patch('/:id/read', verifyToken, notificationController.markAsRead);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Đánh dấu tất cả thông báo đã đọc
 * @access  Private - All authenticated users
 */
router.patch('/read-all', verifyToken, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Xóa thông báo
 * @access  Private - All authenticated users
 */
router.delete('/all', verifyToken, notificationController.deleteAllNotifications);

router.delete('/:id', verifyToken, notificationController.deleteNotification);

export default router;
