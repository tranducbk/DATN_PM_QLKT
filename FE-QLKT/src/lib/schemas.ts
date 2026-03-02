import { z } from 'zod';

// Account schemas
export const accountFormSchema = z.object({
  username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
  personnel_id: z.string().optional(),
  quan_nhan_id: z.number().optional(),
  co_quan_don_vi_id: z.string().optional(),
  don_vi_truc_thuoc_id: z.string().optional(),
  chuc_vu_id: z.string().optional(),
});

export const accountCreateSchema = z
  .object({
    username: z.string().min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    confirmPassword: z.string().min(6, 'Mật khẩu xác nhận phải có ít nhất 6 ký tự'),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
    co_quan_don_vi_id: z.string().optional(), // Cơ quan đơn vị (UUID)
    don_vi_truc_thuoc_id: z.string().optional(), // Đơn vị trực thuộc (UUID)
    chuc_vu_id: z.string().optional(), // Chức vụ (UUID)
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })
  .refine(
    data => {
      if (data.role === 'MANAGER') {
        return !!data.co_quan_don_vi_id && !!data.chuc_vu_id && !data.don_vi_truc_thuoc_id;
      }
      return true;
    },
    {
      message: 'Tài khoản MANAGER cần Cơ quan đơn vị và Chức vụ (không chọn Đơn vị trực thuộc)',
      path: ['co_quan_don_vi_id'],
    }
  )
  .refine(
    data => {
      if (data.role === 'USER') {
        return !!data.co_quan_don_vi_id && !!data.don_vi_truc_thuoc_id && !!data.chuc_vu_id;
      }
      return true;
    },
    {
      message: 'Tài khoản USER cần Cơ quan đơn vị, Đơn vị trực thuộc và Chức vụ',
      path: ['don_vi_truc_thuoc_id'],
    }
  );

export const accountEditSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
  quan_nhan_id: z.number().optional(),
});

// Personnel schemas
export const personnelFormSchema = z
  .object({
    cccd: z.string().min(9, 'CCCD phải có ít nhất 9 ký tự'),
    ho_ten: z.string().min(1, 'Họ tên là bắt buộc'),
    ngay_sinh: z.string().optional(),
    ngay_nhap_ngu: z.string().min(1, 'Ngày nhập ngũ là bắt buộc'),
    co_quan_don_vi_id: z.string().optional(),
    don_vi_truc_thuoc_id: z.string().optional(),
    chuc_vu_id: z.string().min(1, 'Chức vụ là bắt buộc'),
  })
  .refine(data => data.co_quan_don_vi_id || data.don_vi_truc_thuoc_id, {
    message: 'Vui lòng chọn cơ quan đơn vị hoặc đơn vị trực thuộc',
    path: ['co_quan_don_vi_id'],
  });

// Unit schemas
export const unitFormSchema = z.object({
  ma_don_vi: z.string().min(1, 'Mã cơ quan đơn vị trực thuộc là bắt buộc'),
  ten_don_vi: z.string().min(1, 'Tên cơ quan đơn vị trực thuộc là bắt buộc'),
});

// Position schemas
export const positionFormSchema = z.object({
  don_vi_id: z.string().optional(), // Optional vì khi edit không cần
  ten_chuc_vu: z.string().min(1, 'Tên chức vụ là bắt buộc'),
  is_manager: z.boolean().default(false),
  he_so_chuc_vu: z.number().optional(),
});
