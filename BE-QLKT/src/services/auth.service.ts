import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { accountRepository } from '../repositories/account.repository';
import { JWT_SECRET, JWT_REFRESH_SECRET, REFRESH_TOKEN_TTL, REFRESH_GRACE_MS } from '../configs';
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

interface AccountForToken {
  id: string;
  username: string;
  role: string;
  quan_nhan_id: string | null;
}

class AuthService {
  private generateAccessToken(account: AccountForToken): string {
    return jwt.sign(
      { id: account.id, username: account.username, role: account.role, quan_nhan_id: account.quan_nhan_id },
      JWT_SECRET,
      { expiresIn: '30m', algorithm: 'HS256' }
    );
  }

  private generateRefreshToken(account: { id: string; username: string }): string {
    return jwt.sign({ id: account.id, username: account.username }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_TTL,
      algorithm: 'HS256',
    });
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const account = await accountRepository.findUniqueRaw({
      where: { username },
      include: {
        QuanNhan: {
          include: {
            CoQuanDonVi: true,
            DonViTrucThuoc: { include: { CoQuanDonVi: true } },
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

    // Single active session — overwriting the token invalidates the previous device.
    emitToUser(account.id, 'force_logout', {
      message: 'Tài khoản của bạn đã được đăng nhập ở nơi khác.',
    });

    await accountRepository.update(account.id, { refreshToken, prevRefreshToken: null });

    const quanNhan = account.QuanNhan;
    const donVi = quanNhan?.DonViTrucThuoc || quanNhan?.CoQuanDonVi;
    const donViId = quanNhan?.don_vi_truc_thuoc_id || quanNhan?.co_quan_don_vi_id;

    return {
      accessToken,
      refreshToken,
      user: {
        id: account.id,
        username: account.username,
        role: account.role,
        quan_nhan_id: account.quan_nhan_id,
        ho_ten: quanNhan?.ho_ten || null,
        don_vi: donVi?.ten_don_vi || null,
        don_vi_id: donViId || null,
        chuc_vu: quanNhan?.ChucVu?.ten_chuc_vu || null,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken) {
      throw new AppError('Refresh token không được cung cấp', 401);
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppError('Refresh token đã hết hạn. Vui lòng đăng nhập lại.', 401);
      }
      throw new AppError('Refresh token không hợp lệ', 401);
    }

    const account = await accountRepository.findById(decoded.id);
    if (!account || !account.refreshToken) {
      throw new AppError('Refresh token không hợp lệ', 401);
    }

    // Current token → rotate: keep the consumed one as prev for the grace window.
    // Conditional update guards against concurrent rotation: only one request flips the
    // token; the loser re-reads and returns the winner's token (no orphaned token → no logout).
    if (refreshToken === account.refreshToken) {
      const newRefreshToken = this.generateRefreshToken(account);
      const updated = await accountRepository.updateMany(
        { id: account.id, refreshToken },
        { refreshToken: newRefreshToken, prevRefreshToken: refreshToken }
      );
      if (updated.count === 0) {
        const fresh = await accountRepository.findById(account.id);
        if (fresh?.refreshToken) {
          return { accessToken: this.generateAccessToken(account), refreshToken: fresh.refreshToken };
        }
        throw new AppError('Refresh token không hợp lệ', 401);
      }
      return { accessToken: this.generateAccessToken(account), refreshToken: newRefreshToken };
    }

    // Just-rotated token replayed by a lagging tab/socket → within grace, hand back the
    // current token (idempotent) instead of logging out.
    if (refreshToken === account.prevRefreshToken && this.isWithinGrace(account.refreshToken)) {
      return { accessToken: this.generateAccessToken(account), refreshToken: account.refreshToken };
    }

    throw new AppError('Refresh token không hợp lệ', 401);
  }

  /** Whether the current refresh token was issued within the grace window. */
  private isWithinGrace(currentRefreshToken: string): boolean {
    const decoded = jwt.decode(currentRefreshToken) as { iat?: number } | null;
    if (!decoded?.iat) return false;
    return Date.now() - decoded.iat * 1000 <= REFRESH_GRACE_MS;
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    if (!refreshToken) {
      throw new AppError('Refresh token không được cung cấp', 401);
    }

    await accountRepository.updateMany(
      { refreshToken },
      { refreshToken: null, prevRefreshToken: null }
    );

    return { message: 'Đăng xuất thành công' };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const account = await accountRepository.findById(userId);

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

    await accountRepository.update(userId, {
      password_hash: hashedPassword,
      refreshToken: null,
      prevRefreshToken: null,
    });

    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}

export default new AuthService();
