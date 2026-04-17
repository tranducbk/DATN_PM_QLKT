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
 * @desc    Log in to the system
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
 * @desc    Refresh access token using a valid refresh token
 * @access  Public
 */
router.post('/refresh', authLimiter, validate(authValidation.refreshToken), authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Log out and invalidate the refresh token
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
 * @desc    Change own password (requires authentication)
 * @access  Private - All authenticated users
 */
router.post(
  '/change-password',
  authLimiter,
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
