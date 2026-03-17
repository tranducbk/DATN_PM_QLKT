const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/unitAnnualAward.controller');
const {
  verifyToken,
  requireManager,
  requireAuth,
  requireAdmin,
  checkRole,
} = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLogHelper');
const { ROLES } = require('../constants/roles');

// Memory storage for small file imports (if needed in future)
const upload = multer({ storage: multer.memoryStorage() });

// Disk storage to save PDF decision files
const uploadDir = path.join(__dirname, '../../uploads/decisions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file PDF'));
    }
  },
});

/**
 * @route   GET /api/awards/units/annual
 * @desc    Lấy danh sách khen thưởng đơn vị hằng năm (Admin: tất cả, Manager: đơn vị mình, User: đơn vị mình)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/', verifyToken, requireAuth, ctrl.list);

/**
 * @route   GET /api/awards/units/annual/template
 * @desc    Tải file mẫu Excel để import khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireManager, ctrl.getTemplate);

/**
 * @route   POST /api/awards/units/annual/import
 * @desc    Import khen thưởng đơn vị hằng năm từ file Excel
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  auditLog({
    action: 'IMPORT',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'IMPORT'),
    getResourceId: () => null,
  }),
  ctrl.importFromExcel
);

/**
 * @route   GET /api/awards/units/annual/export
 * @desc    Xuất danh sách khen thưởng đơn vị hằng năm ra Excel
 * @access  ADMIN, MANAGER
 */
router.get('/export', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), ctrl.exportToExcel);

/**
 * @route   GET /api/awards/units/annual/statistics
 * @desc    Thống kê khen thưởng đơn vị hằng năm
 * @access  ADMIN, MANAGER
 */
router.get('/statistics', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), ctrl.getStatistics);

/**
 * @route   GET /api/awards/units/annual/history
 * @desc    Lấy toàn bộ lịch sử khen thưởng của 1 đơn vị (mảng)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/history', verifyToken, requireAuth, ctrl.getUnitAnnualAwards);

/**
 * @route   GET /api/awards/units/annual/profile/:don_vi_id
 * @desc    Lấy hồ sơ gợi ý hằng năm của đơn vị (tính toán tổng hợp)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/profile/:don_vi_id', verifyToken, requireAuth, ctrl.getUnitAnnualProfile);

/**
 * @route   GET /api/awards/units/annual/:id
 * @desc    Lấy chi tiết khen thưởng đơn vị hằng năm theo ID
 * @access  ADMIN, MANAGER, USER
 */
router.get('/:id', verifyToken, requireAuth, ctrl.getById);

/**
 * @route   POST /api/awards/units/annual
 * @desc    Tạo mới khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: 'CREATE',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  ctrl.upsert
);

/**
 * @route   PUT /api/awards/units/annual/:id
 * @desc    Cập nhật khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.put(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: 'UPDATE',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  ctrl.upsert
);

/**
 * @route   DELETE /api/awards/units/annual/:id
 * @desc    Xoá khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.delete(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: 'DELETE',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  ctrl.remove
);

/**
 * @route   POST /api/awards/units/annual/propose
 * @desc    Gửi đề xuất khen thưởng đơn vị hằng
 * @access  MANAGER
 */
router.post(
  '/propose',
  verifyToken,
  requireManager,
  auditLog({
    action: 'PROPOSE',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'PROPOSE'),
    getResourceId: () => null,
  }),
  ctrl.propose
);

/**
 * @route   POST /api/awards/units/annual/:id/approve
 * @desc    Duyệt đề xuất khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.post(
  '/:id/approve',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'APPROVE',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'APPROVE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  ctrl.approve
);

/**
 * @router   POST /api/awards/units/annual/:id/reject
 * @desc    Từ chối đề xuất khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.post(
  '/:id/reject',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'REJECT',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'REJECT'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  ctrl.reject
);

/**
 * @route   POST /api/awards/units/annual/recalculate
 * @desc    Tính lại khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.post(
  '/recalculate',
  verifyToken,
  requireManager,
  auditLog({
    action: 'RECALCULATE',
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'RECALCULATE'),
    getResourceId: () => null,
  }),
  ctrl.recalculate
);

/**
 * @route   POST /api/awards/units/annual/decision-files/:id/upload
 * @desc    Tải lên file PDF quyết định khen thưởng cho khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.get('/decision-files/:filename', verifyToken, requireAdmin, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File không tồn tại',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve PDF error:', error);
    res.status(500).json({ success: false, message: 'Không thể tải file' });
  }
});

module.exports = router;
