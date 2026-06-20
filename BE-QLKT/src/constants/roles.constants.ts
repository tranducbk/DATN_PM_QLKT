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
 * Only a strictly higher rank qualifies — equal rank and higher are blocked.
 * @param actorRole - Role of the user performing the action
 * @param targetRole - Role of the account being acted on
 * @returns true when the actor outranks the target
 */
export function canManageRole(actorRole?: string, targetRole?: string): boolean {
  const actorRank = ROLE_RANK[actorRole as Role] ?? 0;
  const targetRank = ROLE_RANK[targetRole as Role] ?? 0;
  return actorRank > targetRank;
}

// Capability = a permission grouping. Authorization derives from ROLE_CAPABILITIES so
// adding a role means adding one matrix row, not editing scattered role comparisons.
export const CAPABILITIES = {
  SUPER_ADMIN_ONLY: 'SUPER_ADMIN_ONLY',
  SYSTEM_MANAGEMENT: 'SYSTEM_MANAGEMENT',
  ADMIN_BUSINESS: 'ADMIN_BUSINESS',
  PERSONNEL_MANAGEMENT: 'PERSONNEL_MANAGEMENT',
  PROPOSAL_BUSINESS: 'PROPOSAL_BUSINESS',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  [ROLES.SUPER_ADMIN]: [
    CAPABILITIES.SUPER_ADMIN_ONLY,
    CAPABILITIES.SYSTEM_MANAGEMENT,
    CAPABILITIES.PERSONNEL_MANAGEMENT,
  ],
  [ROLES.ADMIN]: [
    CAPABILITIES.SYSTEM_MANAGEMENT,
    CAPABILITIES.ADMIN_BUSINESS,
    CAPABILITIES.PERSONNEL_MANAGEMENT,
    CAPABILITIES.PROPOSAL_BUSINESS,
  ],
  [ROLES.MANAGER]: [CAPABILITIES.PERSONNEL_MANAGEMENT, CAPABILITIES.PROPOSAL_BUSINESS],
  [ROLES.USER]: [],
};

/**
 * Whether a role has a capability.
 * @param role - Role to check (undefined treated as no capabilities)
 * @param capability - Capability key
 * @returns true when the role's matrix row includes the capability
 */
export function hasCapability(role: string | undefined, capability: Capability): boolean {
  if (!role) return false;
  return (ROLE_CAPABILITIES[role as Role] ?? []).includes(capability);
}

/**
 * Lists the roles granted a capability — used to build route guards from the matrix.
 * @param capability - Capability key
 * @returns Roles whose matrix row includes the capability
 */
export function rolesWithCapability(capability: Capability): Role[] {
  return (Object.keys(ROLE_CAPABILITIES) as Role[]).filter(role =>
    ROLE_CAPABILITIES[role].includes(capability)
  );
}
