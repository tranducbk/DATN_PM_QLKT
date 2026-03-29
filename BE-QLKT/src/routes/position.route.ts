import { Router } from 'express';
import positionController from '../controllers/position.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { auditLog, createDescription, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { validate } from '../middlewares/validate';
import { positionValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/positions?unit_id={id}
 * @desc    Lấy chức vụ (lọc theo đơn vị)
 * @access  Private - ADMIN, MANAGER
 */
router.get('/', verifyToken, requireManager, positionController.getPositions);

/**
 * @route   POST /api/positions
 * @desc    Tạo chức vụ mới
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  validate(positionValidation.createPosition),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'positions',
    getDescription: getLogDescription('positions', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  positionController.createPosition
);

/**
 * @route   PUT /api/positions/:id
 * @desc    Sửa chức vụ
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  validate(positionValidation.updatePosition),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'positions',
    getDescription: getLogDescription('positions', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.updatePosition
);

/**
 * @route   DELETE /api/positions/:id
 * @desc    Xóa chức vụ
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'positions',
    getDescription: getLogDescription('positions', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.deletePosition
);

export default router;
