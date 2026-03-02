const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unit.controller');
const { verifyToken, requireAdmin, requireManager } = require('../middlewares/auth');
const { auditLog, createDescription, getResourceId } = require('../middlewares/auditLog');
const { getLogDescription } = require('../helpers/auditLogHelper');

/**
 * @route   GET /api/units/my-units
 * @desc    Lấy đơn vị của Manager và các đơn vị con
 * @access  Private - MANAGER
 */
router.get('/my-units', verifyToken, requireManager, unitController.getMyUnits);

/**
 * @route   GET /api/units
 * @desc    Lấy tất cả cơ quan đơn vị và đơn vị trực thuộc (?hierarchy=true để lấy theo cấu trúc cây)
 * @access  Private - ADMIN and above
 */
router.get('/', verifyToken, requireAdmin, unitController.getAllUnits);

/**
 * @route   GET /api/units/:id
 * @desc    Lấy chi tiết cơ quan đơn vị hoặc đơn vị trực thuộc với cấu trúc cây
 * @access  Private - ADMIN and above
 */
router.get('/:id', verifyToken, requireAdmin, unitController.getUnitById);

/**
 * @route   POST /api/units
 * @desc    Tạo cơ quan đơn vị mới hoặc đơn vị trực thuộc (nếu có co_quan_don_vi_id)
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'CREATE',
    resource: 'units',
    getDescription: getLogDescription('units', 'CREATE'),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  unitController.createUnit
);

/**
 * @route   PUT /api/units/:id
 * @desc    Sửa cơ quan đơn vị hoặc đơn vị trực thuộc (mã, tên, co_quan_don_vi_id)
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'UPDATE',
    resource: 'units',
    getDescription: getLogDescription('units', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitController.updateUnit
);

/**
 * @route   DELETE /api/units/:id
 * @desc    Xóa cơ quan đơn vị hoặc đơn vị trực thuộc
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'units',
    getDescription: getLogDescription('units', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  unitController.deleteUnit
);

module.exports = router;
