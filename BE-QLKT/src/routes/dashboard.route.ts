import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { verifyToken, requireSuperAdmin, requireAdmin, requireManager } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/dashboard/statistics
 * @desc    Get statistics for the Super Admin dashboard
 * @access  Private - SUPER_ADMIN only
 */
router.get('/statistics', verifyToken, requireSuperAdmin, dashboardController.getStatistics);

/**
 * @route   GET /api/dashboard/statistics/admin
 * @desc    Get statistics for the Admin dashboard
 * @access  Private - ADMIN+ only
 */
router.get('/statistics/admin', verifyToken, requireAdmin, dashboardController.getAdminStatistics);

/**
 * @route   GET /api/dashboard/statistics/manager
 * @desc    Get statistics for the Manager dashboard
 * @access  Private - MANAGER+ only
 */
router.get(
  '/statistics/manager',
  verifyToken,
  requireManager,
  dashboardController.getManagerStatistics
);

export default router;
