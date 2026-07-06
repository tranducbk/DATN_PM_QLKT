import { Request, Response } from 'express';
import authService from '../services/auth.service';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AppError } from '../middlewares/errorHandler';
import { getRefreshCookieOptions, getRefreshClearOptions, REFRESH_COOKIE_NAME } from '../configs';

interface LoginBody {
  username?: string;
  password?: string;
}

interface ChangePasswordBody {
  oldPassword?: string;
  newPassword?: string;
}

class AuthController {
  login = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as LoginBody;
    const { username, password } = body;

    if (!username || !password) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
    }

    const { refreshToken, ...rest } = await authService.login(username, password);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
    return ResponseHelper.success(res, { data: rest, message: 'Đăng nhập thành công' });
  });

  refresh = catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new AppError('Refresh token không được cung cấp', 401);
    }

    const { refreshToken: newRefreshToken, ...rest } =
      await authService.refreshAccessToken(refreshToken);
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());
    return ResponseHelper.success(res, { data: rest, message: 'Làm mới token thành công' });
  });

  logout = catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshClearOptions());
    return ResponseHelper.success(res, { message: 'Đăng xuất thành công' });
  });

  changePassword = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ChangePasswordBody;
    const { oldPassword, newPassword } = body;
    const userId = user.id;

    if (!oldPassword || !newPassword) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới');
    }

    const result = await authService.changePassword(userId, oldPassword, newPassword);
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshClearOptions());
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new AuthController();
