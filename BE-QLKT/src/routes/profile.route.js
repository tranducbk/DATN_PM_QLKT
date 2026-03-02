const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { verifyToken, requireAdmin, requireManager, requireAuth } = require('../middlewares/auth');

/**
 * @route   GET /api/profiles/annual/:personnel_id
 * @desc    Lấy hồ sơ đề xuất khen thưởng hằng năm (CSTT, CSTDCS, BKBQP, CSTDTQ)
 *          Query: ?year=2025 (nếu có năm, tự động recalculate trước khi trả về)
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get('/annual/:personnel_id', verifyToken, requireAuth, profileController.getAnnualProfile);

/**
 * @route   GET /api/profiles/tenure/:personnel_id
 * @desc    Lấy hồ sơ đề xuất Huy chương Chiến sĩ Vẻ vang (HCCSVV) theo niên hạn
 *          Tự động recalculate khi gọi API
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get('/tenure/:personnel_id', verifyToken, requireAuth, profileController.getTenureProfile);

/**
 * @route   GET /api/profiles/contribution/:personnel_id
 * @desc    Lấy hồ sơ đề xuất Huân chương Bảo vệ Tổ quốc (HCBVTQ) theo cống hiến
 *          Tự động recalculate khi gọi API
 * @access  Private - ADMIN, MANAGER, USER
 */
router.get(
  '/contribution/:personnel_id',
  verifyToken,
  requireAuth,
  profileController.getContributionProfile
);

/**
 * @route   POST /api/profiles/recalculate/:personnel_id
 * @desc    Tính toán lại hồ sơ cho 1 quân nhân
 * @access  Private - ADMIN, MANAGER
 */
router.post(
  '/recalculate/:personnel_id',
  verifyToken,
  requireManager,
  profileController.recalculateProfile
);

/**
 * @route   POST /api/profiles/recalculate-all
 * @desc    Tính toán lại cho toàn bộ quân nhân
 * @access  Private - ADMIN only
 */
router.post('/recalculate-all', verifyToken, requireAdmin, profileController.recalculateAll);

/**
 * @route   GET /api/profiles/tenure
 * @desc    Lấy danh sách tất cả hồ sơ niên hạn (cho admin)
 * @access  Private - ADMIN only
 */
router.get('/tenure', verifyToken, requireAdmin, profileController.getAllTenureProfiles);

/**
 * @route   PUT /api/profiles/tenure/:personnel_id
 * @desc    Cập nhật trạng thái hồ sơ niên hạn (ADMIN duyệt huân chương)
 * @access  Private - ADMIN only
 */
router.put(
  '/tenure/:personnel_id',
  verifyToken,
  requireAdmin,
  profileController.updateTenureProfile
);

module.exports = router;
