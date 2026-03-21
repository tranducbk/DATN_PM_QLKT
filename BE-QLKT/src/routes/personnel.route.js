const express = require('express');
const router = express.Router();
const personnelController = require('../controllers/personnel.controller');
const { verifyToken, requireAdmin, requireManager, requireAuth } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription, getResourceId } = require('../helpers/auditLog');
const { excelUpload: upload } = require('../configs/multer.config');
const { validate } = require('../middlewares/validate');
const { personnelValidation } = require('../validations');

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
    action: 'CREATE',
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'CREATE'),
    getResourceId: getResourceId.fromResponse('id'),
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
    action: 'UPDATE',
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
    action: 'IMPORT',
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
    action: 'EXPORT',
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
    action: 'DELETE',
    resource: 'personnel',
    getDescription: getLogDescription('personnel', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  personnelController.deletePersonnel
);

module.exports = router;
