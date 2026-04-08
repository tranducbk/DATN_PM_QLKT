import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth';
import { auditLog } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { authLimiter } from '../configs/rateLimiter';
import { validate } from '../middlewares/validate';
import { authValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

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
    action: AUDIT_ACTIONS.LOGIN,
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
router.post('/refresh', authLimiter, validate(authValidation.refreshToken), authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất (vô hiệu hóa refresh token)
 * @access  Public
 */
router.post(
  '/logout',
  auditLog({
    action: AUDIT_ACTIONS.LOGOUT,
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
    action: AUDIT_ACTIONS.CHANGE_PASSWORD,
    resource: 'auth',
    getDescription: getLogDescription('auth', 'CHANGE_PASSWORD'),
  }),
  authController.changePassword
);

export default router;
