const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const annualRewardController = require('../controllers/annualReward.controller');
const {
  verifyToken,
  requireManager,
  requireAuth,
  requireAdmin,
  checkRole,
} = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLogHelper');

// Memory storage để xử lý file Excel từ buffer
const upload = multer({ storage: multer.memoryStorage() });

// Disk storage để lưu file PDF quyết định
const uploadDir = path.join(__dirname, '../../uploads/decisions');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique: timestamp-original-name.pdf
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

router.get('/', verifyToken, requireAuth, annualRewardController.getAnnualRewards);

// Kiểm tra quân nhân đã nhận HC QKQT chưa
router.get(
  '/check-hcqkqt/:personnelId',
  verifyToken,
  requireAuth,
  annualRewardController.checkAlreadyReceivedHCQKQT
);

// Kiểm tra quân nhân đã nhận KNC VSNXD chưa
router.get(
  '/check-knc-vsnxd/:personnelId',
  verifyToken,
  requireAuth,
  annualRewardController.checkAlreadyReceivedKNCVSNXD
);

router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: 'CREATE',
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  annualRewardController.createAnnualReward
);
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'UPDATE',
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  annualRewardController.updateAnnualReward
);
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  annualRewardController.deleteAnnualReward
);

// Kiểm tra quân nhân đã có khen thưởng hoặc đề xuất cho năm đó chưa
router.post(
  '/check',
  verifyToken,
  requireAdmin,
  annualRewardController.checkAnnualRewards
);

// Thêm danh hiệu đồng loạt cho nhiều quân nhân (có thể kèm file đính kèm)
router.post(
  '/bulk',
  verifyToken,
  requireAdmin,
  pdfUpload.single('file_dinh_kem'),
  auditLog({
    action: 'BULK',
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'BULK'),
    getResourceId: () => null, // Bulk operation không có single resource ID
  }),
  annualRewardController.bulkCreateAnnualRewards
);

// Import danh hiệu hằng năm từ Excel
router.post(
  '/import',
  verifyToken,
  requireManager,
  upload.single('file'),
  auditLog({
    action: 'IMPORT',
    resource: 'annual-rewards',
    getDescription: getLogDescription('annual-rewards', 'IMPORT'),
    getResourceId: () => null, // Import operation không có single resource ID
  }),
  annualRewardController.importAnnualRewards
);

// Tải file mẫu Excel
router.get('/template', verifyToken, requireManager, annualRewardController.getTemplate);

// Xuất danh sách ra Excel
router.get(
  '/export',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  annualRewardController.exportToExcel
);

// Thống kê khen thưởng cá nhân hằng năm
router.get(
  '/statistics',
  verifyToken,
  checkRole(['ADMIN', 'MANAGER']),
  annualRewardController.getStatistics
);

// Serve file PDF quyết định
router.get('/decision-files/:filename', verifyToken, (req, res) => {
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
    res.status(500).json({
      success: false,
      message: 'Không thể tải file',
    });
  }
});

module.exports = router;
