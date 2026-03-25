import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../models';
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../configs';
import { AppError, NotFoundError, ValidationError } from '../middlewares/errorHandler';
import { emitToUser } from '../utils/socketService';
interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    role: string;
    quan_nhan_id: string | null;
    ho_ten: string | null;
    don_vi: string | null;
    don_vi_id: string | null;
    chuc_vu: string | null;
  };
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  id: string;
  username: string;
  role?: string;
  quan_nhan_id?: string | null;
}

class AuthService {
  private generateAccessToken(account: { id: string; username: string; role: string; quan_nhan_id: string | null }): string {
    return jwt.sign(
      { id: account.id, username: account.username, role: account.role, quan_nhan_id: account.quan_nhan_id },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  private generateRefreshToken(account: { id: string; username: string }): string {
    return jwt.sign(
      { id: account.id, username: account.username },
      JWT_REFRESH_SECRET,
      { expiresIn: '1d' }
    );
  }

  async login(username: string, password: string): Promise<LoginResult> {
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

    const isPasswordValid = await bcrypt.compare(password, account.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Tên đăng nhập hoặc mật khẩu không đúng', 401);
    }

    const accessToken = this.generateAccessToken(account);
    const refreshToken = this.generateRefreshToken(account);

    emitToUser(account.id, 'force_logout', {
      message: 'Tài khoản của bạn đã được đăng nhập ở nơi khác.',
    });

    await prisma.taiKhoan.update({
      where: { id: account.id },
      data: { refreshToken },
    });

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

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    try {
      if (!refreshToken) {
        throw new AppError('Refresh token không được cung cấp', 401);
      }

      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;

      const account = await prisma.taiKhoan.findUnique({
        where: { id: decoded.id },
      });

      if (!account || account.refreshToken !== refreshToken) {
        throw new AppError('Refresh token không hợp lệ', 401);
      }

      const newAccessToken = this.generateAccessToken(account);
      const newRefreshToken = this.generateRefreshToken(account);

      await prisma.taiKhoan.update({
        where: { id: account.id },
        data: { refreshToken: newRefreshToken },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppError('Refresh token đã hết hạn. Vui lòng đăng nhập lại.', 401);
      }
      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new AppError('Refresh token không hợp lệ', 401);
      }
      throw error;
    }
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    if (!refreshToken) {
      throw new AppError('Refresh token không được cung cấp', 401);
    }

    await prisma.taiKhoan.updateMany({
      where: { refreshToken },
      data: { refreshToken: null },
    });

    return { message: 'Đăng xuất thành công' };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const account = await prisma.taiKhoan.findUnique({
      where: { id: userId },
    });

    if (!account) {
      throw new NotFoundError('Tài khoản');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, account.password_hash);
    if (!isOldPasswordValid) {
      throw new AppError('Mật khẩu hiện tại không chính xác', 401);
    }

    if (newPassword.length < 8) {
      throw new ValidationError('Mật khẩu mới phải có ít nhất 8 ký tự');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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

export default new AuthService();
