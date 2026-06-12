import { z } from 'zod';

// Personnel schemas
export const personnelFormSchema = z
  .object({
    cccd: z.string().min(9, 'CCCD phải có ít nhất 9 ký tự'),
    ho_ten: z.string().min(1, 'Họ tên là bắt buộc'),
    ngay_sinh: z.string().optional(),
    ngay_nhap_ngu: z.string().min(1, 'Ngày nhập ngũ là bắt buộc'),
    co_quan_don_vi_id: z.string().optional(),
    don_vi_truc_thuoc_id: z.string().optional(),
    chuc_vu_id: z.string().min(1, 'Chức vụ là bắt buộc'),
  })
  .refine(data => data.co_quan_don_vi_id || data.don_vi_truc_thuoc_id, {
    message: 'Vui lòng chọn cơ quan đơn vị hoặc đơn vị trực thuộc',
    path: ['co_quan_don_vi_id'],
  });
