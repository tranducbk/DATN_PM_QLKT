import { Router } from 'express';
import systemLogsController from '../controllers/systemLogs.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { requireFeatureFlag } from '../helpers/settingsHelper';

const router = Router();

/**
 * @route   GET /api/system-logs
 * @desc    List system logs (filtered by caller's role level)
 * @access  Private - ADMIN+ only
 */
router.get('/', verifyToken, requireManager, systemLogsController.getLogs);

/**
 * @route   GET /api/system-logs/actions
 * @desc    List filterable action types
 * @access  Private - ADMIN+ only
 */
router.get('/actions', verifyToken, requireManager, systemLogsController.getActions);

/**
 * @route   GET /api/system-logs/resources
 * @desc    List filterable resource types
 * @access  Private - ADMIN+ only
 */
router.get('/resources', verifyToken, requireManager, systemLogsController.getResources);

/**
 * @route   DELETE /api/system-logs
 * @desc    Delete system logs by ID list (requires DevZone allow_delete_logs flag)
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
 * @desc    Delete all system logs (requires DevZone allow_delete_logs flag)
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
