import Joi from 'joi';

export const createAccount: Joi.ObjectSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required().messages({
    'string.min': 'Tên đăng nhập phải có ít nhất 3 ký tự',
    'string.max': 'Tên đăng nhập không được quá 50 ký tự',
    'any.required': 'Tên đăng nhập là bắt buộc',
  }),
  password: Joi.string().allow('').min(8).optional(),
  role: Joi.string().valid('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER').required().messages({
    'any.only': 'Vai trò không hợp lệ',
    'any.required': 'Vai trò là bắt buộc',
  }),
  personnel_id: Joi.string().trim().optional(),
  co_quan_don_vi_id: Joi.string().trim().optional(),
  don_vi_truc_thuoc_id: Joi.string().trim().optional(),
  chuc_vu_id: Joi.string().trim().optional(),
});

export const updateAccount: Joi.ObjectSchema = Joi.object({
  role: Joi.string().valid('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER').optional(),
  password: Joi.string().min(8).optional(),
});

export const resetPassword: Joi.ObjectSchema = Joi.object({
  account_id: Joi.string().trim().required().messages({
    'any.required': 'ID tài khoản là bắt buộc',
  }),
});

export const idParam: Joi.ObjectSchema = Joi.object({
  id: Joi.string().trim().required().messages({
    'any.required': 'ID là bắt buộc',
  }),
});

export const listQuery: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(20),
  search: Joi.string().trim().allow('').optional(),
  role: Joi.string().valid('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER').optional(),
});
