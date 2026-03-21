const Joi = require('joi');

const createUnit = Joi.object({
  ma_don_vi: Joi.string().trim().required().messages({
    'any.required': 'Mã đơn vị là bắt buộc',
  }),
  ten_don_vi: Joi.string().trim().required().messages({
    'any.required': 'Tên đơn vị là bắt buộc',
  }),
  co_quan_don_vi_id: Joi.string().trim().optional().allow(null),
});

const updateUnit = Joi.object({
  ma_don_vi: Joi.string().trim().optional(),
  ten_don_vi: Joi.string().trim().optional(),
  co_quan_don_vi_id: Joi.string().trim().optional().allow(null),
});

module.exports = { createUnit, updateUnit };
