const express = require('express');
const router = express.Router();
const scientificAchievementController = require('../controllers/scientificAchievement.controller');
const { verifyToken, requireManager, requireAuth } = require('../middlewares/auth');
const { excelUpload: upload } = require('../configs/multer.config');
const { validate } = require('../middlewares/validate');
const { scientificAchievementValidation } = require('../validations');

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

module.exports = router;
