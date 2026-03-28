import Joi from 'joi';

export const createPersonnel: Joi.ObjectSchema = Joi.object({
  cccd: Joi.string().trim().length(12).pattern(/^\d+$/).required().messages({
    'string.length': 'CCCD phải có đúng 12 số',
    'string.pattern.base': 'CCCD chỉ được chứa số',
    'any.required': 'CCCD là bắt buộc',
  }),
  unit_id: Joi.string().trim().optional(),
  position_id: Joi.string().trim().optional(),
  role: Joi.string().valid('ADMIN', 'MANAGER', 'USER').optional(),
});

export const updatePersonnel: Joi.ObjectSchema = Joi.object({
  ho_ten: Joi.string().trim().max(100).optional(),
  gioi_tinh: Joi.string().valid('NAM', 'NU').optional(),
  ngay_sinh: Joi.date().optional().allow(null),
  cccd: Joi.string().trim().length(12).pattern(/^\d+$/).optional().allow(null, ''),
  cap_bac: Joi.string().trim().optional().allow(null, ''),
  ngay_nhap_ngu: Joi.date().optional().allow(null),
  ngay_xuat_ngu: Joi.date().optional().allow(null),
  que_quan_2_cap: Joi.string().trim().optional().allow(null, ''),
  que_quan_3_cap: Joi.string().trim().optional().allow(null, ''),
  tru_quan: Joi.string().trim().optional().allow(null, ''),
  cho_o_hien_nay: Joi.string().trim().optional().allow(null, ''),
  ngay_vao_dang: Joi.date().optional().allow(null),
  ngay_vao_dang_chinh_thuc: Joi.date().optional().allow(null),
  so_the_dang_vien: Joi.string().trim().optional().allow(null, ''),
  so_dien_thoai: Joi.string().trim().optional().allow(null, ''),
  unit_id: Joi.string().trim().optional(),
  position_id: Joi.string().trim().optional(),
  don_vi_id: Joi.string().trim().optional(),
  chuc_vu_id: Joi.string().trim().optional(),
  co_quan_don_vi_id: Joi.string().trim().optional(),
  don_vi_truc_thuoc_id: Joi.string().trim().optional().allow(null, ''),
});

export const listQuery: Joi.ObjectSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(20),
  search: Joi.string().trim().allow('').optional(),
  unit_id: Joi.string().trim().optional(),
});
