const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const decisionController = require('../controllers/decision.controller');
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const { auditLog, createDescription, getResourceId } = require('../middlewares/auditLog');
const { getLogDescription } = require('../helpers/auditLog');
const { validate } = require('../middlewares/validate');
const { decisionValidation } = require('../validations');

// Cấu hình multer để lưu file vào thư mục uploads/decisions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'decisions');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Giữ nguyên tên file gốc, thêm số thứ tự nếu trùng
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); // Xử lý tên file có ký tự đặc biệt
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    let filename = originalName;
    let counter = 1;
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'decisions');

    // Kiểm tra nếu file đã tồn tại, thêm số thứ tự
    while (fs.existsSync(path.join(uploadDir, filename))) {
      filename = `${baseName}(${counter})${ext}`;
      counter++;
    }

    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file PDF, DOC, DOCX'));
    }
  },
});

/**
 * @route   GET /api/decisions
 * @desc    Lấy tất cả quyết định khen thưởng (?nam=2024&loai_khen_thuong=...&search=...&page=1&limit=50)
 * @access  Private - ADMIN and above
 */
router.get('/', verifyToken, requireAdmin, decisionController.getAllDecisions);

/**
 * @route   GET /api/decisions/autocomplete
 * @desc    Autocomplete tìm kiếm quyết định (?q=123&limit=10)
 * @access  Private - ADMIN and above
 */
router.get('/autocomplete', verifyToken, requireAdmin, decisionController.autocomplete);

/**
 * @route   GET /api/decisions/years
 * @desc    Lấy danh sách năm có quyết định
 * @access  Private - ADMIN and above
 */
router.get('/years', verifyToken, requireAdmin, decisionController.getAvailableYears);

/**
 * @route   GET /api/decisions/award-types
 * @desc    Lấy danh sách loại khen thưởng
 * @access  Private - ADMIN and above
 */
router.get('/award-types', verifyToken, requireAdmin, decisionController.getAwardTypes);

/**
 * @route   GET /api/decisions/file-path/:soQuyetDinh
 * @desc    Lấy file path từ số quyết định (encode URI cho số quyết định có ký tự đặc biệt)
 * @access  Private - All authenticated users
 */
router.get('/file-path/:soQuyetDinh', verifyToken, decisionController.getFilePath);

/**
 * @route   GET /api/decisions/download/:soQuyetDinh
 * @desc    Tải file quyết định theo số quyết định (backend tự query DB để lấy file path)
 * @access  Private - All authenticated users
 */
router.get('/download/:soQuyetDinh', verifyToken, decisionController.downloadDecisionFile);

/**
 * @route   POST /api/decisions/file-paths
 * @desc    Lấy file paths từ nhiều số quyết định
 * @access  Private - All authenticated users
 * @body    { soQuyetDinhs: ['SQD001', 'SQD002', ...] }
 */
router.post('/file-paths', verifyToken, decisionController.getFilePaths);

/**
 * @route   GET /api/decisions/by-number/:soQuyetDinh
 * @desc    Lấy quyết định theo số quyết định
 * @access  Private - ADMIN and above
 */
router.get(
  '/by-number/:soQuyetDinh',
  verifyToken,
  requireAdmin,
  decisionController.getDecisionBySoQuyetDinh
);

/**
 * @route   GET /api/decisions/:id
 * @desc    Lấy chi tiết quyết định theo ID
 * @access  Private - ADMIN and above
 */
router.get('/:id', verifyToken, requireAdmin, decisionController.getDecisionById);

/**
 * @route   POST /api/decisions
 * @desc    Tạo quyết định mới
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  auditLog({
    action: 'CREATE',
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'CREATE'),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  decisionController.createDecision
);

/**
 * @route   PUT /api/decisions/:id
 * @desc    Cập nhật quyết định
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  auditLog({
    action: 'UPDATE',
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  decisionController.updateDecision
);

/**
 * @route   DELETE /api/decisions/:id
 * @desc    Xóa quyết định
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  decisionController.deleteDecision
);

module.exports = router;
