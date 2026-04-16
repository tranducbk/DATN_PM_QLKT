import { Request, Response } from 'express';
import authService from '../services/auth.service';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class AuthController {
  login = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as { username?: string; password?: string };
    const { username, password } = body;

    if (!username || !password) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
    }

    const result = await authService.login(username, password);
    return ResponseHelper.success(res, { data: result, message: 'Đăng nhập thành công' });
  });

  refresh = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as { refreshToken?: string };
    const { refreshToken } = body;

    if (!refreshToken) {
      return ResponseHelper.badRequest(res, 'Refresh token không được cung cấp');
    }

    const result = await authService.refreshAccessToken(refreshToken);
    return ResponseHelper.success(res, { data: result, message: 'Làm mới token thành công' });
  });

  logout = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as { refreshToken?: string };
    const { refreshToken } = body;

    if (!refreshToken) {
      return ResponseHelper.badRequest(res, 'Refresh token không được cung cấp');
    }

    const result = await authService.logout(refreshToken);
    return ResponseHelper.success(res, { message: result.message });
  });

  changePassword = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as { oldPassword?: string; newPassword?: string };
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
