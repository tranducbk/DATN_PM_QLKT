import { Router, Request, Response } from 'express';
import hccsvvController from '../controllers/hccsvv.controller';
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
 * @route   GET /api/hccsvv/template
 * @desc    Tải file mẫu Excel để import Huy chương Chiến sĩ Vẻ vang
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, hccsvvController.getTemplate);

/**
 * @route   POST /api/hccsvv/import/preview
 * @desc    Preview import HCCSVV — chỉ validate, không ghi DB
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  hccsvvController.previewImport
);

/**
 * @route   POST /api/hccsvv/import/confirm
 * @desc    Confirm import HCCSVV — lưu dữ liệu đã validate vào DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportHccsvv),
  hccsvvController.confirmImport
);

/**
 * @route   POST /api/hccsvv/import
 * @desc    Import Huy chương Chiến sĩ Vẻ vang từ file Excel
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  hccsvvController.importFromExcel
);

/**
 * @route   GET /api/hccsvv
 * @desc    Lấy danh sách Huy chương Chiến sĩ Vẻ vang (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get('/', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), hccsvvController.getAll);

/**
 * @route   GET /api/hccsvv/export
 * @desc    Xuất file Excel Huy chương Chiến sĩ Vẻ vang (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  hccsvvController.exportToExcel
);

/**
 * @route   GET /api/hccsvv/statistics
 * @desc    Thống kê Huy chương Chiến sĩ Vẻ vang theo hạng
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  hccsvvController.getStatistics
);

/**
 * @route   POST /api/hccsvv
 * @desc    Thêm khen thưởng HCCSVV trực tiếp (không cần tính điều kiện)
 * @access  SUPER_ADMIN
 */
router.post(
  '/',
  verifyToken,
  checkRole([ROLES.SUPER_ADMIN]),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'hccsvv',
    getDescription: getLogDescription('hccsvv', 'CREATE'),
    getResourceId: (req: Request, res: Response) => (res.locals.createdId as string) ?? null,
  }),
  hccsvvController.createDirect
);

/**
 * @route   DELETE /api/hccsvv/:id
 * @desc    Xóa khen thưởng HCCSVV (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'hccsvv',
    getDescription: getLogDescription('hccsvv', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  hccsvvController.deleteAward
);

export default router;
