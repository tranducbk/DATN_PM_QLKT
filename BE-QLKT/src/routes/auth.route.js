const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth');
const { auditLog } = require('../middlewares/auditLog');
const { getLogDescription } = require('../helpers/auditLog');
const { authLimiter } = require('../configs/rateLimiter.config');
const { validate } = require('../middlewares/validate');
const { authValidation } = require('../validations');

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập hệ thống
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  validate(authValidation.login),
  auditLog({
    action: 'LOGIN',
    resource: 'auth',
    getDescription: getLogDescription('auth', 'LOGIN'),
  }),
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Lấy access token mới khi hết hạn
 * @access  Public
 */
router.post('/refresh', validate(authValidation.refreshToken), authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất (vô hiệu hóa refresh token)
 * @access  Public
 */
router.post(
  '/logout',
  auditLog({
    action: 'LOGOUT',
    resource: 'auth',
    getDescription: getLogDescription('auth', 'LOGOUT'),
  }),
  authController.logout
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Tự đổi mật khẩu (khi đã đăng nhập)
 * @access  Private (Yêu cầu đăng nhập)
 */
router.post(
  '/change-password',
  verifyToken,
  validate(authValidation.changePassword),
  auditLog({
    action: 'CHANGE_PASSWORD',
    resource: 'auth',
    getDescription: getLogDescription('auth', 'CHANGE_PASSWORD'),
  }),
  authController.changePassword
);

module.exports = router;
