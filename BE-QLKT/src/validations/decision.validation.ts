import { z } from 'zod';

export const createDecision = z.object({
  so_quyet_dinh: z.string().trim().min(1, 'Số quyết định là bắt buộc'),
  nam: z.number({ message: 'Năm là bắt buộc' }).int().min(1900).max(2100),
  ngay_ky: z.coerce.date({ message: 'Ngày ký là bắt buộc' }),
  nguoi_ky: z.string().trim().nullable().optional(),
  loai_khen_thuong: z.string().trim().min(1, 'Loại khen thưởng là bắt buộc'),
  ghi_chu: z.string().trim().nullable().optional(),
});

export const updateDecision = z.object({
  so_quyet_dinh: z.string().trim().optional(),
  nam: z.number().int().min(1900).max(2100).optional(),
  ngay_ky: z.coerce.date().optional(),
  nguoi_ky: z.string().trim().nullable().optional(),
  loai_khen_thuong: z.string().trim().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
  file_path: z.string().trim().nullable().optional(),
});
