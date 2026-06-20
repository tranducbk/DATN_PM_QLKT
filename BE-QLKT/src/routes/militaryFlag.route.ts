import { Router } from 'express';
import militaryFlagController from '../controllers/militaryFlag.controller';
import { verifyToken, checkRole, requireManager, requireAdminOnly } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/military-flags/template
 * @desc    Download Excel template for Military Victory Flag (HC QKQT) import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdminOnly, militaryFlagController.getTemplate);

/**
 * @route   POST /api/military-flags/import/preview
 * @desc    Preview Military Victory Flag (HC QKQT) import — parse and validate Excel file
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdminOnly,
  upload.single('file'),
  militaryFlagController.previewImport
);

/**
 * @route   POST /api/military-flags/import/confirm
 * @desc    Confirm Military Victory Flag (HC QKQT) import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportMilitaryFlag),
  militaryFlagController.confirmImport
);

/**
 * @route   GET /api/military-flags
 * @desc    List Military Victory Flags (HC QKQT) (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, requireManager, militaryFlagController.getAll);

/**
 * @route   GET /api/military-flags/export
 * @desc    Export Military Victory Flags (HC QKQT) to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get('/export', verifyToken, requireAdminOnly, militaryFlagController.exportToExcel);

/**
 * @route   GET /api/military-flags/statistics
 * @desc    Get Military Victory Flag (HC QKQT) statistics
 * @access  ADMIN, MANAGER
 */
router.get('/statistics', verifyToken, requireManager, militaryFlagController.getStatistics);

/**
 * @route   GET /api/military-flags/personnel/:personnel_id
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
 * @route   GET /api/military-flags/check-received/:personnel_id
 * @desc    Check whether a personnel already received HC QKQT (or has a pending proposal)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/check-received/:personnel_id',
  verifyToken,
  requireManager,
  militaryFlagController.checkReceived
);

/**
 * @route   DELETE /api/military-flags/:id
 * @desc    Delete a Military Victory Flag award (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.MILITARY_FLAG,
    getDescription: getLogDescription(AWARD_SLUGS.MILITARY_FLAG, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  militaryFlagController.deleteAward
);

export default router;
