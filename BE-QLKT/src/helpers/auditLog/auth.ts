import { Request, Response } from 'express';

const auth: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  CHANGE_PASSWORD: (req: Request): string => {
    return `Đổi mật khẩu tài khoản: ${req.user!.username}`;
  },
};

export { auth };
