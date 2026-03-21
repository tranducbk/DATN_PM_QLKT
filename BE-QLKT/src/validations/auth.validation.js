const Joi = require('joi');

const login = Joi.object({
  username: Joi.string().trim().required().messages({
    'string.empty': 'Tên đăng nhập không được để trống',
    'any.required': 'Tên đăng nhập là bắt buộc',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc',
  }),
});

const changePassword = Joi.object({
  oldPassword: Joi.string().required().messages({
    'any.required': 'Mật khẩu hiện tại là bắt buộc',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 8 ký tự',
    'any.required': 'Mật khẩu mới là bắt buộc',
  }),
});

const refreshToken = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token là bắt buộc',
  }),
});

module.exports = { login, changePassword, refreshToken };
