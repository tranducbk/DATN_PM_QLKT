import { Router } from 'express';
import commemorativeMedalController from '../controllers/commemorativeMedal.controller';
import { verifyToken, checkRole, requireAdmin } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/commemorative-medals/template
 * @desc    Tải file mẫu Excel để import Kỷ niệm chương
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, commemorativeMedalController.getTemplate);

/**
 * @route   POST /api/commemorative-medals/import/preview
 * @desc    Preview import KNC VSNXD từ file Excel (chỉ validate, không ghi DB)
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  commemorativeMedalController.previewImport
);

/**
 * @route   POST /api/commemorative-medals/import/confirm
 * @desc    Confirm import KNC VSNXD — lưu dữ liệu đã validate vào DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportCommemorativeMedal),
  commemorativeMedalController.confirmImport
);

/**
 * @route   POST /api/commemorative-medals/import
 * @desc    Import Kỷ niệm chương từ file Excel (legacy — direct import)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  commemorativeMedalController.importFromExcel
);

/**
 * @route   GET /api/commemorative-medals
 * @desc    Lấy danh sách Kỷ niệm chương (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  commemorativeMedalController.getAll
);

/**
 * @route   GET /api/commemorative-medals/export
 * @desc    Xuất file Excel Kỷ niệm chương (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  commemorativeMedalController.exportToExcel
);

/**
 * @route   GET /api/commemorative-medals/statistics
 * @desc    Thống kê Kỷ niệm chương
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  commemorativeMedalController.getStatistics
);

/**
 * @route   GET /api/commemorative-medals/personnel/:personnel_id
 * @desc    Lấy Kỷ niệm chương VSNXD QĐNDVN theo personnel_id
 * @access  ADMIN, MANAGER, USER
 */
router.get(
  '/personnel/:personnel_id',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]),
  commemorativeMedalController.getByPersonnelId
);

/**
 * @route   DELETE /api/commemorative-medals/:id
 * @desc    Xóa khen thưởng KNC VSNXD (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'commemorative-medals',
    getDescription: getLogDescription('commemorative-medals', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  commemorativeMedalController.deleteAward
);

export default router;
