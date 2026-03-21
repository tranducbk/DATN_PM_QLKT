const jwt = require('jsonwebtoken');
const { ROLES } = require('../constants/roles');
const { prisma } = require('../models');

/**
 * Middleware xác thực token - Kiểm tra người dùng đã đăng nhập
 */
const verifyToken = async (req, res, next) => {
  // Đọc accessToken từ Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy token. Vui lòng đăng nhập.',
    });
  }

  const token = authHeader.substring(7); // Bỏ "Bearer " prefix

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra tài khoản còn phiên đăng nhập hợp lệ không
    const account = await prisma.taiKhoan.findUnique({
      where: { id: decoded.id },
      select: { refreshToken: true },
    });

    if (!account || !account.refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
      });
    }

    req.user = decoded; // { id, username, role, quan_nhan_id }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ.',
    });
  }
};

/**
 * Middleware kiểm tra vai trò SUPER_ADMIN
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập trước.',
    });
  }

  if (req.user.role !== ROLES.SUPER_ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ SUPER_ADMIN mới có quyền thực hiện thao tác này.',
    });
  }

  next();
};

/**
 * Middleware kiểm tra vai trò ADMIN hoặc cao hơn
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập trước.',
    });
  }

  const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ ADMIN trở lên mới có quyền thực hiện thao tác này.',
    });
  }

  next();
};

/**
 * Middleware kiểm tra vai trò MANAGER hoặc cao hơn
 */
const requireManager = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập trước.',
    });
  }

  const allowedRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ MANAGER trở lên mới có quyền thực hiện thao tác này.',
    });
  }

  next();
};

/**
 * Middleware kiểm tra bất kỳ user đã đăng nhập (bao gồm cả USER)
 */
const requireAuth = verifyToken;

/**
 * Middleware kiểm tra danh sách các vai trò được phép
 * @param {Array<string>} allowedRoles - Danh sách vai trò cho phép (VD: ['ADMIN', 'MANAGER'])
 */
const checkRole = allowedRoles => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập trước.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Chỉ ${allowedRoles.join(', ')} mới có quyền thực hiện thao tác này.`,
      });
    }

    next();
  };
};

module.exports = {
  verifyToken,
  requireAuth,
  requireSuperAdmin,
  requireAdmin,
  requireManager,
  checkRole,
};
