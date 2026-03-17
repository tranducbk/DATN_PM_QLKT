const router = require('express').Router();
const multer = require('multer');
const proposalController = require('../controllers/proposal.controller');
const awardBulkController = require('../controllers/awardBulk.controller');
const { verifyToken, checkRole, requireAdmin } = require('../middlewares/auth');
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
// ROUTES - QUẢN LÝ KHEN THƯỞNG
// ============================================

/**
 * @route   GET /api/awards/template
 * @desc    Tải file mẫu Excel để import khen thưởng
 * @access  ADMIN
 */
router.get(
  '/template',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.getAwardsTemplate
);

/**
 * @route   POST /api/awards/import
 * @desc    Import khen thưởng từ file Excel
 * @access  ADMIN
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN]),
  upload.single('file'),
  proposalController.importAwards
);

/**
 * @route   GET /api/awards
 * @desc    Lấy danh sách tất cả khen thưởng (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), proposalController.getAllAwards);

/**
 * @route   GET /api/awards/export
 * @desc    Xuất file Excel tổng hợp khen thưởng (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.exportAllAwardsExcel
);

/**
 * @route   GET /api/awards/statistics
 * @desc    Thống kê khen thưởng theo loại
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  proposalController.getAwardsStatistics
);

/**
 * @route   POST /api/awards/bulk
 * @desc    Thêm khen thưởng đồng loạt với validation đầy đủ
 * @access  ADMIN
 */
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
router.post(
  '/bulk',
  verifyToken,
  requireAdmin,
  bulkUpload.fields([{ name: 'attached_files', maxCount: 10 }]),
  auditLog({
    action: 'BULK',
    resource: 'awards',
    getDescription: getLogDescription('awards', 'BULK'),
    getResourceId: () => null, // Bulk operation không có single resource ID
    getPayload: (req, res, responseData) => {
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const result = data?.data || data || {};

        // Parse request body
        let type = req.body?.type || '';
        let nam = req.body?.nam || '';
        let selectedPersonnel = req.body?.selected_personnel || [];
        let selectedUnits = req.body?.selected_units || [];
        let titleData = req.body?.title_data || [];

        // Parse JSON strings nếu cần
        if (typeof selectedPersonnel === 'string') {
          try {
            selectedPersonnel = JSON.parse(selectedPersonnel);
          } catch (e) {
            // Ignore
          }
        }
        if (typeof selectedUnits === 'string') {
          try {
            selectedUnits = JSON.parse(selectedUnits);
          } catch (e) {
            // Ignore
          }
        }
        if (typeof titleData === 'string') {
          try {
            titleData = JSON.parse(titleData);
          } catch (e) {
            // Ignore
          }
        }

        return {
          type,
          nam: nam ? parseInt(nam) : null,
          selected_personnel_count: Array.isArray(selectedPersonnel) ? selectedPersonnel.length : 0,
          selected_units_count: Array.isArray(selectedUnits) ? selectedUnits.length : 0,
          title_data_count: Array.isArray(titleData) ? titleData.length : 0,
          imported_count: result?.importedCount || 0,
          error_count: result?.errorCount || 0,
          affected_personnel_ids: result?.affectedPersonnelIds || [],
          has_attached_files: req.files?.attached_files?.length > 0,
          attached_files_count: req.files?.attached_files?.length || 0,
        };
      } catch (error) {
        console.error('Error creating bulk awards payload:', error);
        return null;
      }
    },
  }),
  awardBulkController.bulkCreateAwards
);

module.exports = router;
