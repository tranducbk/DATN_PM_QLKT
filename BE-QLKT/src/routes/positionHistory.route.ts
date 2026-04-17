import { Router } from 'express';
import positionHistoryController from '../controllers/positionHistory.controller';
import { verifyToken, requireManager, requireAuth } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/position-history
 * @desc    List position history entries (?personnel_id to filter)
 * @access  Private - All authenticated users
 */
router.get('/', verifyToken, requireAuth, positionHistoryController.getPositionHistory);

/**
 * @route   POST /api/position-history
 * @desc    Create a position history entry
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  positionHistoryController.createPositionHistory
);

/**
 * @route   PUT /api/position-history/:id
 * @desc    Update a position history entry
 * @access  Private - ADMIN, MANAGER
 */
router.put(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.updatePositionHistory
);

/**
 * @route   DELETE /api/position-history/:id
 * @desc    Delete a position history entry
 * @access  Private - ADMIN, MANAGER
 */
router.delete(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'position-history',
    getDescription: getLogDescription('position-history', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.deletePositionHistory
);

export default router;
