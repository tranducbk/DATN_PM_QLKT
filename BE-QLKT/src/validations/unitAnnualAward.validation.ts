import { z } from 'zod';

export const listUnitAnnualAwardsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
  don_vi_id: z.string().trim().optional(),
  danh_hieu: z.string().trim().optional(),
});

export const exportUnitAnnualAwardsQuery = z.object({
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
  danh_hieu: z.string().trim().optional(),
});

export const getUnitAnnualAwardsStatisticsQuery = z.object({
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
});
