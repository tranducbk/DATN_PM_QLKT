import Joi from 'joi';

export const createPosition: Joi.ObjectSchema = Joi.object({
  unit_id: Joi.string().trim().required().messages({
    'any.required': 'ID đơn vị là bắt buộc',
  }),
  ten_chuc_vu: Joi.string().trim().required().messages({
    'any.required': 'Tên chức vụ là bắt buộc',
  }),
  is_manager: Joi.boolean().optional().default(false),
  he_so_chuc_vu: Joi.number().optional().allow(null),
});

export const updatePosition: Joi.ObjectSchema = Joi.object({
  ten_chuc_vu: Joi.string().trim().optional(),
  is_manager: Joi.boolean().optional(),
  he_so_chuc_vu: Joi.number().optional().allow(null),
});
