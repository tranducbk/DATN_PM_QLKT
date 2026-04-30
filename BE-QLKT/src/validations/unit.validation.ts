import { z } from 'zod';

export const createUnit = z.object({
  ma_don_vi: z.string().trim().min(1, 'Mã đơn vị là bắt buộc'),
  ten_don_vi: z.string().trim().min(1, 'Tên đơn vị là bắt buộc'),
  co_quan_don_vi_id: z.string().trim().nullable().optional(),
});

export const updateUnit = z.object({
  ma_don_vi: z.string().trim().optional(),
  ten_don_vi: z.string().trim().optional(),
  co_quan_don_vi_id: z.string().trim().nullable().optional(),
});
