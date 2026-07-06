import { z } from 'zod';
import { YEAR_MIN, YEAR_MAX } from '../constants/validation.constants';
import { addChainSqdIssues, PERSONAL_CHAIN_SQD_PAIRS } from './helpers/chainAwardSqd';

const refineAnnualChainSqd: (value: Record<string, unknown>, ctx: z.RefinementCtx) => void = (
  value,
  ctx
) => {
  addChainSqdIssues(value, ctx, PERSONAL_CHAIN_SQD_PAIRS);
};

export const createAnnualReward = z
  .object({
    personnel_id: z.string().trim().min(1, 'ID quân nhân là bắt buộc'),
    nam: z.number({ message: 'Năm là bắt buộc' }).int().min(YEAR_MIN).max(YEAR_MAX),
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
  })
  .superRefine(refineAnnualChainSqd);

export const updateAnnualReward = z
  .object({
    nam: z.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
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
  })
  .superRefine(refineAnnualChainSqd);

export const getAnnualRewardsQuery = z.object({
  personnel_id: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  danh_hieu: z.string().trim().optional(),
  ho_ten: z.string().trim().optional(),
});

export const exportAnnualRewardsQuery = z.object({
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  tu_nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  den_nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  danh_hieu: z.string().trim().optional(),
  don_vi_id: z.string().trim().optional(),
  personnel_ids: z.string().trim().optional(),
});

export const getAnnualRewardsStatisticsQuery = z.object({
  nam: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
});
