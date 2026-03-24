import { Router } from 'express';
import personnelController from '../controllers/personnel.controller';
import { verifyToken, requireAdmin, requireManager, requireAuth } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription, getResourceId } from '../helpers/auditLog';
import { excelUpload as upload } from '../configs/multer.config';
import { validate } from '../middlewares/validate';
import { personnelValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/personnel
 * @desc    Lấy danh sách quân nhân (có phân trang)
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
 * @desc    Kiểm tra tính đủ điều kiện nhận danh hiệu cống hiến
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
 * @desc    Lấy chi tiết 1 quân nhân
 * @access  Private - ADMIN, MANAGER, USER (chỉ xem của mình)
 */
router.get('/:id', verifyToken, requireAuth, personnelController.getPersonnelById);

/**
 * @route   POST /api/personnel
 * @desc    Thêm quân nhân mới
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
 * @desc    Cập nhật quân nhân (chuyển đơn vị, chức vụ)
 * @access  Private - ADMIN, MANAGER (cho đơn vị mình), USER (chỉ chính mình)
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
 * @desc    Import hàng loạt từ Excel
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
 * @desc    Xuất toàn bộ dữ liệu ra Excel
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
 * @desc    Xuất file mẫu Excel để import
 * @access  Private - ADMIN only
 */
router.get('/export-sample', verifyToken, requireAdmin, personnelController.exportPersonnelSample);

/**
 * @route   DELETE /api/personnel/:id
 * @desc    Xóa quân nhân và toàn bộ dữ liệu liên quan (cascade delete)
 *          Bao gồm: TaiKhoan, LichSuChucVu, ThanhTichKhoaHoc, DanhHieuHangNam,
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
