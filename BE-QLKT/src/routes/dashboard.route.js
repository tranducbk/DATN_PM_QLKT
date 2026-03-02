const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
  requireManager,
} = require('../middlewares/auth');

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

module.exports = router;

