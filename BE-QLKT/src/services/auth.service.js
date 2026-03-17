const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../models');

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
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(password, account.password_hash);
    if (!isPasswordValid) {
      throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
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

    // Lưu refresh token vào database
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
        throw new Error('Refresh token không được cung cấp');
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Tìm tài khoản và kiểm tra refresh token có khớp không
      const account = await prisma.taiKhoan.findUnique({
        where: { id: decoded.id },
      });

      if (!account || account.refreshToken !== refreshToken) {
        throw new Error('Refresh token không hợp lệ');
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
        throw new Error('Refresh token đã hết hạn. Vui lòng đăng nhập lại.');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Refresh token không hợp lệ');
      }
      throw error;
    }
  }

  /**
   * Đăng xuất
   */
  async logout(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token không được cung cấp');
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
      throw new Error('Tài khoản không tồn tại');
    }

    // Kiểm tra mật khẩu cũ
    const isOldPasswordValid = await bcrypt.compare(oldPassword, account.password_hash);
    if (!isOldPasswordValid) {
      throw new Error('Mật khẩu hiện tại không chính xác');
    }

    // Mã hóa mật khẩu mới
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu
    await prisma.taiKhoan.update({
      where: { id: userId },
      data: { password_hash: hashedPassword },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }
}

module.exports = new AuthService();
