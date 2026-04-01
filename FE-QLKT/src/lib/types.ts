/** Tài khoản, ngày, entity đơn giản. Chi tiết danh sách quân nhân: `personnelList.ts`. */

import { ROLES } from '@/constants/roles.constants';

export const USER_ROLE_VALUES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.USER,
] as const;

/** Vai trò tài khoản — khớp BE / JWT */
export type UserRole = (typeof USER_ROLE_VALUES)[number];

/** Ngày từ API/form: ISO string, `Date`, hoặc thiếu. */
export type DateInput = string | Date | null | undefined;

/** Điểm thời gian bắt buộc (không null) — ví dụ `calculateDuration` */
export type DatePoint = string | Date;

/** Tài khoản trong danh sách / layout (payload tóm tắt từ API). */
export interface Account {
  id: string;
  username: string;
  personnel_id: string;
  personnel_name: string;
  role: UserRole;
  created_at: string;
}

/** Quân nhân flat (`don_vi_id` đơn); cây đơn vị đầy đủ — `PersonnelListItem` trong `personnelList.ts`. */
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

/** Đơn vị tóm tắt; không dùng cho cây admin (`UnitApiRow`). */
export interface Unit {
  id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  quan_so: number;
}

/** Chức vụ theo đơn vị đơn; phân cấp CQ/ĐVTT — `ManagerPositionRow` trong `personnelList.ts`. */
export interface Position {
  id: string;
  ten_chuc_vu: string;
  is_manager: boolean;
  he_so_chuc_vu?: number;
  don_vi_id: string;
}
