import { Router } from 'express';
import scientificAchievementController from '../controllers/scientificAchievement.controller';
import { verifyToken, requireAdminOrManager, requireAdminOnly } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { excelUpload as upload } from '../configs/multer';
import { validate } from '../middlewares/validate';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { scientificAchievementValidation, excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/scientific-achievements
 * @desc    List scientific achievements with filters and pagination
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  requireAdminOrManager,
  validate(scientificAchievementValidation.getAchievementsQuery, 'query'),
  scientificAchievementController.getAchievements
);

/**
 * @route   GET /api/scientific-achievements/export
 * @desc    Export scientific achievements to Excel
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  requireAdminOnly,
  validate(scientificAchievementValidation.exportAchievementsQuery, 'query'),
  scientificAchievementController.exportToExcel
);

/**
 * @route   GET /api/scientific-achievements/template
 * @desc    Download Excel template for scientific achievement import
 * @access  Private - ADMIN, MANAGER
 */
router.get('/template', verifyToken, requireAdminOnly, scientificAchievementController.getTemplate);

/**
 * @route   POST /api/scientific-achievements/import/preview
 * @desc    Preview scientific achievement import — validate only, no DB write
 * @access  Private - ADMIN only (Excel import is ADMIN-only)
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdminOnly,
  upload.single('file'),
  scientificAchievementController.previewImport
);

/**
 * @route   POST /api/scientific-achievements/import/confirm
 * @desc    Confirm scientific achievement import — persist validated data to DB
 * @access  Private - ADMIN only (Excel import is ADMIN-only)
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportScientificAchievement),
  scientificAchievementController.confirmImport
);

/**
 * @route   DELETE /api/scientific-achievements/:id
 * @desc    Delete a scientific achievement record
 * @access  Private - ADMIN, MANAGER
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
    getDescription: getLogDescription(AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  scientificAchievementController.deleteAchievement
);

export default router;
