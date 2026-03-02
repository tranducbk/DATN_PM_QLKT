const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { verifyToken, requireSuperAdmin, requireAdmin } = require('../middlewares/auth');
const { auditLog, createDescription, getResourceId } = require('../middlewares/auditLog');
const { getLogDescription } = require('../helpers/auditLogHelper');

/**
 * @route   GET /api/accounts
 * @desc    Lấy danh sách tài khoản (có phân trang)
 * @access  Private - ADMIN and above
 */
router.get('/', verifyToken, requireAdmin, accountController.getAccounts);

/**
 * @route   GET /api/accounts/:id
 * @desc    Lấy chi tiết tài khoản
 * @access  Private - ADMIN and above
 */
router.get('/:id', verifyToken, requireAdmin, accountController.getAccountById);

/**
 * @route   POST /api/accounts
 * @desc    Tạo tài khoản mới
 * @access  Private - ADMIN and above
 */
router.post(
  '/',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'CREATE',
    resource: 'accounts',
    getDescription: getLogDescription('accounts', 'CREATE'),
    getResourceId: getResourceId.fromResponse('id'),
  }),
  accountController.createAccount
);

/**
 * @route   PUT /api/accounts/:id
 * @desc    Cập nhật tài khoản (đổi vai trò)
 * @access  Private - ADMIN and above
 */
router.put(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'UPDATE',
    resource: 'accounts',
    getDescription: getLogDescription('accounts', 'UPDATE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  accountController.updateAccount
);

/**
 * @route   POST /api/accounts/reset-password
 * @desc    Đặt lại mật khẩu cho tài khoản
 * @access  Private - ADMIN and above
 */
router.post(
  '/reset-password',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'RESET_PASSWORD',
    resource: 'accounts',
    getDescription: getLogDescription('accounts', 'RESET_PASSWORD'),
    getResourceId: req => req.body.account_id || null,
  }),
  accountController.resetPassword
);

/**
 * @route   DELETE /api/accounts/:id
 * @desc    Xóa (vô hiệu hóa) tài khoản
 * @access  Private - ADMIN and above
 */
router.delete(
  '/:id',
  verifyToken,
  requireAdmin,
  auditLog({
    action: 'DELETE',
    resource: 'accounts',
    getDescription: getLogDescription('accounts', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  accountController.deleteAccount
);

module.exports = router;
