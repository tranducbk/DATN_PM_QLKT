import { Router } from 'express';
import systemLogsController from '../controllers/systemLogs.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { requireFeatureFlag } from '../helpers/settingsHelper';

const router = Router();

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

/**
 * @route   DELETE /api/system-logs
 * @desc    Xoá nhật ký theo danh sách ID (yêu cầu DevZone bật)
 * @access  Private - ADMIN+ only
 */
router.delete(
  '/',
  verifyToken,
  requireAdmin,
  requireFeatureFlag('allow_delete_logs'),
  systemLogsController.deleteLogs
);

/**
 * @route   DELETE /api/system-logs/all
 * @desc    Xoá toàn bộ nhật ký (yêu cầu DevZone bật)
 * @access  Private - ADMIN+ only
 */
router.delete(
  '/all',
  verifyToken,
  requireAdmin,
  requireFeatureFlag('allow_delete_logs'),
  systemLogsController.deleteAllLogs
);

export default router;
