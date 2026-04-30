import { z } from 'zod';

const heSoChucVu = z
  .number()
  .min(0, 'Hệ số chức vụ phải từ 0 đến 1')
  .max(1, 'Hệ số chức vụ phải từ 0 đến 1')
  .refine(
    (value) => Math.round(value * 10) === value * 10,
    'Hệ số chức vụ chỉ được nhập 1 chữ số sau dấu phẩy (vd: 0.7, 0.8, 0.9, 1.0)'
  )
  .nullable()
  .optional();

export const createPosition = z.object({
  unit_id: z.string().trim().min(1, 'ID đơn vị là bắt buộc'),
  ten_chuc_vu: z.string().trim().min(1, 'Tên chức vụ là bắt buộc'),
  is_manager: z.boolean().optional().default(false),
  he_so_chuc_vu: heSoChucVu,
});

export const updatePosition = z.object({
  ten_chuc_vu: z.string().trim().optional(),
  is_manager: z.boolean().optional(),
  he_so_chuc_vu: heSoChucVu,
});
