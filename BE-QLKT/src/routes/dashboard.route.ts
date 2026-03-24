import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { verifyToken, requireSuperAdmin, requireAdmin, requireManager } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/dashboard/statistics
 * @desc    Lấy dữ liệu thống kê cho dashboard Super Admin
 * @access  Private - SUPER_ADMIN only
 */
router.get('/statistics', verifyToken, requireSuperAdmin, dashboardController.getStatistics);

/**
 * @route   GET /api/dashboard/statistics/admin
 * @desc    Lấy dữ liệu thống kê cho dashboard Admin
 * @access  Private - ADMIN+ only
 */
router.get('/statistics/admin', verifyToken, requireAdmin, dashboardController.getAdminStatistics);

/**
 * @route   GET /api/dashboard/statistics/manager
 * @desc    Lấy dữ liệu thống kê cho dashboard Manager
 * @access  Private - MANAGER+ only
 */
router.get(
  '/statistics/manager',
  verifyToken,
  requireManager,
  dashboardController.getManagerStatistics
);

export default router;
