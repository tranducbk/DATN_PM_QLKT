import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  ROLE_LABELS,
  CAPABILITIES,
  rolesWithCapability,
  type Capability,
} from '../constants/roles.constants';
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

/**
 * Builds authorization middleware from a capability — the allowed roles are derived
 * from ROLE_CAPABILITIES, so adding a role only requires editing the matrix.
 * @param capability - Capability key the route requires
 * @returns Express middleware allowing roles that hold the capability
 */
const requireCapability = (capability: Capability) => checkRole(rolesWithCapability(capability));

/** Middleware allowing only SUPER_ADMIN role. */
const requireSuperAdmin = requireCapability(CAPABILITIES.SUPER_ADMIN_ONLY);
/** Middleware allowing SUPER_ADMIN and ADMIN roles (shared system management). */
const requireAdmin = requireCapability(CAPABILITIES.SYSTEM_MANAGEMENT);
/** Middleware allowing only ADMIN role (business operations — excludes SUPER_ADMIN). */
const requireAdminOnly = requireCapability(CAPABILITIES.ADMIN_BUSINESS);
/** Middleware allowing SUPER_ADMIN, ADMIN, and MANAGER roles. */
const requireManager = requireCapability(CAPABILITIES.PERSONNEL_MANAGEMENT);
/** Middleware allowing ADMIN and MANAGER roles (proposal business — excludes SUPER_ADMIN). */
const requireAdminOrManager = requireCapability(CAPABILITIES.PROPOSAL_BUSINESS);

export {
  verifyToken,
  requireCapability,
  requireSuperAdmin,
  requireAdmin,
  requireAdminOnly,
  requireManager,
  requireAdminOrManager,
  checkRole,
};
