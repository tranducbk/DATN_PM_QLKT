import { z } from 'zod';
import { YEAR_MIN, YEAR_MAX } from '../constants/validation.constants';

export const listUnitAnnualAwardsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  year: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  don_vi_id: z.string().trim().optional(),
  danh_hieu: z.string().trim().optional(),
});

export const exportUnitAnnualAwardsQuery = z.object({
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  danh_hieu: z.string().trim().optional(),
});

export const getUnitAnnualAwardsStatisticsQuery = z.object({
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
});

export const upsertUnitAnnualAward = z.object({
  don_vi_id: z.string().trim().min(1),
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX),
  danh_hieu: z.string().trim().optional(),
  so_quyet_dinh: z.string().trim().optional(),
  ghi_chu: z.string().trim().optional(),
});

export const proposeUnitAnnualAward = z.object({
  don_vi_id: z.string().trim().min(1),
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX),
  danh_hieu: z.string().trim().optional(),
  ghi_chu: z.string().trim().optional(),
});
