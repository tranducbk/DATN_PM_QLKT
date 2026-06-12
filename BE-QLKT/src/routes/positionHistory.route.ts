/*
 * POSITION HISTORY ROUTE — lịch sử chức vụ quân nhân.
 * CRUD. Insert tự auto-close chức vụ trước (gợi ý suggestedEndDate).
 * Validate overlap (không cho 2 chức vụ cùng lúc).
 * Recalc HCBVTQ profile sau mỗi thay đổi (số tháng nhóm hệ số đổi).
 */

import { Router } from 'express';
import positionHistoryController from '../controllers/positionHistory.controller';
import { verifyToken, requireManager } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';

const router = Router();

/**
 * @route   GET /api/position-history
 * @desc    List position history entries (?personnel_id to filter)
 * @access  Private - All authenticated users
 */
router.get('/', verifyToken, positionHistoryController.getPositionHistory);

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
    resource: RESOURCE_SLUGS.POSITION_HISTORY,
    getDescription: getLogDescription(RESOURCE_SLUGS.POSITION_HISTORY, 'CREATE'),
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
    resource: RESOURCE_SLUGS.POSITION_HISTORY,
    getDescription: getLogDescription(RESOURCE_SLUGS.POSITION_HISTORY, 'UPDATE'),
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
    resource: RESOURCE_SLUGS.POSITION_HISTORY,
    getDescription: getLogDescription(RESOURCE_SLUGS.POSITION_HISTORY, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionHistoryController.deletePositionHistory
);

export default router;
