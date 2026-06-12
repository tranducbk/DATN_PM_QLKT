/*
 * POSITION ROUTE — master data chức vụ (ChucVu) + hệ số.
 * READ: ALL authenticated. WRITE: ADMIN+.
 * Đổi hệ số → ảnh hưởng eligibility HCBVTQ (trigger recalc).
 */

import { Router } from 'express';
import positionController from '../controllers/position.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { validate } from '../middlewares/validate';
import { positionValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';

const router = Router();

/**
 * @route   GET /api/positions?unit_id={id}
 * @desc    List positions, optionally filtered by unit_id
 * @access  Private - ADMIN, MANAGER
 */
router.get('/', verifyToken, requireManager, positionController.getPositions);

/**
 * @route   POST /api/positions
 * @desc    Create a new position
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  validate(positionValidation.createPosition),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: RESOURCE_SLUGS.POSITIONS,
    getDescription: getLogDescription(RESOURCE_SLUGS.POSITIONS, 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  positionController.createPosition
);

/**
 * @route   PUT /api/positions/:id
 * @desc    Update a position
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  validate(positionValidation.updatePosition),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: RESOURCE_SLUGS.POSITIONS,
    getDescription: getLogDescription(RESOURCE_SLUGS.POSITIONS, 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.updatePosition
);

/**
 * @route   DELETE /api/positions/:id
 * @desc    Delete a position
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: RESOURCE_SLUGS.POSITIONS,
    getDescription: getLogDescription(RESOURCE_SLUGS.POSITIONS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.deletePosition
);

export default router;
