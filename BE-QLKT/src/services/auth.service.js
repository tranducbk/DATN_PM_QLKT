const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../models');
const { AppError, NotFoundError, ValidationError } = require('../middlewares/errorHandler');
const { emitToUser } = require('../utils/socketService');

class AuthService {
  /**
   * Đăng nhập
   */
  async login(username, password) {
    // Tìm tài khoản theo username
    const account = await prisma.taiKhoan.findUnique({
      where: { username },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: {
              include: {
                CoQuanDonVi: true,
              },
            },
            ChucVu: true,
          },
        },
      },
    });

    if (!account) {
      throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, account.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    // Tạo access token (thời hạn ngắn - 15 phút)
    const accessToken = jwt.sign(
      {
        id: account.id,
        username: account.username,
        role: account.role,
        quan_nhan_id: account.quan_nhan_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Tạo refresh token (thời hạn dài - 1 ngày)
    const refreshToken = jwt.sign(
      {
        id: account.id,
        username: account.username,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '1d' }
    );

    // Thông báo thiết bị cũ bị đăng xuất (nếu đang online)
    emitToUser(account.id, 'force_logout', {
      message: 'Tài khoản của bạn đã được đăng nhập ở nơi khác.',
    });

    // Lưu refresh token vào database (ghi đè token cũ)
    await prisma.taiKhoan.update({
      where: { id: account.id },
      data: { refreshToken },
    });

    // Chuẩn bị thông tin user trả về
    const quanNhan = account.QuanNhan;
    const donVi = quanNhan?.DonViTrucThuoc || quanNhan?.CoQuanDonVi;
    const donViId = quanNhan?.don_vi_truc_thuoc_id || quanNhan?.co_quan_don_vi_id;

    const userInfo = {
      id: account.id,
      username: account.username,
      role: account.role,
      quan_nhan_id: account.quan_nhan_id,
      ho_ten: quanNhan?.ho_ten || null,
      don_vi: donVi?.ten_don_vi || null,
      don_vi_id: donViId || null,
      chuc_vu: quanNhan?.ChucVu?.ten_chuc_vu || null,
    };

    return {
      accessToken,
      refreshToken,
      user: userInfo,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new AppError('Refresh token không được cung cấp', 401);
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Tìm tài khoản và kiểm tra refresh token có khớp không
      const account = await prisma.taiKhoan.findUnique({
        where: { id: decoded.id },
      });

      if (!account || account.refreshToken !== refreshToken) {
        throw new AppError('Refresh token không hợp lệ', 401);
      }

      // Tạo access token mới
      const newAccessToken = jwt.sign(
        {
          id: account.id,
          username: account.username,
          role: account.role,
          quan_nhan_id: account.quan_nhan_id,
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Tạo refresh token mới (token rotation để tăng bảo mật)
      const newRefreshToken = jwt.sign(
        {
          id: account.id,
          username: account.username,
        },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '1d' }
      );

      // Cập nhật refresh token mới vào database
      await prisma.taiKhoan.update({
        where: { id: account.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Refresh token đã hết hạn. Vui lòng đăng nhập lại.', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Refresh token không hợp lệ', 401);
      }
      throw error;
    }
  }

  /**
   * Đăng xuất
   */
  async logout(refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token không được cung cấp', 401);
    }

    // Xóa refresh token khỏi database
    await prisma.taiKhoan.updateMany({
      where: { refreshToken },
      data: { refreshToken: null },
    });

    return { message: 'Đăng xuất thành công' };
  }

  /**
   * Đổi mật khẩu
   */
  async changePassword(userId, oldPassword, newPassword) {
    // Tìm tài khoản
    const account = await prisma.taiKhoan.findUnique({
      where: { id: userId },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    // Kiểm tra mật khẩu cũ
    const isOldPasswordValid = await bcrypt.compare(oldPassword, account.password_hash);
    if (!isOldPasswordValid) {
      throw new AppError('Mật khẩu hiện tại không chính xác', 401);
    }

    // Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Validate mật khẩu mới
    if (newPassword.length < 8) {
      throw new ValidationError('Mật khẩu mới phải có ít nhất 8 ký tự');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new ValidationError('Mật khẩu mới phải chứa ít nhất 1 chữ hoa');
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new ValidationError('Mật khẩu mới phải chứa ít nhất 1 chữ thường');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new ValidationError('Mật khẩu mới phải chứa ít nhất 1 chữ số');
    }

    // Cập nhật mật khẩu và thu hồi refresh token (buộc đăng nhập lại)
    await prisma.taiKhoan.update({
      where: { id: userId },
      data: {
        password_hash: hashedPassword,
        refreshToken: null,
      },
    });

    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}

module.exports = new AuthService();
