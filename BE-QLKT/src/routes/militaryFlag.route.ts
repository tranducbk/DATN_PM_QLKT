import { Router } from 'express';
import militaryFlagController from '../controllers/militaryFlag.controller';
import { verifyToken, checkRole, requireManager, requireAdmin } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/military-flag/template
 * @desc    Download Excel template for Military Victory Flag (HC QKQT) import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, militaryFlagController.getTemplate);

/**
 * @route   POST /api/military-flag/import/preview
 * @desc    Preview Military Victory Flag (HC QKQT) import — parse and validate Excel file
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  militaryFlagController.previewImport
);

/**
 * @route   POST /api/military-flag/import/confirm
 * @desc    Confirm Military Victory Flag (HC QKQT) import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportMilitaryFlag),
  militaryFlagController.confirmImport
);

/**
 * @route   GET /api/military-flag
 * @desc    List Military Victory Flags (HC QKQT) (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  militaryFlagController.getAll
);

/**
 * @route   GET /api/military-flag/export
 * @desc    Export Military Victory Flags (HC QKQT) to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  militaryFlagController.exportToExcel
);

/**
 * @route   GET /api/military-flag/statistics
 * @desc    Get Military Victory Flag (HC QKQT) statistics
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  militaryFlagController.getStatistics
);

/**
 * @route   GET /api/military-flag/personnel/:personnel_id
 * @desc    Get Military Victory Flags (HC QKQT) for a personnel
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
  militaryFlagController.getByPersonnelId
);

/**
 * @route   DELETE /api/military-flag/:id
 * @desc    Delete a Military Victory Flag award (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'military-flag',
    getDescription: getLogDescription('military-flag', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  militaryFlagController.deleteAward
);

export default router;
