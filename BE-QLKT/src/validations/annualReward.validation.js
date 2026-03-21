const Joi = require('joi');

const createAnnualReward = Joi.object({
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

const updateAnnualReward = Joi.object({
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

const bulkCreate = Joi.object({
  personnel_ids: Joi.array().items(Joi.string().trim()).optional(),
  personnel_rewards_data: Joi.array().optional(),
  nam: Joi.number().integer().min(1900).max(2100).required(),
  danh_hieu: Joi.string().trim().required(),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  so_quyet_dinh: Joi.string().trim().optional().allow(null, ''),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
});

module.exports = { createAnnualReward, updateAnnualReward, bulkCreate };
