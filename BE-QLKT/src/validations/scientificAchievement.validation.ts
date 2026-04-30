import { z } from 'zod';

export const createAchievement = z.object({
  personnel_id: z.string().trim().min(1, 'ID quân nhân là bắt buộc'),
  nam: z.number({ message: 'Năm là bắt buộc' }).int().min(1900).max(2100),
  loai: z.string().trim().min(1, 'Loại thành tích là bắt buộc'),
  mo_ta: z.string().trim().nullable().optional(),
  cap_bac: z.string().trim().nullable().optional(),
  chuc_vu: z.string().trim().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
  status: z.string().trim().optional(),
});

export const updateAchievement = z.object({
  nam: z.number().int().min(1900).max(2100).optional(),
  loai: z.string().trim().optional(),
  mo_ta: z.string().trim().nullable().optional(),
  cap_bac: z.string().trim().nullable().optional(),
  chuc_vu: z.string().trim().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
  status: z.string().trim().optional(),
});

export const getAchievementsQuery = z.object({
  personnel_id: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
  loai: z.string().trim().optional(),
  ho_ten: z.string().trim().optional(),
});

export const exportAchievementsQuery = z.object({
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
  loai: z.string().trim().optional(),
});
