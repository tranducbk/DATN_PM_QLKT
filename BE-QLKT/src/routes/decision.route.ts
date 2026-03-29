import { Router } from 'express';
import decisionController from '../controllers/decision.controller';
import { verifyToken, requireAdmin } from '../middlewares/auth';
import { auditLog, createDescription, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { validate } from '../middlewares/validate';
import { decisionValidation } from '../validations';
import { decisionUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

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
    action: AUDIT_ACTIONS.CREATE,
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
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
    action: AUDIT_ACTIONS.UPDATE,
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
    action: AUDIT_ACTIONS.DELETE,
    resource: 'decisions',
    getDescription: getLogDescription('decisions', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  decisionController.deleteDecision
);

export default router;
