import Joi from 'joi';

export const createPosition: Joi.ObjectSchema = Joi.object({
  unit_id: Joi.string().trim().required().messages({
    'any.required': 'ID đơn vị là bắt buộc',
  }),
  ten_chuc_vu: Joi.string().trim().required().messages({
    'any.required': 'Tên chức vụ là bắt buộc',
  }),
  is_manager: Joi.boolean().optional().default(false),
  he_so_chuc_vu: Joi.number()
    .min(0)
    .max(1)
    .custom((value, helpers) => {
      if (Math.round(value * 10) !== value * 10) {
        return helpers.error('number.precision');
      }
      return value;
    })
    .optional()
    .allow(null)
    .messages({
      'number.min': 'Hệ số chức vụ phải từ 0 đến 1',
      'number.max': 'Hệ số chức vụ phải từ 0 đến 1',
      'number.precision': 'Hệ số chức vụ chỉ được nhập 1 chữ số sau dấu phẩy (vd: 0.7, 0.8, 0.9, 1.0)',
    }),
});

export const updatePosition: Joi.ObjectSchema = Joi.object({
  ten_chuc_vu: Joi.string().trim().optional(),
  is_manager: Joi.boolean().optional(),
  he_so_chuc_vu: Joi.number()
    .min(0)
    .max(1)
    .custom((value, helpers) => {
      if (Math.round(value * 10) !== value * 10) {
        return helpers.error('number.precision');
      }
      return value;
    })
    .optional()
    .allow(null)
    .messages({
      'number.min': 'Hệ số chức vụ phải từ 0 đến 1',
      'number.max': 'Hệ số chức vụ phải từ 0 đến 1',
      'number.precision': 'Hệ số chức vụ chỉ được nhập 1 chữ số sau dấu phẩy (vd: 0.7, 0.8, 0.9, 1.0)',
    }),
});
