import { z } from 'zod';
import { ROLES } from '../constants/roles.constants';

export const createAccount = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .max(50, 'Tên đăng nhập không được quá 50 ký tự'),
  password: z.string().min(8).optional().or(z.literal('')),
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.USER], {
    message: 'Vai trò không hợp lệ',
  }),
  personnel_id: z.string().trim().optional(),
  co_quan_don_vi_id: z.string().trim().optional(),
  don_vi_truc_thuoc_id: z.string().trim().optional(),
  chuc_vu_id: z.string().trim().optional(),
});

export const updateAccount = z.object({
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]).optional(),
  password: z.string().min(8).optional(),
});

export const resetPassword = z.object({
  account_id: z.string().trim().min(1, 'ID tài khoản là bắt buộc'),
});

export const idParam = z.object({
  id: z.string().trim().min(1, 'ID là bắt buộc'),
});

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  search: z.string().trim().optional(),
  role: z.enum([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]).optional(),
});
