import { Router } from 'express';
import proposalController from '../controllers/proposal.controller';
import { verifyToken, checkRole } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { writeLimiter } from '../configs/rateLimiter';
import { documentUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/proposals/template
 * @desc    Xuất file mẫu Excel
 * @access  MANAGER, ADMIN
 */
router.get(
  '/template',
  verifyToken,
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
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
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  writeLimiter,
  upload.fields([
    { name: 'attached_files' }, // No file count limit
  ]),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
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
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
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
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  proposalController.checkDuplicateUnitAward
);

/**
 * @route   POST /api/proposals/check-duplicate-batch
 * @desc    Kiểm tra hàng loạt quân nhân trùng đề xuất (dùng cho Excel import)
 * @access  MANAGER, ADMIN
 */
router.post(
  '/check-duplicate-batch',
  verifyToken,
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  proposalController.checkDuplicateBatch
);

/**
 * @route   POST /api/proposals/check-duplicate-unit-batch
 * @desc    Kiểm tra hàng loạt đơn vị trùng đề xuất (dùng cho Excel import)
 * @access  MANAGER, ADMIN
 */
router.post(
  '/check-duplicate-unit-batch',
  verifyToken,
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  proposalController.checkDuplicateUnitBatch
);

/**
 * @route   GET /api/proposals
 * @desc    Lấy danh sách đề xuất
 * @access  MANAGER, ADMIN
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  proposalController.getProposals
);

/**
 * @route   GET /api/proposals/:id
 * @desc    Lấy chi tiết 1 đề xuất
 * @access  MANAGER, ADMIN
 */
router.get(
  '/:id',
  verifyToken,
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
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
  checkRole([ROLES.ADMIN]),
  writeLimiter,
  upload.fields([
    { name: 'file_pdf_ca_nhan_hang_nam', maxCount: 1 }, // CA_NHAN_HANG_NAM
    { name: 'file_pdf_don_vi_hang_nam', maxCount: 1 }, // DON_VI_HANG_NAM
    { name: 'file_pdf_nien_han', maxCount: 1 }, // NIEN_HAN
    { name: 'file_pdf_cong_hien', maxCount: 1 }, // CONG_HIEN
    { name: 'file_pdf_dot_xuat', maxCount: 1 }, // DOT_XUAT
    { name: 'file_pdf_nckh', maxCount: 1 }, // NCKH
  ]),
  auditLog({
    action: AUDIT_ACTIONS.APPROVE,
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
  checkRole([ROLES.ADMIN]),
  auditLog({
    action: AUDIT_ACTIONS.REJECT,
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
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
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
  checkRole([ROLES.MANAGER, ROLES.ADMIN, ROLES.USER]),
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
  checkRole([ROLES.MANAGER, ROLES.ADMIN]),
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'proposals',
    getDescription: getLogDescription('proposals', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  proposalController.deleteProposal
);

export default router;
