import Joi from 'joi';

export const login: Joi.ObjectSchema = Joi.object({
  username: Joi.string().trim().required().messages({
    'string.empty': 'Tên đăng nhập không được để trống',
    'any.required': 'Tên đăng nhập là bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
});

export const changePassword: Joi.ObjectSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'any.required': 'Mật khẩu hiện tại là bắt buộc',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
    'any.required': 'Mật khẩu mới là bắt buộc',
  }),
});

export const refreshToken: Joi.ObjectSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token là bắt buộc',
  }),
});
