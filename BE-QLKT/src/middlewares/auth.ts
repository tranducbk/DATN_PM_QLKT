import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ROLES, ROLE_LABELS } from '../constants/roles.constants';
import { accountRepository } from '../repositories/account.repository';
import { JwtUser } from '../types/express';
import { JWT_SECRET } from '../configs';

/**
 * Verifies JWT access token and attaches decoded user to request.
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 * @returns Promise resolved when auth check finishes
 */
const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Không tìm thấy token. Vui lòng đăng nhập.',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtUser;

    const account = await accountRepository.findUniqueRaw({
      where: { id: decoded.id },
      select: { refreshToken: true, role: true, quan_nhan_id: true },
    });

    if (!account || !account.refreshToken) {
      res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
      });
      return;
    }

    // Trust role/quan_nhan_id from DB, not the token — reflects role changes immediately.
    req.user = {
      ...decoded,
      role: account.role as JwtUser['role'],
      quan_nhan_id: account.quan_nhan_id ?? undefined,
    };
    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: 'Token không hợp lệ.',
    });
  }
};

const requireAuth = verifyToken;

/**
 * Creates role-based authorization middleware.
 * @param allowedRoles - Roles allowed to access the endpoint
 * @returns Express middleware enforcing role checks
 */
const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập trước.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Chỉ ${allowedRoles.map(r => ROLE_LABELS[r] ?? r).join(', ')} mới có quyền thực hiện thao tác này.`,
      });
      return;
    }

    next();
  };
};

/** Middleware allowing only SUPER_ADMIN role. */
const requireSuperAdmin = checkRole([ROLES.SUPER_ADMIN]);
/** Middleware allowing SUPER_ADMIN and ADMIN roles (shared system management). */
const requireAdmin = checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN]);
/** Middleware allowing only ADMIN role (business operations — excludes SUPER_ADMIN). */
const requireAdminOnly = checkRole([ROLES.ADMIN]);
/** Middleware allowing SUPER_ADMIN, ADMIN, and MANAGER roles. */
const requireManager = checkRole([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]);

export {
  verifyToken,
  requireAuth,
  requireSuperAdmin,
  requireAdmin,
  requireAdminOnly,
  requireManager,
  checkRole,
};
