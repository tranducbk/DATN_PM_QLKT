/** Shared base types for accounts, dates, and simple entities. */

import { ROLES } from '@/constants/roles.constants';

/** Pagination metadata returned by list APIs. */
export type PaginationMeta = { total: number; page?: number; limit?: number; totalPages?: number };

/** Standard API response shape used across API modules. */
export type ApiResponse<T = any> = { success: boolean; data?: T; message?: string; pagination?: PaginationMeta };

export const USER_ROLE_VALUES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.USER,
] as const;

/** Vai trò tài khoản — khớp BE / JWT */
export type UserRole = (typeof USER_ROLE_VALUES)[number];

/** Date input from API/forms: ISO string, Date, null, or undefined. */
export type DateInput = string | Date | null | undefined;

/** Required date point (null is not allowed). */
export type DatePoint = string | Date;

/** Tài khoản trong danh sách / layout (payload tóm tắt từ API). */
export interface Account {
  id: string;
  username: string;
  personnel_id: string;
  personnel_name: string;
  role: UserRole;
  createdAt: string;
}

/** Flat personnel row used by simple list screens. */
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

/** Lightweight unit shape for quick selection/display. */
export interface Unit {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  quan_so: number;
}

/** Position data scoped to a single unit. */
export interface Position {
  id: string;
  ten_chuc_vu: string;
  is_manager: boolean;
  he_so_chuc_vu?: number;
  don_vi_id: string;
}
