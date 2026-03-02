const express = require('express');
const router = express.Router();
const positionController = require('../controllers/position.controller');
const { verifyToken, requireAdmin, requireManager } = require('../middlewares/auth');
const { auditLog, createDescription, getResourceId } = require('../middlewares/auditLog');
const { getLogDescription } = require('../helpers/auditLogHelper');

/**
 * @route   GET /api/positions?unit_id={id}
 * @desc    Lấy chức vụ (lọc theo đơn vị)
 * @access  Private - ADMIN, MANAGER
 */
router.get('/', verifyToken, requireManager, positionController.getPositions);

/**
 * @route   POST /api/positions
 * @desc    Tạo chức vụ mới
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'CREATE',
    resource: 'positions',
    getDescription: getLogDescription('positions', 'CREATE'),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  positionController.createPosition
);

/**
 * @route   PUT /api/positions/:id
 * @desc    Sửa chức vụ
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'UPDATE',
    resource: 'positions',
    getDescription: getLogDescription('positions', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.updatePosition
);

/**
 * @route   DELETE /api/positions/:id
 * @desc    Xóa chức vụ
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'positions',
    getDescription: getLogDescription('positions', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  positionController.deletePosition
);

module.exports = router;
