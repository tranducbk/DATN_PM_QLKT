/*
 * UNIT ANNUAL AWARD ROUTE — danh hiệu đơn vị hàng năm.
 * Bao gồm: list, get-by-id, profile, history, upsert (create/update), delete,
 * recalculate, statistics. Excel: /template, /import (preview + confirm), /export.
 * Chuỗi đơn vị: ĐVQT → BKBQP đơn vị → BKTTCP đơn vị (xem unitAnnualAward/eligibility.ts).
 */

import { Router } from 'express';
import unitAnnualAwardController from '../controllers/unitAnnualAward.controller';
import { verifyToken, requireAdminOrManager, requireAdminOnly } from '../middlewares/auth';
import { auditLog, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { excelUpload as upload } from '../configs/multer';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { validate } from '../middlewares/validate';
import { excelImportValidation, unitAnnualAwardValidation } from '../validations';

const router = Router();

/**
 * @route   GET /api/unit-annual-awards
 * @desc    List unit annual awards (Admin: all units, Manager/User: own unit)
 * @access  ADMIN, MANAGER
 */
// Liệt kê danh hiệu đơn vị; MANAGER chỉ thấy đơn vị mình → ADMIN+MANAGER.
router.get(
  '/',
  verifyToken,
  requireAdminOrManager,
  validate(unitAnnualAwardValidation.listUnitAnnualAwardsQuery, 'query'),
  unitAnnualAwardController.list
);

/**
 * @route   GET /api/unit-annual-awards/template
 * @desc    Download Excel template for unit annual award import
 * @access  ADMIN, MANAGER
 */
// Tải Excel mẫu nhập danh hiệu đơn vị: chỉ ADMIN.
router.get('/template', verifyToken, requireAdminOnly, unitAnnualAwardController.getTemplate);

/**
 * @route   POST /api/unit-annual-awards/import/preview
 * @desc    Preview unit annual award import — validate only, no DB write
 * @access  ADMIN only (Excel import is ADMIN-only)
 */
// Xem trước import Excel (chỉ validate, chưa ghi DB): ADMIN-only.
router.post(
  '/import/preview',
  verifyToken,
  requireAdminOnly,
  upload.single('file'),
  unitAnnualAwardController.previewImport
);

/**
 * @route   POST /api/unit-annual-awards/import/confirm
 * @desc    Confirm unit annual award import — persist validated data to DB
 * @access  ADMIN only (Excel import is ADMIN-only)
 */
// Xác nhận import (ghi vào DB dữ liệu đã validate): ADMIN-only.
router.post(
  '/import/confirm',
  verifyToken,
  requireAdminOnly,
  validate(excelImportValidation.confirmImportUnitAnnualAward),
  unitAnnualAwardController.confirmImport
);

/**
 * @route   GET /api/unit-annual-awards/export
 * @desc    Export unit annual awards to Excel
 * @access  ADMIN, MANAGER
 */
// Xuất danh hiệu đơn vị ra Excel: chỉ ADMIN.
router.get(
  '/export',
  verifyToken,
  requireAdminOnly,
  validate(unitAnnualAwardValidation.exportUnitAnnualAwardsQuery, 'query'),
  unitAnnualAwardController.exportToExcel
);

/**
 * @route   GET /api/unit-annual-awards/statistics
 * @desc    Get unit annual award statistics
 * @access  ADMIN, MANAGER
 */
// Thống kê danh hiệu đơn vị: ADMIN+MANAGER.
router.get(
  '/statistics',
  verifyToken,
  requireAdminOrManager,
  validate(unitAnnualAwardValidation.getUnitAnnualAwardsStatisticsQuery, 'query'),
  unitAnnualAwardController.getStatistics
);

/**
 * @route   GET /api/unit-annual-awards/history
 * @desc    List all award history for a unit
 * @access  ADMIN, MANAGER
 */
// Lịch sử khen thưởng của 1 đơn vị: ADMIN+MANAGER.
router.get('/history', verifyToken, requireAdminOrManager, unitAnnualAwardController.getUnitAnnualAwards);

/**
 * @route   GET /api/unit-annual-awards/profile/:don_vi_id
 * @desc    Get annual award profile for a unit (computed summary)
 * @access  ADMIN, MANAGER
 */
// Hồ sơ tính toán điều kiện chuỗi danh hiệu của 1 đơn vị: ADMIN+MANAGER.
router.get(
  '/profile/:don_vi_id',
  verifyToken,
  requireAdminOrManager,
  unitAnnualAwardController.getUnitAnnualProfile
);

/**
 * @route   GET /api/unit-annual-awards/:id
 * @desc    Get unit annual award details by ID
 * @access  ADMIN, MANAGER
 */
// Chi tiết 1 danh hiệu theo id: ADMIN+MANAGER. Khai báo SAU các path tĩnh
// (/template, /export, /history...) để '/:id' không nuốt nhầm chúng.
router.get('/:id', verifyToken, requireAdminOrManager, unitAnnualAwardController.getById);

/**
 * @route   POST /api/unit-annual-awards
 * @desc    Create a unit annual award (admin direct entry of a granted award)
 * @access  ADMIN only
 */
// Admin nhập trực tiếp 1 danh hiệu đã trao (bỏ qua quy trình đề xuất → duyệt) → chỉ ADMIN.
// Admin direct entry — award is granted immediately, restricted to ADMIN
router.post(
  '/',
  verifyToken,
  requireAdminOnly,
  validate(unitAnnualAwardValidation.upsertUnitAnnualAward),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   PUT /api/unit-annual-awards/:id
 * @desc    Update a unit annual award (admin direct entry of a granted award)
 * @access  ADMIN only
 */
// Sửa danh hiệu đơn vị (nhập trực tiếp): chỉ ADMIN.
router.put(
  '/:id',
  verifyToken,
  requireAdminOnly,
  validate(unitAnnualAwardValidation.upsertUnitAnnualAward),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.upsert
);

/**
 * @route   DELETE /api/unit-annual-awards/:id
 * @desc    Delete a unit annual award
 * @access  ADMIN, MANAGER
 */
// Xóa danh hiệu đơn vị: chỉ ADMIN.
router.delete(
  '/:id',
  verifyToken,
  requireAdminOnly,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitAnnualAwardController.remove
);

/**
 * @route   POST /api/unit-annual-awards/recalculate
 * @desc    Recalculate unit annual awards
 * @access  ADMIN, MANAGER
 */
// Tính lại điều kiện chuỗi danh hiệu đơn vị: ADMIN+MANAGER.
router.post(
  '/recalculate',
  verifyToken,
  requireAdminOrManager,
  auditLog({
    action: AUDIT_ACTIONS.RECALCULATE,
    resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
    getDescription: getLogDescription(AWARD_SLUGS.UNIT_ANNUAL_AWARDS, 'RECALCULATE'),
    getResourceId: () => null,
  }),
  unitAnnualAwardController.recalculate
);

export default router;
