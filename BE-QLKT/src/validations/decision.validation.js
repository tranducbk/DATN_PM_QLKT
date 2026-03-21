const Joi = require('joi');

const createDecision = Joi.object({
  so_quyet_dinh: Joi.string().trim().required().messages({
    'any.required': 'Số quyết định là bắt buộc',
  }),
  nam: Joi.number().integer().min(1900).max(2100).required().messages({
    'any.required': 'Năm là bắt buộc',
  }),
  ngay_ky: Joi.date().required().messages({
    'any.required': 'Ngày ký là bắt buộc',
  }),
  nguoi_ky: Joi.string().trim().optional().allow(null, ''),
  loai_khen_thuong: Joi.string().trim().required().messages({
    'any.required': 'Loại khen thưởng là bắt buộc',
  }),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
});

const updateDecision = Joi.object({
  so_quyet_dinh: Joi.string().trim().optional(),
  nam: Joi.number().integer().min(1900).max(2100).optional(),
  ngay_ky: Joi.date().optional(),
  nguoi_ky: Joi.string().trim().optional().allow(null, ''),
  loai_khen_thuong: Joi.string().trim().optional(),
  ghi_chu: Joi.string().trim().optional().allow(null, ''),
  file_path: Joi.string().trim().optional().allow(null, ''),
});

module.exports = { createDecision, updateDecision };
