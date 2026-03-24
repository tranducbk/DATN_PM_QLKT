import { Request, Response } from 'express';
import { FALLBACK } from './constants';

const auth: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  LOGIN: (req: Request, _res: Response, _responseData: unknown): string => {
    const username = req.body?.username || FALLBACK.UNKNOWN;
    return `Đăng nhập hệ thống: ${username}`;
  },
  LOGOUT: (_req: Request, _res: Response, _responseData: unknown): string => {
    return `Đăng xuất khỏi hệ thống`;
  },
  CHANGE_PASSWORD: (_req: Request, _res: Response, _responseData: unknown): string => {
    return `Đổi mật khẩu tài khoản`;
  },
};

export { auth };
