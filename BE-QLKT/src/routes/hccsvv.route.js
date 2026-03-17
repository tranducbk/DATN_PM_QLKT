const router = require('express').Router();
const multer = require('multer');
const hccsvvController = require('../controllers/hccsvv.controller');
const { verifyToken, checkRole, requireManager, requireAdmin } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLogHelper');
const { ROLES } = require('../constants/roles');

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
// ROUTES - QUẢN LÝ Huy chương Chiến sĩ VẺ VANG
// ============================================

/**
 * @route   GET /api/hccsvv/template
 * @desc    Tải file mẫu Excel để import Huy chương Chiến sĩ Vẻ vang
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireManager, hccsvvController.getTemplate);

/**
 * @route   POST /api/hccsvv/import
 * @desc    Import Huy chương Chiến sĩ Vẻ vang từ file Excel
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  hccsvvController.importFromExcel
);

/**
 * @route   GET /api/hccsvv
 * @desc    Lấy danh sách Huy chương Chiến sĩ Vẻ vang (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), hccsvvController.getAll);

/**
 * @route   GET /api/hccsvv/export
 * @desc    Xuất file Excel Huy chương Chiến sĩ Vẻ vang (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get('/export', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), hccsvvController.exportToExcel);

/**
 * @route   GET /api/hccsvv/statistics
 * @desc    Thống kê Huy chương Chiến sĩ Vẻ vang theo hạng
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  hccsvvController.getStatistics
);

/**
 * @route   POST /api/hccsvv
 * @desc    Thêm khen thưởng HCCSVV trực tiếp (không cần tính điều kiện)
 * @access  SUPER_ADMIN
 */
router.post(
  '/',
  verifyToken,
  checkRole([ROLES.SUPER_ADMIN]),
  auditLog({
    action: 'CREATE',
    resource: 'hccsvv',
    getDescription: getLogDescription('hccsvv', 'CREATE'),
    getResourceId: (req, res) => res.locals.createdId || null,
  }),
  hccsvvController.createDirect
);

/**
 * @route   DELETE /api/hccsvv/:id
 * @desc    Xóa khen thưởng HCCSVV (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'hccsvv',
    getDescription: getLogDescription('hccsvv', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  hccsvvController.deleteAward
);

module.exports = router;
