import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import { Request, Response } from 'express';
import { normalizeParam } from '../paginationHelper';
import { FALLBACK, ROLE_NAMES } from './constants';

type TaiKhoanHoTenSelect = Prisma.TaiKhoanGetPayload<{
  select: { username: true; QuanNhan: { select: { ho_ten: true } } };
}>;

const accounts: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> = {
  CREATE: (req: Request, res: Response, responseData: unknown): string => {
    const username = req.body?.username || FALLBACK.UNKNOWN;
    const role = req.body?.role || '';
    const roleName = ROLE_NAMES[role] || role;

    let hoTen = '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      hoTen = data?.data?.QuanNhan?.ho_ten || data?.data?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    let description = `Tạo tài khoản: ${username}`;
    if (hoTen && hoTen !== username) {
      description = `Tạo tài khoản cho ${hoTen} (${username})`;
    }
    if (roleName) {
      description += ` - Vai trò: ${roleName}`;
    }
    return description;
  },
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const accountId = normalizeParam(req.params?.id);
    const role = req.body?.role || '';
    const hasPassword = !!req.body?.password;
    const roleName = ROLE_NAMES[role] || role;

    let username = req.body?.username || '';
    let hoTen = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      username = data?.data?.username || username;
      hoTen = data?.data?.QuanNhan?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    if ((!username || !hoTen) && accountId) {
      try {
        const account = (await prisma.taiKhoan.findUnique({
          where: { id: accountId },
          select: {
            username: true,
            QuanNhan: { select: { ho_ten: true } },
          },
        })) as TaiKhoanHoTenSelect | null;
        if (account) {
          username = username || account.username;
          hoTen = hoTen || account.QuanNhan?.ho_ten || '';
        }
      } catch (error) {
        // Ignore
      }
    }

    let displayName =
      hoTen && hoTen !== username ? `${hoTen} (${username})` : username || FALLBACK.UNKNOWN;
    let description = `Cập nhật tài khoản: ${displayName}`;

    const changes: string[] = [];
    if (roleName) {
      changes.push(`vai trò: ${roleName}`);
    }
    if (hasPassword) {
      changes.push('đặt lại mật khẩu');
    }
    if (changes.length > 0) {
      description += ` - ${changes.join(', ')}`;
    }

    return description;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const accountId = normalizeParam(req.params?.id);
    let username = '';
    let hoTen = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      username = data?.data?.username || '';
      hoTen = data?.data?.QuanNhan?.ho_ten || data?.data?.ho_ten || '';
    } catch (e) {
      // Ignore
    }

    if ((!username || !hoTen) && accountId) {
      try {
        const account = (await prisma.taiKhoan.findUnique({
          where: { id: accountId },
          select: {
            username: true,
            QuanNhan: { select: { ho_ten: true } },
          },
        })) as TaiKhoanHoTenSelect | null;
        if (account) {
          username = username || account.username;
          hoTen = hoTen || account.QuanNhan?.ho_ten || '';
        }
      } catch (error) {
        // Ignore
      }
    }

    if (hoTen && username) {
      return `Xóa tài khoản: ${hoTen} (${username})`;
    } else if (username) {
      return `Xóa tài khoản: ${username}`;
    }
    return `Xóa tài khoản (không xác định được thông tin)`;
  },
  RESET_PASSWORD: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const accountId = req.body?.account_id;

    if (accountId) {
      try {
        const account = await prisma.taiKhoan.findUnique({
          where: { id: accountId },
          select: {
            username: true,
            QuanNhan: { select: { ho_ten: true } },
          },
        });

        if (account) {
          const displayName = account.QuanNhan?.ho_ten || account.username;
          return `Đặt lại mật khẩu cho tài khoản: ${displayName} (${account.username})`;
        }
      } catch (error) {}
    }

    const username = req.body?.username || FALLBACK.UNKNOWN;
    return `Đặt lại mật khẩu cho tài khoản: ${username}`;
  },
};

export { accounts };
