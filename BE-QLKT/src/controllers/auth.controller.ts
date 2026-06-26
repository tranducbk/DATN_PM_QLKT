/*
 * AUTH CONTROLLER — thin wrapper. Dispatch sang authService.
 * Method: login, refreshToken, logout, changePassword, getCurrentUser.
 * Tất cả wrap catchAsync để forward error → errorHandler.
 */

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
  /** Đăng nhập: trả access token trong body, đặt refresh token vào cookie HttpOnly. */
  login = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as LoginBody;
    const { username, password } = body;

    if (!username || !password) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
    }

    const { refreshToken, ...rest } = await authService.login(username, password);
    // Lưu refresh token vào cookie HttpOnly, không trả về body cho client
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
    return ResponseHelper.success(res, { data: rest, message: 'Đăng nhập thành công' });
  });

  /** Làm mới access token dựa trên refresh token đọc từ cookie. */
  refresh = catchAsync(async (req: Request, res: Response) => {
    // Refresh token chỉ nằm trong cookie HttpOnly, không gửi qua header
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new AppError('Refresh token không được cung cấp', 401);
    }

    const { refreshToken: newRefreshToken, ...rest } =
      await authService.refreshAccessToken(refreshToken);
    // Xoay refresh token: ghi đè cookie bằng token mới sau mỗi lần làm mới
    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());
    return ResponseHelper.success(res, { data: rest, message: 'Làm mới token thành công' });
  });

  /** Đăng xuất: thu hồi refresh token và xóa cookie. */
  logout = catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    // Xóa cookie refresh token kể cả khi token không còn hợp lệ
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshClearOptions());
    return ResponseHelper.success(res, { message: 'Đăng xuất thành công' });
  });

  /** Đổi mật khẩu của tài khoản đang đăng nhập. */
  changePassword = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ChangePasswordBody;
    const { oldPassword, newPassword } = body;
    const userId = user.id;

    if (!oldPassword || !newPassword) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới');
    }

    const result = await authService.changePassword(userId, oldPassword, newPassword);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new AuthController();
