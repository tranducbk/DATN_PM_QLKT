import { Router } from 'express';
import notificationController from '../controllers/notification.controller';
import { verifyToken } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    List notifications for the current user
 * @access  Private - All authenticated users
 */
router.get('/', verifyToken, notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count for the current user
 * @access  Private - All authenticated users
 */
router.get('/unread-count', verifyToken, notificationController.getUnreadCount);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private - All authenticated users
 */
router.patch('/:id/read', verifyToken, notificationController.markAsRead);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private - All authenticated users
 */
router.patch('/read-all', verifyToken, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete all notifications for the current user
 * @access  Private - All authenticated users
 */
router.delete('/all', verifyToken, notificationController.deleteAllNotifications);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification by ID
 * @access  Private - All authenticated users
 */
router.delete('/:id', verifyToken, notificationController.deleteNotification);

export default router;
