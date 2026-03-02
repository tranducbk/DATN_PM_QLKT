const router = require('express').Router();
const multer = require('multer');
const proposalController = require('../controllers/proposal.controller');
const { verifyToken, checkRole } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLogHelper');

// Cấu hình multer để xử lý file upload (lưu vào memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn 10MB
  },
  fileFilter: (req, file, cb) => {
    // Chấp nhận file Excel, PDF, và Word
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/pdf', // .pdf
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls), PDF (.pdf), hoặc Word (.doc, .docx)'));
    }
  },
});

// ============================================
// ROUTES
// ============================================

/**
 * @route   GET /api/proposals/template
 * @desc    Xuất file mẫu Excel
 * @access  MANAGER, ADMIN
 */
router.get(
  '/template',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  proposalController.exportTemplate
);

/**
 * @route   POST /api/proposals
 * @desc    Nộp đề xuất khen thưởng với nhiều file đính kèm không giới hạn
 * @access  MANAGER, ADMIN
 */
router.post(
  '/',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  upload.fields([
    { name: 'attached_files' }, // Không giới hạn số lượng file
  ]),
  auditLog({
    action: 'CREATE',
    resource: 'proposals',
    getDescription: getLogDescription('proposals', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  proposalController.submitProposal
);

/**
 * @route   GET /api/proposals/check-duplicate
 * @desc    Kiểm tra xem quân nhân đã có đề xuất cùng năm và cùng danh hiệu chưa
 * @access  MANAGER, ADMIN
 */
router.get(
  '/check-duplicate',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  proposalController.checkDuplicateAward
);

/**
 * @route   GET /api/proposals/check-duplicate-unit
 * @desc    Kiểm tra xem đơn vị đã có đề xuất cùng năm và cùng danh hiệu chưa
 * @access  MANAGER, ADMIN
 */
router.get(
  '/check-duplicate-unit',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  proposalController.checkDuplicateUnitAward
);

/**
 * @route   GET /api/proposals
 * @desc    Lấy danh sách đề xuất
 * @access  MANAGER, ADMIN
 */
router.get('/', verifyToken, checkRole(['MANAGER', 'ADMIN']), proposalController.getProposals);

/**
 * @route   GET /api/proposals/:id
 * @desc    Lấy chi tiết 1 đề xuất
 * @access  MANAGER, ADMIN
 */
router.get(
  '/:id',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  proposalController.getProposalById
);

/**
 * @route   POST /api/proposals/:id/approve
 * @desc    Phê duyệt đề xuất và import vào CSDL
 * @access  ADMIN
 */
router.post(
  '/:id/approve',
  verifyToken,
  checkRole(['ADMIN']),
  upload.fields([
    // File PDF cho từng loại đề xuất
    { name: 'file_pdf_ca_nhan_hang_nam', maxCount: 1 }, // CA_NHAN_HANG_NAM
    { name: 'file_pdf_don_vi_hang_nam', maxCount: 1 }, // DON_VI_HANG_NAM
    { name: 'file_pdf_nien_han', maxCount: 1 }, // NIEN_HAN
    { name: 'file_pdf_cong_hien', maxCount: 1 }, // CONG_HIEN
    { name: 'file_pdf_dot_xuat', maxCount: 1 }, // DOT_XUAT
    { name: 'file_pdf_nckh', maxCount: 1 }, // NCKH
  ]),
  auditLog({
    action: 'APPROVE',
    resource: 'proposals',
    getDescription: getLogDescription('proposals', 'APPROVE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.approveProposal
);

/**
 * @route   POST /api/proposals/:id/reject
 * @desc    Từ chối đề xuất với lý do
 * @access  ADMIN
 */
router.post(
  '/:id/reject',
  verifyToken,
  checkRole(['ADMIN']),
  auditLog({
    action: 'REJECT',
    resource: 'proposals',
    getDescription: getLogDescription('proposals', 'REJECT'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.rejectProposal
);

/**
 * @route   GET /api/proposals/:id/download-excel
 * @desc    Tải file Excel của đề xuất
 * @access  MANAGER, ADMIN
 */
router.get(
  '/:id/download-excel',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  proposalController.downloadProposalExcel
);

/**
 * @route   GET /api/proposals/uploads/:filename
 * @desc    Lấy file PDF đã upload
 * @access  MANAGER, ADMIN
 */
router.get(
  '/uploads/:filename',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN', 'USER']),
  proposalController.getPdfFile
);

/**
 * @route   DELETE /api/proposals/:id
 * @desc    Xóa đề xuất (Manager chỉ có thể xóa đề xuất của chính mình, status = PENDING)
 * @access  MANAGER, ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  checkRole(['MANAGER', 'ADMIN']),
  auditLog({
    action: 'DELETE',
    resource: 'proposals',
    getDescription: getLogDescription('proposals', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.deleteProposal
);

module.exports = router;
