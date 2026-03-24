import { Router, Request } from 'express';
import accountController from '../controllers/account.controller';
import { verifyToken, requireSuperAdmin, requireAdmin } from '../middlewares/auth';
import { auditLog, createDescription, getResourceId } from '../middlewares/auditLog';
import { getLogDescription } from '../helpers/auditLog';
import { writeLimiter } from '../configs/rateLimiter.config';
import { validate } from '../middlewares/validate';
import { accountValidation } from '../validations';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

/**
 * @route   GET /api/accounts
 * @desc    Lấy danh sách tài khoản (có phân trang)
 * @access  Private - ADMIN and above
 */
router.get(
  '/',
  verifyToken,
  requireAdmin,
  validate(accountValidation.listQuery, 'query'),
  accountController.getAccounts
);

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
  writeLimiter,
  validate(accountValidation.createAccount),
  auditLog({
    action: AUDIT_ACTIONS.CREATE,
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
  validate(accountValidation.updateAccount),
  auditLog({
    action: AUDIT_ACTIONS.UPDATE,
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
  validate(accountValidation.resetPassword),
  auditLog({
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    resource: 'accounts',
    getDescription: getLogDescription('accounts', 'RESET_PASSWORD'),
    getResourceId: (req: Request) => req.body.account_id || null,
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
  writeLimiter,
  auditLog({
    action: AUDIT_ACTIONS.DELETE,
    resource: 'accounts',
    getDescription: getLogDescription('accounts', 'DELETE'),
    getResourceId: getResourceId.fromParams('id'),
  }),
  accountController.deleteAccount
);

export default router;
