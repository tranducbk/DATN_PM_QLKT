/*
 * NCKH ROUTE — Thành tích Nghiên cứu Khoa học hàng năm.
 * CRUD + Excel import/export. Unique key: (personnel_id, nam, mo_ta).
 * Recalc annual profile sau insert (vì ảnh hưởng chuỗi BKBQP/CSTDTQ/BKTTCP).
 */

import { Router } from 'express';
import scientificAchievementController from '../controllers/scientificAchievement.controller';
import { verifyToken, checkRole, requireAdminOnly } from '../middlewares/auth';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { validate } from '../middlewares/validate';
import { scientificAchievementValidation, excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/scientific-achievements
 * @desc    List scientific achievements with filters and pagination
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(scientificAchievementValidation.getAchievementsQuery, 'query'),
  scientificAchievementController.getAchievements
);

/**
 * @route   GET /api/scientific-achievements/export
 * @desc    Export scientific achievements to Excel
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(scientificAchievementValidation.exportAchievementsQuery, 'query'),
  scientificAchievementController.exportToExcel
);

/**
 * @route   GET /api/scientific-achievements/template
 * @desc    Download Excel template for scientific achievement import
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdminOnly, scientificAchievementController.getTemplate);

/**
 * @route   POST /api/scientific-achievements/import/preview
 * @desc    Preview scientific achievement import — validate only, no DB write
 * @access  ADMIN
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
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportScientificAchievement),
  scientificAchievementController.confirmImport
);

/**
 * @route   POST /api/scientific-achievements
 * @desc    Create a scientific achievement record
 * @access  ADMIN
 */
router.post(
  '/',
  verifyToken,
  requireAdminOnly,
  validate(scientificAchievementValidation.createAchievement),
  scientificAchievementController.createAchievement
);

/**
 * @route   PUT /api/scientific-achievements/:id
 * @desc    Update a scientific achievement record
 * @access  ADMIN
 */
router.put(
  '/:id',
  verifyToken,
  requireAdminOnly,
  validate(scientificAchievementValidation.updateAchievement),
  scientificAchievementController.updateAchievement
);

/**
 * @route   DELETE /api/scientific-achievements/:id
 * @desc    Delete a scientific achievement record
 * @access  ADMIN
 */
router.delete('/:id', verifyToken, requireAdminOnly, scientificAchievementController.deleteAchievement);

export default router;
