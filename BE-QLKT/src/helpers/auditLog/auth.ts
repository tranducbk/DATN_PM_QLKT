import { Request, Response } from 'express';

const auth: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  LOGIN: (req: Request): string => {
    return `Đăng nhập hệ thống: ${req.body.username}`;
  },
  LOGOUT: (req: Request): string => {
    return `Đăng xuất khỏi hệ thống: ${req.user!.username}`;
  },
  CHANGE_PASSWORD: (req: Request): string => {
    return `Đổi mật khẩu tài khoản: ${req.user!.username}`;
  },
};

export { auth };
