const router = require('express').Router();
const multer = require('multer');
const contributionAwardController = require('../controllers/contributionAward.controller');
const { verifyToken, checkRole, requireManager, requireAdmin } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLog');
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

// ROUTES - QUẢN LÝ HUÂN CHƯƠNG BẢO VỆ TỔ QUỐC (CỐNG HIẾN)

/**
 * @route   GET /api/contribution-awards/template
 * @desc    Tải file mẫu Excel để import Huân chương Bảo vệ Tổ quốc (hỗ trợ ?personnel_ids=id1,id2)
 * @access  ADMIN, MANAGER
 */
router.get('/template', verifyToken, requireManager, contributionAwardController.getTemplate);

/**
 * @route   POST /api/contribution-awards/import/preview
 * @desc    Preview import HCBVTQ — chỉ validate, không ghi DB
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import/preview',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  contributionAwardController.previewImport
);

/**
 * @route   POST /api/contribution-awards/import/confirm
 * @desc    Confirm import HCBVTQ — lưu dữ liệu đã validate vào DB
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import/confirm',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.confirmImport
);

/**
 * @route   GET /api/contribution-awards
 * @desc    Lấy danh sách Huân chương Bảo vệ Tổ quốc (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.getAll
);

/**
 * @route   GET /api/contribution-awards/export
 * @desc    Xuất file Excel Huân chương Bảo vệ Tổ quốc (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.exportToExcel
);

/**
 * @route   GET /api/contribution-awards/statistics
 * @desc    Thống kê Huân chương Bảo vệ Tổ quốc theo hạng
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.getStatistics
);

/**
 * @route   DELETE /api/contribution-awards/:id
 * @desc    Xóa khen thưởng HCBVTQ (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'contribution-awards',
    getDescription: getLogDescription('contribution-awards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  contributionAwardController.deleteAward
);

module.exports = router;
