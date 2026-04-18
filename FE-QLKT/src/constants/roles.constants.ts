export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Quản trị viên',
  ADMIN: 'Phòng Chính trị',
  MANAGER: 'Chỉ huy đơn vị',
  USER: 'Người dùng',
  SYSTEM: 'Hệ thống',
};

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'purple',
  ADMIN: 'red',
  MANAGER: 'blue',
  USER: 'green',
  SYSTEM: 'volcano',
};

export function roleSelectOptions(roles: Role[]): { value: Role; label: string }[] {
  return roles.map(value => ({ value, label: ROLE_LABELS[value] ?? value }));
}

export function getRoleInfo(role?: string): { label: string; color: string } {
  if (!role) return { label: 'Không xác định', color: 'default' };
  return {
    label: ROLE_LABELS[role] || role,
    color: ROLE_COLORS[role] || 'default',
  };
}
