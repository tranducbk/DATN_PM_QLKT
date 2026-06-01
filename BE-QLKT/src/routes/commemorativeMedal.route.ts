/*
 * COMMEMORATIVE MEDAL ROUTE — KNC VSNXD QĐNDVN.
 * CRUD + Excel. Lifetime 1 record/personnel.
 * Eligibility: Nam ≥25 năm, Nữ ≥20 năm (gender-aware threshold).
 */

import { Router } from 'express';
import commemorativeMedalController from '../controllers/commemorativeMedal.controller';
import { verifyToken, checkRole, requireAdminOrManager, requireAdminOnly } from '../middlewares/auth';
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
 * @route   GET /api/commemorative-medals/template
 * @desc    Download Excel template for commemorative medal import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdminOnly, commemorativeMedalController.getTemplate);

/**
 * @route   POST /api/commemorative-medals/import/preview
 * @desc    Preview commemorative medal (KNC VSNXD) import — validate only, no DB write
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdminOnly,
  upload.single('file'),
  commemorativeMedalController.previewImport
);

/**
 * @route   POST /api/commemorative-medals/import/confirm
 * @desc    Confirm commemorative medal (KNC VSNXD) import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportCommemorativeMedal),
  commemorativeMedalController.confirmImport
);

/**
 * @route   GET /api/commemorative-medals
 * @desc    List commemorative medals (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  requireAdminOrManager,
  commemorativeMedalController.getAll
);

/**
 * @route   GET /api/commemorative-medals/export
 * @desc    Export commemorative medals to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  requireAdminOrManager,
  commemorativeMedalController.exportToExcel
);

/**
 * @route   GET /api/commemorative-medals/statistics
 * @desc    Get commemorative medal statistics
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  requireAdminOrManager,
  commemorativeMedalController.getStatistics
);

/**
 * @route   GET /api/commemorative-medals/personnel/:personnel_id
 * @desc    Get commemorative medals (VSNXD QDNDVN) for a personnel
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
  commemorativeMedalController.getByPersonnelId
);

/**
 * @route   GET /api/commemorative-medals/check-received/:personnel_id
 * @desc    Check whether a personnel already received KNC VSNXD QDNDVN (or has a pending proposal)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/check-received/:personnel_id',
  verifyToken,
  requireAdminOrManager,
  commemorativeMedalController.checkReceived
);

/**
 * @route   DELETE /api/commemorative-medals/:id
 * @desc    Delete a commemorative medal award (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.COMMEMORATIVE_MEDALS,
    getDescription: getLogDescription(AWARD_SLUGS.COMMEMORATIVE_MEDALS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  commemorativeMedalController.deleteAward
);

export default router;
