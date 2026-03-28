import { Router } from 'express';
import militaryFlagController from '../controllers/militaryFlag.controller';
import { verifyToken, checkRole, requireManager, requireAdmin } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/military-flag/template
 * @desc    Tải file mẫu Excel để import Huy chương Quân kỳ Quyết thắng
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireManager, militaryFlagController.getTemplate);

/**
 * @route   POST /api/military-flag/import/preview
 * @desc    Preview import HC QKQT — parse + validate file Excel
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  militaryFlagController.previewImport
);

/**
 * @route   POST /api/military-flag/import/confirm
 * @desc    Confirm import HC QKQT — lưu dữ liệu đã validate vào DB
 * @access  ADMIN
 */
router.post('/import/confirm', verifyToken, requireAdmin, militaryFlagController.confirmImport);

/**
 * @route   POST /api/military-flag/import
 * @desc    Import Huy chương Quân kỳ Quyết thắng từ file Excel (legacy)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  militaryFlagController.importFromExcel
);

/**
 * @route   GET /api/military-flag
 * @desc    Lấy danh sách Huy chương Quân kỳ Quyết thắng (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  militaryFlagController.getAll
);

/**
 * @route   GET /api/military-flag/export
 * @desc    Xuất file Excel Huy chương Quân kỳ Quyết thắng (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  militaryFlagController.exportToExcel
);

/**
 * @route   GET /api/military-flag/statistics
 * @desc    Thống kê Huy chương Quân kỳ Quyết thắng
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  militaryFlagController.getStatistics
);

/**
 * @route   GET /api/military-flag/personnel/:personnel_id
 * @desc    Lấy Huy chương Quân kỳ Quyết thắng theo personnel_id
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
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
    action: AUDIT_ACTIONS.DELETE,
    resource: 'military-flag',
    getDescription: getLogDescription('military-flag', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  militaryFlagController.deleteAward
);

export default router;
