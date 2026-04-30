import { z } from 'zod';
import { ROLES } from '../constants/roles.constants';
import { GENDER } from '../constants/gender.constants';

export const createPersonnel = z.object({
  cccd: z
    .string()
    .trim()
    .length(12, 'CCCD phải có đúng 12 số')
    .regex(/^\d+$/, 'CCCD chỉ được chứa số'),
  unit_id: z.string().trim().optional(),
  position_id: z.string().trim().optional(),
  role: z.enum([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER]).optional(),
});

export const updatePersonnel = z.object({
  ho_ten: z.string().trim().max(100).optional(),
  gioi_tinh: z.enum(Object.values(GENDER) as [string, ...string[]]).optional(),
  ngay_sinh: z.coerce.date().nullable().optional(),
  cccd: z
    .string()
    .trim()
    .length(12, 'CCCD phải có đúng 12 số')
    .regex(/^\d+$/, 'CCCD chỉ được chứa số')
    .nullable()
    .optional()
    .or(z.literal('')),
  cap_bac: z.string().trim().nullable().optional(),
  ngay_nhap_ngu: z.coerce.date().nullable().optional(),
  ngay_xuat_ngu: z.coerce.date().nullable().optional(),
  que_quan_2_cap: z.string().trim().nullable().optional(),
  que_quan_3_cap: z.string().trim().nullable().optional(),
  tru_quan: z.string().trim().nullable().optional(),
  cho_o_hien_nay: z.string().trim().nullable().optional(),
  ngay_vao_dang: z.coerce.date().nullable().optional(),
  ngay_vao_dang_chinh_thuc: z.coerce.date().nullable().optional(),
  so_the_dang_vien: z.string().trim().nullable().optional(),
  so_dien_thoai: z.string().trim().nullable().optional(),
  unit_id: z.string().trim().optional(),
  position_id: z.string().trim().optional(),
  don_vi_id: z.string().trim().optional(),
  chuc_vu_id: z.string().trim().optional(),
  co_quan_don_vi_id: z.string().trim().optional(),
  don_vi_truc_thuoc_id: z.string().trim().nullable().optional(),
});

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).default(20),
  search: z.string().trim().optional(),
  unit_id: z.string().trim().optional(),
});
