const router = require('express').Router();
const multer = require('multer');
const commemorativeMedalController = require('../controllers/commemorativeMedal.controller');
const { verifyToken, checkRole, requireAdmin } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLogHelper');

// Cấu hình multer cho file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
    }
  },
});

// ============================================
// ROUTES - QUẢN LÝ KỶ NIỆM CHƯƠNG VÌ SỰ NGHIỆP XÂY DỰNG QĐNDVN
// ============================================

/**
 * @route   GET /api/commemorative-medals/template
 * @desc    Tải file mẫu Excel để import Kỷ niệm chương
 * @access  ADMIN, MANAGER
 */
router.get(
  '/template',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  commemorativeMedalController.getTemplate
);

/**
 * @route   POST /api/commemorative-medals/import
 * @desc    Import Kỷ niệm chương từ file Excel
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  upload.single('file'),
  commemorativeMedalController.importFromExcel
);

/**
 * @route   GET /api/commemorative-medals
 * @desc    Lấy danh sách Kỷ niệm chương (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole(['ADMIN', 'MANAGER']), commemorativeMedalController.getAll);

/**
 * @route   GET /api/commemorative-medals/export
 * @desc    Xuất file Excel Kỷ niệm chương (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  commemorativeMedalController.exportToExcel
);

/**
 * @route   GET /api/commemorative-medals/statistics
 * @desc    Thống kê Kỷ niệm chương
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  commemorativeMedalController.getStatistics
);

/**
 * @route   GET /api/commemorative-medals/personnel/:personnel_id
 * @desc    Lấy Kỷ niệm chương theo personnel_id
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER', 'USER']),
  commemorativeMedalController.getByPersonnelId
);

/**
 * @route   DELETE /api/commemorative-medals/:id
 * @desc    Xóa khen thưởng KNC VSNXD (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'commemorative-medals',
    getDescription: getLogDescription('commemorative-medals', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  commemorativeMedalController.deleteAward
);

module.exports = router;
