const { prisma } = require('../models');

/**
 * Redact sensitive fields từ payload trước khi lưu vào log
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'refreshToken',
  'cccd',
  'oldPassword',
  'newPassword',
  'confirmPassword',
];

const redactSensitiveFields = obj => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveFields);

  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveFields(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

/**
 * Middleware ghi log hoạt động của người dùng
 * @param {Object} options - Cấu hình middleware
 * @param {string} options.action - Hành động (CREATE, UPDATE, DELETE, LOGIN, etc.)
 * @param {string} options.resource - Tài nguyên (accounts, personnel, etc.)
 * @param {Function} options.getResourceId - Function lấy ID tài nguyên từ req/res
 * @param {Function} options.getDescription - Function tạo mô tả hành động
 * @param {Function} options.getPayload - Function lấy dữ liệu chi tiết (optional)
 */
const auditLog = (options = {}) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    let responseData = null;

    // Intercept response để lấy dữ liệu
    res.send = function (data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    try {
      await next();
    } catch (error) {
      throw error;
    } finally {
      // Chỉ ghi log nếu request thành công (status 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const user = req.user; // Từ middleware auth
          if (!user) return;

          const {
            action,
            resource,
            getResourceId = () => null,
            getDescription = () => `${action} ${resource}`,
            getPayload = () => null,
          } = options;

          const resourceId = getResourceId(req, res, responseData);
          const descriptionPromise = getDescription(req, res, responseData);
          const description =
            descriptionPromise instanceof Promise ? await descriptionPromise : descriptionPromise;
          const rawPayload = getPayload(req, res, responseData);
          const payload = redactSensitiveFields(rawPayload);

          // Lấy IP và User Agent
          const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
          const userAgent = req.get('User-Agent');

          await prisma.systemLog.create({
            data: {
              nguoi_thuc_hien_id: user.id,
              actor_role: user.role,
              action,
              resource,
              tai_nguyen_id: resourceId,
              description,
              payload: payload ? JSON.stringify(payload) : null,
              ip_address: ipAddress,
              user_agent: userAgent,
            },
          });
        } catch (logError) {
          // Không throw error để không ảnh hưởng đến response chính
        }
      }
    }
  };
};

/**
 * Helper function để tạo mô tả cho các hành động phổ biến
 */
const createDescription = {
  create: (resource, data) =>
    `Tạo mới ${resource}: ${
      data?.username ||
      data?.ho_ten ||
      data?.ten_don_vi ||
      data?.ten_chuc_vu ||
      data?.ten_nhom_cong_hien ||
      'N/A'
    }`,
  update: (resource, data) =>
    `Cập nhật ${resource}: ${
      data?.username ||
      data?.ho_ten ||
      data?.ten_don_vi ||
      data?.ten_chuc_vu ||
      data?.ten_nhom_cong_hien ||
      'N/A'
    }`,
  delete: (resource, data) =>
    `Xóa ${resource}: ${
      data?.username ||
      data?.ho_ten ||
      data?.ten_don_vi ||
      data?.ten_chuc_vu ||
      data?.ten_nhom_cong_hien ||
      'N/A'
    }`,
  login: data => `Đăng nhập hệ thống`,
  logout: data => `Đăng xuất khỏi hệ thống`,
  resetPassword: data => `Đặt lại mật khẩu cho tài khoản: ${data?.username || 'N/A'}`,
};

/**
 * Helper function để lấy ID từ params hoặc response
 * @deprecated Use getResourceId from helpers/auditLog instead
 */
const getResourceId = {
  fromParams: paramName => req => {
    const value = req.params?.[paramName] || null;
    // Return as string (CUID), not parseInt
    return value;
  },
  fromResponse: key => (req, res, responseData) => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      return data?.data?.id || data?.id || null;
    } catch {
      return null;
    }
  },
};

module.exports = {
  auditLog,
  createDescription,
  getResourceId,
};
