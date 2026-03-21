/**
 * Auth-related audit log descriptions (login, logout, password change)
 */

const { FALLBACK } = require('./constants');

const auth = {
  LOGIN: (req, res, responseData) => {
    const username = req.body?.username || FALLBACK.UNKNOWN;
    return `Đăng nhập hệ thống: ${username}`;
  },
  LOGOUT: (req, res, responseData) => {
    return `Đăng xuất khỏi hệ thống`;
  },
  CHANGE_PASSWORD: (req, res, responseData) => {
    return `Đổi mật khẩu tài khoản`;
  },
};

module.exports = { auth };
