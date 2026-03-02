const express = require('express');
const router = express.Router();
const multer = require('multer');
const scientificAchievementController = require('../controllers/scientificAchievement.controller');
const { verifyToken, requireManager, requireAuth } = require('../middlewares/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/', verifyToken, requireAuth, scientificAchievementController.getAchievements);
router.get('/export', verifyToken, requireAuth, scientificAchievementController.exportToExcel);
router.get('/template', verifyToken, requireAuth, scientificAchievementController.downloadTemplate);
router.post(
  '/import',
  verifyToken,
  requireManager,
  upload.single('file'),
  scientificAchievementController.importFromExcel
);
router.post('/', verifyToken, requireManager, scientificAchievementController.createAchievement);
router.put('/:id', verifyToken, requireAuth, scientificAchievementController.updateAchievement);
router.delete(
  '/:id',
  verifyToken,
  requireAuth,
  scientificAchievementController.deleteAchievement
);

module.exports = router;
