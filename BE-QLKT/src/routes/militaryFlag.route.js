const router = require('express').Router();
const multer = require('multer');
const militaryFlagController = require('../controllers/militaryFlag.controller');
const { verifyToken, checkRole, requireManager, requireAdmin } = require('../middlewares/auth');
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
// ROUTES - QUẢN LÝ Huy chương quân kỳ QUYẾT THẮNG
// ============================================

/**
 * @route   GET /api/military-flag/template
 * @desc    Tải file mẫu Excel để import Huy chương quân kỳ Quyết thắng
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireManager, militaryFlagController.getTemplate);

/**
 * @route   POST /api/military-flag/import
 * @desc    Import Huy chương quân kỳ Quyết thắng từ file Excel
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  upload.single('file'),
  militaryFlagController.importFromExcel
);

/**
 * @route   GET /api/military-flag
 * @desc    Lấy danh sách Huy chương quân kỳ Quyết thắng (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole(['ADMIN', 'MANAGER']), militaryFlagController.getAll);

/**
 * @route   GET /api/military-flag/export
 * @desc    Xuất file Excel Huy chương quân kỳ Quyết thắng (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  militaryFlagController.exportToExcel
);

/**
 * @route   GET /api/military-flag/statistics
 * @desc    Thống kê Huy chương quân kỳ Quyết thắng
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  militaryFlagController.getStatistics
);

/**
 * @route   GET /api/military-flag/personnel/:personnel_id
 * @desc    Lấy Huy chương quân kỳ Quyết thắng theo personnel_id
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER', 'USER']),
  militaryFlagController.getByPersonnelId
);

/**
 * @route   DELETE /api/military-flag/:id
 * @desc    Xóa khen thưởng HCQKQT (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'military-flag',
    getDescription: getLogDescription('military-flag', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  militaryFlagController.deleteAward
);

module.exports = router;
