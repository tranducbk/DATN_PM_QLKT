import { Router } from 'express';
import scientificAchievementController from '../controllers/scientificAchievement.controller';
import { verifyToken, requireManager, requireAuth } from '../middlewares/auth';
import { excelUpload as upload } from '../configs/multer';
import { validate } from '../middlewares/validate';
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
  requireManager,
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
  requireManager,
  validate(scientificAchievementValidation.exportAchievementsQuery, 'query'),
  scientificAchievementController.exportToExcel
);

/**
 * @route   GET /api/scientific-achievements/template
 * @desc    Download Excel template for scientific achievement import
 * @access  Private - ADMIN, MANAGER
 */
router.get('/template', verifyToken, requireManager, scientificAchievementController.getTemplate);

/**
 * @route   POST /api/scientific-achievements/import/preview
 * @desc    Preview scientific achievement import — validate only, no DB write
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/import/preview',
  verifyToken,
  requireManager,
  upload.single('file'),
  scientificAchievementController.previewImport
);

/**
 * @route   POST /api/scientific-achievements/import/confirm
 * @desc    Confirm scientific achievement import — persist validated data to DB
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireManager,
  validate(excelImportValidation.confirmImportScientificAchievement),
  scientificAchievementController.confirmImport
);

/**
 * @route   POST /api/scientific-achievements
 * @desc    Create a scientific achievement record
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/',
  verifyToken,
  requireManager,
  validate(scientificAchievementValidation.createAchievement),
  scientificAchievementController.createAchievement
);

/**
 * @route   PUT /api/scientific-achievements/:id
 * @desc    Update a scientific achievement record
 * @access  Private - ADMIN, MANAGER
 */
router.put(
  '/:id',
  verifyToken,
  requireManager,
  validate(scientificAchievementValidation.updateAchievement),
  scientificAchievementController.updateAchievement
);

/**
 * @route   DELETE /api/scientific-achievements/:id
 * @desc    Delete a scientific achievement record
 * @access  Private - ADMIN, MANAGER
 */
router.delete('/:id', verifyToken, requireManager, scientificAchievementController.deleteAchievement);

export default router;
