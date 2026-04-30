import { z } from 'zod';

export const login = z.object({
  username: z.string().trim().min(1, 'Tên đăng nhập không được để trống'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

export const changePassword = z.object({
  oldPassword: z.string().min(1, 'Mật khẩu hiện tại là bắt buộc'),
  newPassword: z.string().min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự'),
});

export const refreshToken = z.object({
  refreshToken: z.string().min(1, 'Refresh token là bắt buộc'),
});
