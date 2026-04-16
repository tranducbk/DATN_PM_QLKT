import Joi from 'joi';

export const createAnnualReward: Joi.ObjectSchema = Joi.object({
  personnel_id: Joi.string().trim().required().messages({
    'any.required': 'ID quân nhân là bắt buộc',
  }),
  nam: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'Năm là bắt buộc',
  }),
  danh_hieu: Joi.string().trim().required().messages({
    'any.required': 'Danh hiệu là bắt buộc',
  }),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  nhan_bkbqp: Joi.boolean().optional(),
  so_quyet_dinh_bkbqp: Joi.string().trim().optional().allow(null, ''),
  nhan_cstdtq: Joi.boolean().optional(),
  so_quyet_dinh_cstdtq: Joi.string().trim().optional().allow(null, ''),
  nhan_bkttcp: Joi.boolean().optional(),
  so_quyet_dinh_bkttcp: Joi.string().trim().optional().allow(null, ''),
});

export const updateAnnualReward: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  danh_hieu: Joi.string().trim().optional(),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  nhan_bkbqp: Joi.boolean().optional(),
  so_quyet_dinh_bkbqp: Joi.string().trim().optional().allow(null, ''),
  nhan_cstdtq: Joi.boolean().optional(),
  so_quyet_dinh_cstdtq: Joi.string().trim().optional().allow(null, ''),
  nhan_bkttcp: Joi.boolean().optional(),
  so_quyet_dinh_bkttcp: Joi.string().trim().optional().allow(null, ''),
});

export const bulkCreate: Joi.ObjectSchema = Joi.object({
  personnel_ids: Joi.alternatives()
    .try(
      Joi.array().items(Joi.string().trim()).min(1),
      Joi.string().custom((value, helpers) => {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed) || !parsed.every((x: unknown) => typeof x === 'string')) {
            return helpers.error('any.invalid');
          }
          return parsed;
        } catch {
          return helpers.error('any.invalid');
        }
      }, 'parse personnel_ids json')
    )
    .required(),
  personnel_rewards_data: Joi.alternatives().try(
    Joi.array().items(Joi.object().unknown(true)),
    Joi.string().custom((value, helpers) => {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return helpers.error('any.invalid');
        return parsed;
      } catch {
        return helpers.error('any.invalid');
      }
    }, 'parse personnel_rewards_data json')
  ).optional(),
  nam: Joi.number().integer().min(1900).max(2100).required(),
  danh_hieu: Joi.string().trim().required(),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  so_quyet_dinh: Joi.string().trim().optional().allow(null, ''),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
});

export const checkAnnualRewards: Joi.ObjectSchema = Joi.object({
  personnel_ids: Joi.array().items(Joi.string().trim()).min(1).required(),
  nam: Joi.number().integer().min(1900).max(2100).required(),
  danh_hieu: Joi.string().trim().required(),
});

export const getAnnualRewardsQuery: Joi.ObjectSchema = Joi.object({
  personnel_id: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  danh_hieu: Joi.string().trim().optional(),
  ho_ten: Joi.string().trim().optional(),
});

export const exportAnnualRewardsQuery: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  danh_hieu: Joi.string().trim().optional(),
  don_vi_id: Joi.string().trim().optional(),
  personnel_ids: Joi.string().trim().optional(), // comma-separated
});

export const getAnnualRewardsStatisticsQuery: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
});
