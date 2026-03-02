const express = require('express');
const router = express.Router();
const systemLogsController = require('../controllers/systemLogs.controller');
const {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
  requireManager,
} = require('../middlewares/auth');

/**
 * @route   GET /api/system-logs
 * @desc    Lấy danh sách nhật ký hệ thống (phân quyền theo cấp bậc)
 * @access  Private - ADMIN+ only
 */
router.get('/', verifyToken, requireManager, systemLogsController.getLogs);

/**
 * @route   GET /api/system-logs/actions
 * @desc    Lấy danh sách các hành động có thể lọc
 * @access  Private - ADMIN+ only
 */
router.get('/actions', verifyToken, requireManager, systemLogsController.getActions);

/**
 * @route   GET /api/system-logs/resources
 * @desc    Lấy danh sách các tài nguyên có thể lọc
 * @access  Private - ADMIN+ only
 */
router.get('/resources', verifyToken, requireManager, systemLogsController.getResources);

module.exports = router;
