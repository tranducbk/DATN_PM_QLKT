import Joi from 'joi';

export const createUnit: Joi.ObjectSchema = Joi.object({
  ma_don_vi: Joi.string().trim().required().messages({
    'any.required': 'Mã đơn vị là bắt buộc',
  }),
  ten_don_vi: Joi.string().trim().required().messages({
    'any.required': 'Tên đơn vị là bắt buộc',
  }),
  co_quan_don_vi_id: Joi.string().trim().optional().allow(null),
});

export const updateUnit: Joi.ObjectSchema = Joi.object({
  ma_don_vi: Joi.string().trim().optional(),
  ten_don_vi: Joi.string().trim().optional(),
  co_quan_don_vi_id: Joi.string().trim().optional().allow(null),
});
