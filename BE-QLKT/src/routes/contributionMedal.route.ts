import { Router } from 'express';
import contributionAwardController from '../controllers/contributionMedal.controller';
import { verifyToken, checkRole, requireAdmin } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/contribution-medals/template
 * @desc    Download Excel template for Contribution Award (HCBVTQ) import (supports ?personnel_ids=id1,id2)
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, contributionAwardController.getTemplate);

/**
 * @route   POST /api/contribution-medals/import/preview
 * @desc    Preview Contribution Award (HCBVTQ) import — validate only, no DB write
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  contributionAwardController.previewImport
);

/**
 * @route   POST /api/contribution-medals/import/confirm
 * @desc    Confirm Contribution Award (HCBVTQ) import — persist validated data to DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportContributionAward),
  contributionAwardController.confirmImport
);

/**
 * @route   GET /api/contribution-medals
 * @desc    List Contribution Awards (HCBVTQ) (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.getAll
);

/**
 * @route   GET /api/contribution-medals/export
 * @desc    Export Contribution Awards (HCBVTQ) to Excel (Admin: all units, Manager: own unit)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.exportToExcel
);

/**
 * @route   GET /api/contribution-medals/statistics
 * @desc    Get Contribution Award (HCBVTQ) statistics by grade
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.getStatistics
);

/**
 * @route   DELETE /api/contribution-medals/:id
 * @desc    Delete a Contribution Award (HCBVTQ) record (does not delete the proposal)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'contribution-medals',
    getDescription: getLogDescription('contribution-medals', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  contributionAwardController.deleteAward
);

export default router;
