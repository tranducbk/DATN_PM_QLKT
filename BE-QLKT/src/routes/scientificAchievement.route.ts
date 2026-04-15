import { Router } from 'express';
import scientificAchievementController from '../controllers/scientificAchievement.controller';
import { verifyToken, requireManager, requireAuth } from '../middlewares/auth';
import { excelUpload as upload } from '../configs/multer';
import { validate } from '../middlewares/validate';
import { scientificAchievementValidation, excelImportValidation } from '../validations';

const router = Router();

router.get('/', verifyToken, requireManager, scientificAchievementController.getAchievements);
router.get('/export', verifyToken, requireManager, scientificAchievementController.exportToExcel);
router.get('/template', verifyToken, requireManager, scientificAchievementController.getTemplate);
router.post(
  '/import/preview',
  verifyToken,
  requireManager,
  upload.single('file'),
  scientificAchievementController.previewImport
);
router.post(
  '/import/confirm',
  verifyToken,
  requireManager,
  validate(excelImportValidation.confirmImportScientificAchievement),
  scientificAchievementController.confirmImport
);
router.post(
  '/',
  verifyToken,
  requireManager,
  validate(scientificAchievementValidation.createAchievement),
  scientificAchievementController.createAchievement
);
router.put(
  '/:id',
  verifyToken,
  requireManager,
  validate(scientificAchievementValidation.updateAchievement),
  scientificAchievementController.updateAchievement
);
router.delete('/:id', verifyToken, requireManager, scientificAchievementController.deleteAchievement);

export default router;
