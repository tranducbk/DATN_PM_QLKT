import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../../repositories/unit.repository';
import { accountRepository } from '../../repositories/account.repository';
import type { Prisma } from '../../generated/prisma';
import { ROLES, SYSTEM_ACTOR } from '../../constants/roles.constants';
import { AUDIT_ACTIONS } from '../../constants/auditActions.constants';
import { SUPER_ADMIN_ONLY_RESOURCES } from '../../constants/resourceSlugs.constants';
import { isFeatureEnabled } from '../../helpers/settingsHelper';

/** Roles visible at each level (SYSTEM events visible to ADMIN and above) */
const VISIBLE_ROLES: Record<string, string[]> = {
  [ROLES.MANAGER]: [ROLES.USER, ROLES.MANAGER],
  [ROLES.ADMIN]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, SYSTEM_ACTOR],
  [ROLES.SUPER_ADMIN]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN, SYSTEM_ACTOR],
};

async function getManagerAccountIds(quanNhanId: string): Promise<string[]> {
  const manager = await quanNhanRepository.findUnitScope(quanNhanId);
  if (!manager) return [];

  const unitFilter = manager.co_quan_don_vi_id
    ? {
        OR: [
          { co_quan_don_vi_id: manager.co_quan_don_vi_id },
          {
            don_vi_truc_thuoc_id: {
              in: (
                await donViTrucThuocRepository.findIdsByCoQuanDonViId(manager.co_quan_don_vi_id)
              ).map(d => d.id),
            },
          },
        ],
      }
    : manager.don_vi_truc_thuoc_id
      ? { don_vi_truc_thuoc_id: manager.don_vi_truc_thuoc_id }
      : null;

  if (!unitFilter) return [];

  const personnelIds = (
    await quanNhanRepository.findManyRaw({ where: unitFilter, select: { id: true } })
  ).map(p => p.id);

  if (personnelIds.length === 0) return [];

  return (
    await accountRepository.findManyRaw({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { id: true },
    })
  ).map(a => a.id);
}

interface LogVisibilityScope {
  where: Prisma.SystemLogWhereInput;
  visibleRoles: string[];
  canViewErrors: boolean;
}

/**
 * Builds the role-based visibility filter for system logs, shared by the logs list and
 * the dashboard activity chart so both show exactly the same set of logs per role.
 * @param userRole - Role of the requesting user
 * @param quanNhanId - Personnel id of the manager (scopes logs to their unit)
 * @returns Base where clause plus the role's visible roles and error-view flag, or null when the role cannot view logs
 */
export async function buildLogVisibilityScope(
  userRole: string,
  quanNhanId?: string
): Promise<LogVisibilityScope | null> {
  const visibleRoles = VISIBLE_ROLES[userRole];
  if (!visibleRoles) return null;

  const where: Prisma.SystemLogWhereInput = { actor_role: { in: visibleRoles } };

  if (userRole === ROLES.MANAGER && quanNhanId) {
    const accountIds = await getManagerAccountIds(quanNhanId);
    where.nguoi_thuc_hien_id = { in: accountIds };
  }

  const canViewErrors = await isFeatureEnabled(`allow_view_errors_${userRole.toLowerCase()}`);
  if (!canViewErrors) {
    where.action = { not: AUDIT_ACTIONS.ERROR };
  }

  if (userRole !== ROLES.SUPER_ADMIN) {
    where.resource = { notIn: SUPER_ADMIN_ONLY_RESOURCES };
  }

  return { where, visibleRoles, canViewErrors };
}
