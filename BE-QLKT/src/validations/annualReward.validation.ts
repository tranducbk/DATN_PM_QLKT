import { z } from 'zod';

export const createAnnualReward = z.object({
  personnel_id: z.string().trim().min(1, 'ID quân nhân là bắt buộc'),
  nam: z
    .number({ message: 'Năm là bắt buộc' })
    .int()
    .min(1900)
    .max(2100),
  danh_hieu: z.string().trim().min(1, 'Danh hiệu là bắt buộc'),
  cap_bac: z.string().trim().nullable().optional(),
  chuc_vu: z.string().trim().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
  nhan_bkbqp: z.boolean().optional(),
  so_quyet_dinh_bkbqp: z.string().trim().nullable().optional(),
  nhan_cstdtq: z.boolean().optional(),
  so_quyet_dinh_cstdtq: z.string().trim().nullable().optional(),
  nhan_bkttcp: z.boolean().optional(),
  so_quyet_dinh_bkttcp: z.string().trim().nullable().optional(),
});

export const updateAnnualReward = z.object({
  nam: z.number().int().min(1900).max(2100).optional(),
  danh_hieu: z.string().trim().optional(),
  cap_bac: z.string().trim().nullable().optional(),
  chuc_vu: z.string().trim().nullable().optional(),
  ghi_chu: z.string().trim().nullable().optional(),
  nhan_bkbqp: z.boolean().optional(),
  so_quyet_dinh_bkbqp: z.string().trim().nullable().optional(),
  nhan_cstdtq: z.boolean().optional(),
  so_quyet_dinh_cstdtq: z.string().trim().nullable().optional(),
  nhan_bkttcp: z.boolean().optional(),
  so_quyet_dinh_bkttcp: z.string().trim().nullable().optional(),
});

const personnelIdsSchema = z.union([
  z.array(z.string().trim()).min(1),
  z.string().transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed) || !parsed.every((x: unknown) => typeof x === 'string')) {
        ctx.addIssue({ code: 'custom', message: 'personnel_ids không hợp lệ' });
        return z.NEVER;
      }
      return parsed as string[];
    } catch (error) {
      console.error('Failed to parse annualReward selected_personnel JSON:', error);
      ctx.addIssue({ code: 'custom', message: 'personnel_ids không hợp lệ' });
      return z.NEVER;
    }
  }),
]);

const personnelRewardsDataSchema = z.union([
  z.array(z.record(z.string(), z.unknown())),
  z.string().transform((value, ctx) => {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({ code: 'custom', message: 'personnel_rewards_data không hợp lệ' });
        return z.NEVER;
      }
      return parsed as unknown[];
    } catch (error) {
      console.error('Failed to parse annualReward title_data JSON:', error);
      ctx.addIssue({ code: 'custom', message: 'personnel_rewards_data không hợp lệ' });
      return z.NEVER;
    }
  }),
]);

export const bulkCreate = z.object({
  personnel_ids: personnelIdsSchema,
  personnel_rewards_data: personnelRewardsDataSchema.optional(),
  nam: z.number().int().min(1900).max(2100),
  danh_hieu: z.string().trim().min(1),
  ghi_chu: z.string().trim().nullable().optional(),
  so_quyet_dinh: z.string().trim().nullable().optional(),
  cap_bac: z.string().trim().nullable().optional(),
  chuc_vu: z.string().trim().nullable().optional(),
});

export const checkAnnualRewards = z.object({
  personnel_ids: z.array(z.string().trim()).min(1),
  nam: z.number().int().min(1900).max(2100),
  danh_hieu: z.string().trim().min(1),
});

export const getAnnualRewardsQuery = z.object({
  personnel_id: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
  danh_hieu: z.string().trim().optional(),
  ho_ten: z.string().trim().optional(),
});

export const exportAnnualRewardsQuery = z.object({
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
  danh_hieu: z.string().trim().optional(),
  don_vi_id: z.string().trim().optional(),
  personnel_ids: z.string().trim().optional(),
});

export const getAnnualRewardsStatisticsQuery = z.object({
  nam: z.coerce.number().int().min(1900).max(2100).optional(),
});
