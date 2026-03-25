// Types for QLKT API

import { ROLES } from '@/constants/roles.constants';

export const USER_ROLE_VALUES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.USER,
] as const;

/** Vai trò tài khoản — khớp BE / JWT */
export type UserRole = (typeof USER_ROLE_VALUES)[number];

/**
 * Giá trị ngày từ API (ISO string), `Date`, hoặc thiếu — dùng chung cho form/format
 * (tránh lặp `string | Date | null | undefined` khắp component)
 */
export type DateInput = string | Date | null | undefined;

/** Điểm thời gian bắt buộc (không null) — ví dụ `calculateDuration` */
export type DatePoint = string | Date;

export interface Account {
  id: string;
  username: string;
  personnel_id: string;
  personnel_name: string;
  role: UserRole;
  created_at: string;
}

export interface Personnel {
  id: string;
  cccd: string;
  ho_ten: string;
  don_vi_id: string;
  don_vi_name: string;
  chuc_vu_id: string;
  chuc_vu_name: string;
  ngay_nhap_ngu: string;
}

export interface Unit {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  quan_so: number;
}

export interface Position {
  id: string;
  ten_chuc_vu: string;
  is_manager: boolean;
  he_so_chuc_vu?: number;
  don_vi_id: string;
}
