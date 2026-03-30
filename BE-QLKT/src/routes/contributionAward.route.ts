import { Router } from 'express';
import contributionAwardController from '../controllers/contributionAward.controller';
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
 * @route   GET /api/contribution-awards/template
 * @desc    Tải file mẫu Excel để import Huân chương Bảo vệ Tổ quốc (hỗ trợ ?personnel_ids=id1,id2)
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireAdmin, contributionAwardController.getTemplate);

/**
 * @route   POST /api/contribution-awards/import/preview
 * @desc    Preview import HCBVTQ — chỉ validate, không ghi DB
 * @access  ADMIN
 */
router.post(
  '/import/preview',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  contributionAwardController.previewImport
);

/**
 * @route   POST /api/contribution-awards/import/confirm
 * @desc    Confirm import HCBVTQ — lưu dữ liệu đã validate vào DB
 * @access  ADMIN
 */
router.post(
  '/import/confirm',
  verifyToken,
  requireAdmin,
  validate(excelImportValidation.confirmImportContributionAward),
  contributionAwardController.confirmImport
);

/**
 * @route   GET /api/contribution-awards
 * @desc    Lấy danh sách Huân chương Bảo vệ Tổ quốc (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.getAll
);

/**
 * @route   GET /api/contribution-awards/export
 * @desc    Xuất file Excel Huân chương Bảo vệ Tổ quốc (Admin: tất cả, Manager: đơn vị mình)
 * @access  ADMIN, MANAGER
 */
router.get(
  '/export',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.exportToExcel
);

/**
 * @route   GET /api/contribution-awards/statistics
 * @desc    Thống kê Huân chương Bảo vệ Tổ quốc theo hạng
 * @access  ADMIN, MANAGER
 */
router.get(
  '/statistics',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  contributionAwardController.getStatistics
);

/**
 * @route   DELETE /api/contribution-awards/:id
 * @desc    Xóa khen thưởng HCBVTQ (không xóa đề xuất)
 * @access  ADMIN
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'contribution-awards',
    getDescription: getLogDescription('contribution-awards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  contributionAwardController.deleteAward
);

export default router;
