/**
 * Type dùng chung (auth, dashboard, form đơn giản).
 * Danh sách quân nhân chi tiết (normalize API, bảng admin/manager) — dùng `@/lib/types/personnelList`.
 */

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

/** Tài khoản trong danh sách / layout — khớp payload tóm tắt từ API. */
export interface Account {
  id: string;
  username: string;
  personnel_id: string;
  personnel_name: string;
  role: UserRole;
  created_at: string;
}

/**
 * Quân nhân dạng “flat” (một `don_vi_id`) — legacy / màn hình cũ.
 * Model đầy đủ cơ quan + đơn vị trực thuộc — xem `PersonnelListItem` trong `personnelList.ts`.
 */
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

/** Đơn vị tóm tắt (mã, tên, quân số) — không trùng `UnitApiRow` / cây admin. */
export interface Unit {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  quan_so: number;
}

/**
 * Chức vụ gắn một `don_vi_id` (mô hình đơn giản).
 * Phân cấp cơ quan / trực thuộc — xem `ManagerPositionRow` trong `personnelList.ts`.
 */
export interface Position {
  id: string;
  ten_chuc_vu: string;
  is_manager: boolean;
  he_so_chuc_vu?: number;
  don_vi_id: string;
}
