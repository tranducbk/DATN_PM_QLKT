import { Request, Response } from 'express';
import { FALLBACK } from './constants';

const auth: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  LOGIN: (req: Request, res: Response, responseData: unknown): string => {
    const username = req.body?.username || FALLBACK.UNKNOWN;
    return `Đăng nhập hệ thống: ${username}`;
  },
  LOGOUT: (req: Request, res: Response, responseData: unknown): string => {
    return `Đăng xuất khỏi hệ thống: ${req.user?.username || FALLBACK.UNKNOWN}`;
  },
  CHANGE_PASSWORD: (req: Request, res: Response, responseData: unknown): string => {
    return `Đổi mật khẩu tài khoản: ${req.user?.username || FALLBACK.UNKNOWN}`;
  },
};

export { auth };
