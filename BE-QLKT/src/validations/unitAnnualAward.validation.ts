import Joi from 'joi';

export const listUnitAnnualAwardsQuery: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  year: Joi.number().integer().min(1900).max(2100).optional(),
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  don_vi_id: Joi.string().trim().optional(),
  danh_hieu: Joi.string().trim().optional(),
});

export const exportUnitAnnualAwardsQuery: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  danh_hieu: Joi.string().trim().optional(),
});

export const getUnitAnnualAwardsStatisticsQuery: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
});
