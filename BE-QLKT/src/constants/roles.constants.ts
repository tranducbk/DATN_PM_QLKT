/**
 * Supported user roles in the system.
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: 'Quản trị viên',
  [ROLES.ADMIN]: 'Phòng Chính trị',
  [ROLES.MANAGER]: 'Chỉ huy đơn vị',
  [ROLES.USER]: 'Người dùng',
  SYSTEM: 'Hệ thống',
};
