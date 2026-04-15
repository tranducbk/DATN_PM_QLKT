import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import unitAnnualAwardController from '../controllers/unitAnnualAward.controller';
import {
  verifyToken,
  requireManager,
  requireAuth,
  requireAdmin,
  checkRole,
} from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { ROLES } from '../constants/roles.constants';
import {
  excelUpload as upload,
  decisionUploadDir as uploadDir,
} from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/awards/units/annual
 * @desc    Lấy danh sách khen thưởng đơn vị hằng năm (Admin: tất cả, Manager: đơn vị mình, User: đơn vị mình)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/', verifyToken, requireManager, unitAnnualAwardController.list);

/**
 * @route   GET /api/awards/units/annual/template
 * @desc    Tải file mẫu Excel để import khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.get('/template', verifyToken, requireManager, unitAnnualAwardController.getTemplate);

/**
 * @route   POST /api/awards/units/annual/import/preview
 * @desc    Preview import khen thưởng đơn vị hằng năm từ file Excel (chỉ validate, không ghi DB)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import/preview',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  unitAnnualAwardController.previewImport
);

/**
 * @route   POST /api/awards/units/annual/import/confirm
 * @desc    Confirm import khen thưởng đơn vị hằng năm (lưu dữ liệu đã validate vào DB)
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import/confirm',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  validate(excelImportValidation.confirmImportUnitAnnualAward),
  unitAnnualAwardController.confirmImport
);

/**
 * @route   POST /api/awards/units/annual/import
 * @desc    Import khen thưởng đơn vị hằng năm từ file Excel
 * @access  ADMIN, MANAGER
 */
router.post(
  '/import',
  verifyToken,
  checkRole([ROLES.ADMIN, ROLES.MANAGER]),
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.IMPORT,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'IMPORT'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.importFromExcel
);

/**
 * @route   GET /api/awards/units/annual/export
 * @desc    Xuất danh sách khen thưởng đơn vị hằng năm ra Excel
 * @access  ADMIN, MANAGER
 */
router.get('/export', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), unitAnnualAwardController.exportToExcel);

/**
 * @route   GET /api/awards/units/annual/statistics
 * @desc    Thống kê khen thưởng đơn vị hằng năm
 * @access  ADMIN, MANAGER
 */
router.get('/statistics', verifyToken, checkRole([ROLES.ADMIN, ROLES.MANAGER]), unitAnnualAwardController.getStatistics);

/**
 * @route   GET /api/awards/units/annual/history
 * @desc    Lấy toàn bộ lịch sử khen thưởng của 1 đơn vị (mảng)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/history', verifyToken, requireManager, unitAnnualAwardController.getUnitAnnualAwards);

/**
 * @route   GET /api/awards/units/annual/profile/:don_vi_id
 * @desc    Lấy hồ sơ gợi ý hằng năm của đơn vị (tính toán tổng hợp)
 * @access  ADMIN, MANAGER, USER
 */
router.get('/profile/:don_vi_id', verifyToken, requireManager, unitAnnualAwardController.getUnitAnnualProfile);

/**
 * @route   GET /api/awards/units/annual/:id
 * @desc    Lấy chi tiết khen thưởng đơn vị hằng năm theo ID
 * @access  ADMIN, MANAGER
 */
router.get('/:id', verifyToken, requireManager, unitAnnualAwardController.getById);

/**
 * @route   POST /api/awards/units/annual
 * @desc    Tạo mới khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.post(
  '/',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   PUT /api/awards/units/annual/:id
 * @desc    Cập nhật khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.put(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   DELETE /api/awards/units/annual/:id
 * @desc    Xoá khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.delete(
  '/:id',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.remove
);

/**
 * @route   POST /api/awards/units/annual/propose
 * @desc    Gửi đề xuất khen thưởng đơn vị hằng
 * @access  MANAGER
 */
router.post(
  '/propose',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.PROPOSE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'PROPOSE'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.propose
);

/**
 * @route   POST /api/awards/units/annual/:id/approve
 * @desc    Duyệt đề xuất khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.post(
  '/:id/approve',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.APPROVE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'APPROVE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.approve
);

/**
 * @router   POST /api/awards/units/annual/:id/reject
 * @desc    Từ chối đề xuất khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.post(
  '/:id/reject',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.REJECT,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'REJECT'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.reject
);

/**
 * @route   POST /api/awards/units/annual/recalculate
 * @desc    Tính lại khen thưởng đơn vị hằng năm
 * @access  MANAGER
 */
router.post(
  '/recalculate',
  verifyToken,
  requireManager,
  auditLog({
    action: AUDIT_ACTIONS.RECALCULATE,
    resource: 'unit-annual-awards',
    getDescription: getLogDescription('unit-annual-awards', 'RECALCULATE'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.recalculate
);

/**
 * @route   POST /api/awards/units/annual/decision-files/:id/upload
 * @desc    Tải lên file PDF quyết định khen thưởng cho khen thưởng đơn vị hằng năm
 * @access  ADMIN
 */
router.get(
  '/decision-files/:filename',
  verifyToken,
  requireAdmin,
  (req: Request, res: Response) => {
    try {
      const filename = path.basename(String(req.params.filename ?? ''));
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
      res.status(500).json({ success: false, message: 'Không thể tải file' });
    }
  }
);

export default router;
