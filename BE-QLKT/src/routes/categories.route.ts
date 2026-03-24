import { Router, Request } from 'express';
import unitController from '../controllers/unit.controller';
import positionController from '../controllers/position.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { auditLog, createDescription, getResourceId } from '../middlewares/auditLog';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/categories/units
 * @desc    Lấy tất cả đơn vị (alias for /api/units)
 * @access  Private - ADMIN and above
 */
router.get('/units', verifyToken, requireAdmin, unitController.getAllUnits);

/**
 * @route   POST /api/categories/units
 * @desc    Tạo đơn vị mới (alias for /api/units)
 * @access  Private - ADMIN and above
 */
router.post(
  '/units',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'units',
    getDescription: (req: Request) => createDescription.create('don vi', req.body),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  unitController.createUnit
);

/**
 * @route   PUT /api/categories/units/:id
 * @desc    Sửa tên đơn vị (alias for /api/units/:id)
 * @access  Private - ADMIN and above
 */
router.put(
  '/units/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'units',
    getDescription: (req: Request) => createDescription.update('don vi', req.body),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitController.updateUnit
);

/**
 * @route   DELETE /api/categories/units/:id
 * @desc    Xóa đơn vị (alias for /api/units/:id)
 * @access  Private - ADMIN and above
 */
router.delete(
  '/units/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'units',
    getDescription: (req: Request) =>
      createDescription.delete('don vi', { id: String(req.params.id) }),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitController.deleteUnit
);

/**
 * @route   GET /api/categories/positions?unit_id={id}
 * @desc    Lấy chức vụ (alias for /api/positions)
 * @access  Private - ADMIN, MANAGER
 */
router.get('/positions', verifyToken, requireManager, positionController.getPositions);

/**
 * @route   POST /api/categories/positions
 * @desc    Tạo chức vụ mới (alias for /api/positions)
 * @access  Private - ADMIN and above
 */
router.post(
  '/positions',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'positions',
    getDescription: (req: Request) => createDescription.create('chuc vu', req.body),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  positionController.createPosition
);

/**
 * @route   PUT /api/categories/positions/:id
 * @desc    Sửa chức vụ (alias for /api/positions/:id)
 * @access  Private - ADMIN and above
 */
router.put(
  '/positions/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'positions',
    getDescription: (req: Request) => createDescription.update('chuc vu', req.body),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.updatePosition
);

/**
 * @route   DELETE /api/categories/positions/:id
 * @desc    Xóa chức vụ (alias for /api/positions/:id)
 * @access  Private - ADMIN and above
 */
router.delete(
  '/positions/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'positions',
    getDescription: (req: Request) =>
      createDescription.delete('chuc vu', { id: String(req.params.id) }),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.deletePosition
);

export default router;
