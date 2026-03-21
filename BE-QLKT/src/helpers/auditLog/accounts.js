/**
 * Account CRUD audit log descriptions
 */

const { FALLBACK, ROLE_NAMES } = require('./constants');

const accounts = {
  CREATE: (req, res, responseData) => {
    const username = req.body?.username || FALLBACK.UNKNOWN;
    const role = req.body?.role || '';
    const roleName = ROLE_NAMES[role] || role;

    // Lấy họ tên từ response nếu có
    let hoTen = '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      hoTen = data?.data?.QuanNhan?.ho_ten || data?.data?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    let description = `Tạo tài khoản: ${username}`;
    if (hoTen && hoTen !== username) {
      description = `Tạo tài khoản cho ${hoTen} (${username})`;
    }
    if (roleName) {
      description += ` - Vai trò: ${roleName}`;
    }
    return description;
  },
  UPDATE: async (req, res, responseData) => {
    const accountId = req.params?.id;
    const role = req.body?.role || '';
    const hasPassword = !!req.body?.password;
    const roleName = ROLE_NAMES[role] || role;

    // Lấy thông tin từ response hoặc query từ DB
    let username = req.body?.username || '';
    let hoTen = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      username = data?.data?.username || username;
      hoTen = data?.data?.QuanNhan?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    // Query từ DB nếu thiếu thông tin
    if ((!username || !hoTen) && accountId) {
      try {
        const { prisma } = require('../../models');
        const account = await prisma.taiKhoan.findUnique({
          where: { id: accountId },
          select: {
            username: true,
            QuanNhan: { select: { ho_ten: true } },
          },
        });
        if (account) {
          username = username || account.username;
          hoTen = hoTen || account.QuanNhan?.ho_ten || '';
        }
      } catch (error) {
        // Ignore
      }
    }

    // Tạo mô tả
    let displayName =
      hoTen && hoTen !== username ? `${hoTen} (${username})` : username || FALLBACK.UNKNOWN;
    let description = `Cập nhật tài khoản: ${displayName}`;

    const changes = [];
    if (roleName) {
      changes.push(`vai trò: ${roleName}`);
    }
    if (hasPassword) {
      changes.push('đặt lại mật khẩu');
    }
    if (changes.length > 0) {
      description += ` - ${changes.join(', ')}`;
    }

    return description;
  },
  DELETE: async (req, res, responseData) => {
    const accountId = req.params?.id;
    let username = '';
    let hoTen = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      username = data?.data?.username || '';
      hoTen = data?.data?.QuanNhan?.ho_ten || data?.data?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    // Query từ DB nếu thiếu thông tin
    if ((!username || !hoTen) && accountId) {
      try {
        const { prisma } = require('../../models');
        const account = await prisma.taiKhoan.findUnique({
          where: { id: accountId },
          select: {
            username: true,
            QuanNhan: { select: { ho_ten: true } },
          },
        });
        if (account) {
          username = username || account.username;
          hoTen = hoTen || account.QuanNhan?.ho_ten || '';
        }
      } catch (error) {
        // Ignore
      }
    }

    // Tạo mô tả
    if (hoTen && username) {
      return `Xóa tài khoản: ${hoTen} (${username})`;
    } else if (username) {
      return `Xóa tài khoản: ${username}`;
    }
    return `Xóa tài khoản (không xác định được thông tin)`;
  },
  RESET_PASSWORD: async (req, res, responseData) => {
    const accountId = req.body?.account_id;

    // Nếu có account_id, query username từ DB
    if (accountId) {
      try {
        const { prisma } = require('../../models');
        const account = await prisma.taiKhoan.findUnique({
          where: { id: accountId },
          select: {
            username: true,
            QuanNhan: { select: { ho_ten: true } },
          },
        });

        if (account) {
          const displayName = account.QuanNhan?.ho_ten || account.username;
          return `Đặt lại mật khẩu cho tài khoản: ${displayName} (${account.username})`;
        }
      } catch (error) {}
    }

    // Fallback nếu không query được
    const username = req.body?.username || FALLBACK.UNKNOWN;
    return `Đặt lại mật khẩu cho tài khoản: ${username}`;
  },
};

module.exports = { accounts };
