import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ROLES, ROLE_LABELS } from '../constants/roles.constants';
import { accountRepository } from '../repositories/account.repository';
import { JwtUser } from '../types/express';
import { JWT_SECRET } from '../configs';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AUTH MIDDLEWARE — JWT verify + DB session check + role-based access
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  CƠ CHẾ 2 LỚP (defence in depth):
 *
 *  Lớp 1 — JWT verify (stateless):
 *      jwt.verify() kiểm tra signature + expiry với JWT_SECRET. Nếu token
 *      bị giả mạo hoặc hết hạn → throw → 401. Đây là check NHANH, không
 *      cần touch DB → giảm load cho mỗi request.
 *
 *  Lớp 2 — DB session check (stateful):
 *      Sau khi JWT valid, query bảng TaiKhoan xem account.refreshToken có
 *      tồn tại không. Nếu null = đã logout server-side hoặc bị admin
 *      revoke → 401. Đây là check CHẬM (1 query DB) nhưng cho phép:
 *        • Invalidate session bằng cách clear refreshToken (logout, ban).
 *        • Force re-login khi đổi password.
 *      Pure JWT (chỉ lớp 1) sẽ không làm được điều này vì token có hiệu
 *      lực đến hết expiry, không thể "rút lại".
 *
 *  ROLE HIERARCHY (không phải inheritance, chỉ là set membership):
 *      SUPER_ADMIN > ADMIN > MANAGER > USER
 *      requireSuperAdmin   = [SUPER_ADMIN]                       (chỉ 1 role)
 *      requireAdmin        = [SUPER_ADMIN, ADMIN]                (quản trị)
 *      requireAdminOnly    = [ADMIN]                             (business op)
 *      requireManager      = [SUPER_ADMIN, ADMIN, MANAGER]       (nghiệp vụ)
 *
 *      LƯU Ý: requireAdminOnly KHÔNG bao gồm SUPER_ADMIN — vì SUPER_ADMIN
 *      chỉ làm quản trị hệ thống (account, đơn vị, log), không tham gia
 *      nghiệp vụ khen thưởng. Tránh super-admin can thiệp data nghiệp vụ
 *      (audit trail không rõ).
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Verifies JWT access token and attaches decoded user to request.
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 * @returns Promise resolved when auth check finishes
 */
const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  // Chỉ chấp nhận format "Bearer <token>". Không hỗ trợ token qua cookie
  // hay query string — tránh CSRF + token leak qua URL/access log.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Không tìm thấy token. Vui lòng đăng nhập.',
    });
    return;
  }

  const token = authHeader.substring(7); // bỏ "Bearer " (7 ký tự)

  try {
    // ─── LỚP 1: verify signature + expiry — chốt HS256 chặn algorithm-confusion ───
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtUser;

    // ─── LỚP 2: DB session check (stateful) ───
    // Chỉ query field cần thiết (refreshToken) — KHÔNG select * để tránh
    // leak password hash hay PII vào memory. refreshToken=null nghĩa là
    // session đã bị invalidate (user logout, admin reset password, ...).
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
    // Phân biệt 2 case để FE quyết định: expired → refresh, invalid →
    // logout luôn (không cố refresh được).
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
