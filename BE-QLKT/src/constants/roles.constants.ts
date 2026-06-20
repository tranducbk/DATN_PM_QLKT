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

/** Pseudo actor role for system-generated logs (no real account behind them). */
export const SYSTEM_ACTOR = 'SYSTEM';

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: 'Quản trị viên',
  [ROLES.ADMIN]: 'Phòng Chính trị',
  [ROLES.MANAGER]: 'Chỉ huy đơn vị',
  [ROLES.USER]: 'Người dùng',
  [SYSTEM_ACTOR]: 'Hệ thống',
};

/** Privilege ranking — higher number outranks lower. */
export const ROLE_RANK: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.MANAGER]: 2,
  [ROLES.USER]: 1,
};

/**
 * Whether an actor may delete/manage an account of the target role.
 * Only a strictly higher rank qualifies — equal rank (ngang quyền) and higher are blocked.
 * @param actorRole - Role of the user performing the action
 * @param targetRole - Role of the account being acted on
 * @returns true when the actor outranks the target
 */
export function canManageRole(actorRole?: string, targetRole?: string): boolean {
  const actorRank = ROLE_RANK[actorRole as Role] ?? 0;
  const targetRank = ROLE_RANK[targetRole as Role] ?? 0;
  return actorRank > targetRank;
}
