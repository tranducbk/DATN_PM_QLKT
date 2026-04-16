import Joi from 'joi';

export const createAchievement: Joi.ObjectSchema = Joi.object({
  personnel_id: Joi.string().trim().required().messages({
    'any.required': 'ID quân nhân là bắt buộc',
  }),
  nam: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'Năm là bắt buộc',
  }),
  loai: Joi.string().trim().required().messages({
    'any.required': 'Loại thành tích là bắt buộc',
  }),
  mo_ta: Joi.string().trim().optional().allow(null, ''),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  status: Joi.string().trim().optional(),
});

export const updateAchievement: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  loai: Joi.string().trim().optional(),
  mo_ta: Joi.string().trim().optional().allow(null, ''),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  chuc_vu: Joi.string().trim().optional().allow(null, ''),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  status: Joi.string().trim().optional(),
});

export const getAchievementsQuery: Joi.ObjectSchema = Joi.object({
  personnel_id: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  loai: Joi.string().trim().optional(),
  ho_ten: Joi.string().trim().optional(),
});

export const exportAchievementsQuery: Joi.ObjectSchema = Joi.object({
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  loai: Joi.string().trim().optional(),
});
