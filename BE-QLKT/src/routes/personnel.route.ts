import { Router } from 'express';
import personnelController from '../controllers/personnel.controller';
import { verifyToken, requireAdmin, requireManager, requireAuth } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { excelUpload as upload } from '../configs/multer';
import { validate } from '../middlewares/validate';
import { personnelValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/personnel
 * @desc    List personnel with pagination
 * @access  Private - ADMIN, MANAGER
 */
router.get(
  '/',
  verifyToken,
  requireManager,
  validate(personnelValidation.listQuery, 'query'),
  personnelController.getPersonnel
);

/**
 * @route   POST /api/personnel/check-contribution-eligibility
 * @desc    Check personnel eligibility for Contribution Award
 * @access  Private - MANAGER
 */
router.post(
  '/check-contribution-eligibility',
  verifyToken,
  requireManager,
  personnelController.checkContributionEligibility
);

/**
 * @route   GET /api/personnel/:id
 * @desc    Get personnel details by ID
 * @access  Private - ADMIN, MANAGER, USER (own record only)
 */
router.get('/:id', verifyToken, requireAuth, personnelController.getPersonnelById);

/**
 * @route   POST /api/personnel
 * @desc    Create a new personnel record
 * @access  Private - ADMIN only
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  validate(personnelValidation.createPersonnel),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'CREATE'),
    getResourceId: getResourceId.fromResponse(),
  }),
  personnelController.createPersonnel
);

/**
 * @route   PUT /api/personnel/:id
 * @desc    Update a personnel record (unit transfer, position change)
 * @access  Private - ADMIN, MANAGER (own unit), USER (own record only)
 */
router.put(
  '/:id',
  verifyToken,
  requireManager,
  validate(personnelValidation.updatePersonnel),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  personnelController.updatePersonnel
);

/**
 * @route   POST /api/personnel/import
 * @desc    Bulk import personnel from Excel
 * @access  Private - ADMIN only
 */
router.post(
  '/import',
  verifyToken,
  requireAdmin,
  upload.single('file'),
  auditLog({
    action: AUDIT_ACTIONS.IMPORT,
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'IMPORT'),
  }),
  personnelController.importPersonnel
);

/**
 * @route   GET /api/personnel/export
 * @desc    Export all personnel data to Excel
 * @access  Private - ADMIN only
 */
router.get(
  '/export',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.EXPORT,
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'EXPORT'),
  }),
  personnelController.exportPersonnel
);

/**
 * @route   GET /api/personnel/export-sample
 * @desc    Download Excel sample template for personnel import
 * @access  Private - ADMIN only
 */
router.get('/export-sample', verifyToken, requireAdmin, personnelController.exportPersonnelSample);

/**
 * @route   DELETE /api/personnel/:id
 * @desc    Delete a personnel record and all related data (cascade delete)
 *          Includes: TaiKhoan, LichSuChucVu, ThanhTichKhoaHoc, DanhHieuHangNam,
 *          KhenThuongCongHien, HuanChuongQuanKyQuyetThang, KyNiemChuongVSNXDQDNDVN,
 *          KhenThuongHCCSVV, KhenThuongDotXuat, HoSoNienHan, HoSoCongHien, HoSoHangNam
 * @access  Private - ADMIN only
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  personnelController.deletePersonnel
);

export default router;
