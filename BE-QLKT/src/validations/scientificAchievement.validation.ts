import { z } from 'zod';
import { YEAR_MIN, YEAR_MAX } from '../constants/validation.constants';

export const getAchievementsQuery = z.object({
  personnel_id: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  loai: z.string().trim().optional(),
  ho_ten: z.string().trim().optional(),
});

export const exportAchievementsQuery = z.object({
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  loai: z.string().trim().optional(),
});
