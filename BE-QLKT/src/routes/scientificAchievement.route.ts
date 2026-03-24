import { Router } from 'express';
import scientificAchievementController from '../controllers/scientificAchievement.controller';
import { verifyToken, requireManager, requireAuth } from '../middlewares/auth';
import { excelUpload as upload } from '../configs/multer.config';
import { validate } from '../middlewares/validate';
import { scientificAchievementValidation } from '../validations';

const router = Router();

router.get('/', verifyToken, requireAuth, scientificAchievementController.getAchievements);
router.get('/export', verifyToken, requireAuth, scientificAchievementController.exportToExcel);
router.get('/template', verifyToken, requireAuth, scientificAchievementController.downloadTemplate);
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
  requireAuth,
  validate(scientificAchievementValidation.updateAchievement),
  scientificAchievementController.updateAchievement
);
router.delete('/:id', verifyToken, requireAuth, scientificAchievementController.deleteAchievement);

export default router;
