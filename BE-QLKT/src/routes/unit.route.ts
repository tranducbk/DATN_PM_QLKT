import { Router } from 'express';
import unitController from '../controllers/unit.controller';
import { verifyToken, requireAdmin, requireManager } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { validate } from '../middlewares/validate';
import { unitValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/units/my-units
 * @desc    Get the Manager's unit and its sub-units
 * @access  Private - MANAGER
 */
router.get('/my-units', verifyToken, requireManager, unitController.getMyUnits);

/**
 * @route   GET /api/units
 * @desc    List all units and sub-units (?hierarchy=true for tree structure)
 * @access  Private - MANAGER and above
 */
router.get('/', verifyToken, requireManager, unitController.getAllUnits);

/**
 * @route   GET /api/units/:id
 * @desc    Get unit or sub-unit details with tree structure
 * @access  Private - MANAGER and above
 */
router.get('/:id', verifyToken, requireManager, unitController.getUnitById);

/**
 * @route   POST /api/units
 * @desc    Create a unit or sub-unit (provide co_quan_don_vi_id to create a sub-unit)
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
    getResourceId: getResourceId.fromResponse(),
  }),
  unitController.createUnit
);

/**
 * @route   PUT /api/units/:id
 * @desc    Update a unit or sub-unit (code, name, co_quan_don_vi_id)
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
 * @desc    Delete a unit or sub-unit
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
