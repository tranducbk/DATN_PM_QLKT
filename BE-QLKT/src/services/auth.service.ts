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

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AUTH SERVICE — login / logout / refresh token rotation
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KIẾN TRÚC 2 TOKEN (industry standard):
 *
 *  ┌─ ACCESS TOKEN ─────────────────────────────────────────────┐
 *  │  - Sống ngắn (30 phút).                                     │
 *  │  - Chứa: id, username, role, quan_nhan_id (đủ để authz).   │
 *  │  - Gửi mỗi request qua header Authorization: Bearer ...    │
 *  │  - Hết hạn → FE auto refresh thay vì bắt user đăng nhập.   │
 *  └────────────────────────────────────────────────────────────┘
 *
 *  ┌─ REFRESH TOKEN ────────────────────────────────────────────┐
 *  │  - Sống dài (7 ngày).                                       │
 *  │  - Chứa MINIMAL: chỉ id + username (không có role!).        │
 *  │  - Lưu trong cookie httpOnly hoặc localStorage (tuỳ FE).    │
 *  │  - Sign với JWT_REFRESH_SECRET khác JWT_SECRET (mỗi key 1   │
 *  │    nhiệm vụ → leak access token KHÔNG forge refresh được).  │
 *  └────────────────────────────────────────────────────────────┘
 *
 *  WHY 2 TOKEN VÀ KHÁC SECRET:
 *  - Access ngắn → giảm "window of compromise" nếu bị leak.
 *  - Refresh dài → UX tốt (không phải đăng nhập mỗi 30 phút).
 *  - Tách secret → defense in depth (compromise 1 secret không break all).
 *
 *  REFRESH TOKEN ROTATION (chống replay attack):
 *  Mỗi lần refreshAccessToken → cấp CẢ access lẫn refresh MỚI, ghi đè
 *  refresh cũ trong DB. Lý do:
 *    - Refresh dài (7d) → kẻ tấn công steal được dùng 7 ngày → nguy hiểm.
 *    - Sau rotation: refresh cũ thành invalid (DB không còn match).
 *    - Nếu cả user thật + attacker đều dùng cùng refresh → ai dùng trước
 *      lấy được pair mới; ai dùng sau bị deny → user thật phải đăng nhập
 *      lại = TÍN HIỆU PHÁT HIỆN bị hack.
 *  → Pattern này gọi là "Refresh Token Rotation with Reuse Detection".
 *
 *  SINGLE SESSION (force_logout):
 *  Khi user login mới, emit socket event 'force_logout' tới session cũ
 *  → tab khác tự logout. Lý do business: tài khoản quân nhân không cho
 *  multi-session đồng thời (chống share account).
 *
 *  PASSWORD STORAGE: bcrypt.compare (constant-time + auto-salt).
 *  KHÔNG bao giờ trả password_hash về client; KHÔNG so sánh bằng `===`.
 * ════════════════════════════════════════════════════════════════════════════
 */
interface AccountForToken {
  id: string;
  username: string;
  role: string;
  quan_nhan_id: string | null;
}

class AuthService {
  /**
   * Sinh access token JWT — sống 30 phút, chứa đủ payload cho authz.
   * Role nằm trong token → middleware checkRole không cần query DB.
   */
  private generateAccessToken(account: AccountForToken): string {
    return jwt.sign(
      { id: account.id, username: account.username, role: account.role, quan_nhan_id: account.quan_nhan_id },
      JWT_SECRET,
      { expiresIn: '30m', algorithm: 'HS256' }
    );
  }

  /**
   * Sinh refresh token JWT — sống 7 ngày, payload MINIMAL.
   * KHÔNG nhét role/permission vào — nếu user bị đổi role giữa chừng,
   * refresh sẽ re-query DB để lấy role mới.
   */
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

    // ─── RACE-AWARE: single session enforcement ───────────────────
    // Thứ tự QUAN TRỌNG:
    //   1. Emit 'force_logout' tới session cũ (qua socket room user_<id>).
    //   2. Update refresh token mới vào DB → session cũ không refresh được.
    //
    // Tại sao emit trước update:
    //   - Nếu update trước: session cũ vẫn còn socket connection cho tới
    //     khi nhận event → user thấy "tự logout đột ngột".
    //   - Emit trước: session cũ nhận event → show modal "đã đăng nhập
    //     nơi khác" → user click OK → logout (UX rõ ràng).
    //
    // Edge case race: tab cũ đang refresh → có thể nhận token cũ trước
    // khi rotation. Trade-off chấp nhận, tab cũ next request sẽ fail.
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

  /**
   * REFRESH ACCESS TOKEN — rotation pattern (chống replay).
   *
   *  Flow:
   *  1. Verify signature + expiry của refresh token cũ (jwt.verify).
   *  2. Query DB lấy account; KIỂM TRA refresh token TRONG DB phải KHỚP
   *     với refresh client gửi lên. Đây là REUSE DETECTION:
   *       - Nếu match  → token còn valid → cấp pair mới.
   *       - Nếu mismatch → token cũ đã bị rotate (do user thật hoặc attacker
   *         đã dùng trước) → reject ngay.
   *  3. Cấp access + refresh MỚI (rotation).
   *  4. Ghi refresh mới vào DB → invalidate refresh cũ.
   *
   *  EDGE CASES:
   *  - Race condition (2 tab refresh đồng thời): cả 2 dùng cùng refresh
   *    cũ → tab đầu update DB → tab sau mismatch → 401. FE phải handle:
   *    nếu 1 trong 2 fail thì redirect login. Đây là behavior CHẤP NHẬN
   *    được để đổi lại an toàn cao hơn.
   *  - Refresh hết hạn: throw rõ 'Refresh token đã hết hạn' → FE redirect
   *    login, không cố retry.
   */
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
