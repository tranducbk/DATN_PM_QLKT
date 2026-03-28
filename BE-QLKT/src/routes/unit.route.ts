import { Router } from 'express';
import unitController from '../controllers/unit.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { auditLog, createDescription, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { validate } from '../middlewares/validate';
import { unitValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/units/my-units
 * @desc    Lấy đơn vị của Manager và các đơn vị con
 * @access  Private - MANAGER
 */
router.get('/my-units', verifyToken, requireManager, unitController.getMyUnits);

/**
 * @route   GET /api/units
 * @desc    Lấy tất cả cơ quan đơn vị và đơn vị trực thuộc (?hierarchy=true để lấy theo cấu trúc cây)
 * @access  Private - MANAGER and above
 */
router.get('/', verifyToken, requireManager, unitController.getAllUnits);

/**
 * @route   GET /api/units/:id
 * @desc    Lấy chi tiết cơ quan đơn vị hoặc đơn vị trực thuộc với cấu trúc cây
 * @access  Private - MANAGER and above
 */
router.get('/:id', verifyToken, requireManager, unitController.getUnitById);

/**
 * @route   POST /api/units
 * @desc    Tạo cơ quan đơn vị mới hoặc đơn vị trực thuộc (nếu có co_quan_don_vi_id)
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  validate(unitValidation.createUnit),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'units',
    getDescription: getLogDescription('units', 'CREATE'),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  unitController.createUnit
);

/**
 * @route   PUT /api/units/:id
 * @desc    Sửa cơ quan đơn vị hoặc đơn vị trực thuộc (mã, tên, co_quan_don_vi_id)
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  validate(unitValidation.updateUnit),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'units',
    getDescription: getLogDescription('units', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitController.updateUnit
);

/**
 * @route   DELETE /api/units/:id
 * @desc    Xóa cơ quan đơn vị hoặc đơn vị trực thuộc
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'units',
    getDescription: getLogDescription('units', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitController.deleteUnit
);

export default router;
