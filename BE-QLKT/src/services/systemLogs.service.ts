import { prisma } from '../models';
import { ROLES } from '../constants/roles.constants';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { isFeatureEnabled } from '../helpers/settingsHelper';

/** Roles visible at each level (SYSTEM events visible to ADMIN and above) */
const VISIBLE_ROLES: Record<string, string[]> = {
  [ROLES.MANAGER]: [ROLES.USER, ROLES.MANAGER],
  [ROLES.ADMIN]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, 'SYSTEM'],
  [ROLES.SUPER_ADMIN]: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, ROLES.SUPER_ADMIN, 'SYSTEM'],
};

async function getManagerAccountIds(quanNhanId: string): Promise<string[]> {
  const manager = await prisma.quanNhan.findUnique({
    where: { id: quanNhanId },
    select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
  });
  if (!manager) return [];

  const unitFilter = manager.co_quan_don_vi_id
    ? {
        OR: [
          { co_quan_don_vi_id: manager.co_quan_don_vi_id },
          {
            don_vi_truc_thuoc_id: {
              in: (
                await prisma.donViTrucThuoc.findMany({
                  where: { co_quan_don_vi_id: manager.co_quan_don_vi_id },
                  select: { id: true },
                })
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
    await prisma.quanNhan.findMany({ where: unitFilter, select: { id: true } })
  ).map(p => p.id);

  if (personnelIds.length === 0) return [];

  return (
    await prisma.taiKhoan.findMany({
      where: { quan_nhan_id: { in: personnelIds } },
      select: { id: true },
    })
  ).map(a => a.id);
}

interface GetLogsParams {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  actorRole?: string;
  userRole: string;
  quanNhanId?: string;
}

class SystemLogsService {
  /**
   * Returns paginated system logs filtered by role and query params.
   * @param params - Filter and pagination params
   * @returns Logs, total count, and action stats
   */
  async getLogs(params: GetLogsParams) {
    const { page, limit, search, action, resource, startDate, endDate, actorRole, userRole, quanNhanId } = params;

    const visibleRoles = VISIBLE_ROLES[userRole];
    if (!visibleRoles) return null;

    const where: Record<string, any> = {};

    if (actorRole && visibleRoles.includes(actorRole)) {
      where.actor_role = actorRole;
    } else {
      where.actor_role = { in: visibleRoles };
    }

    if (userRole === ROLES.MANAGER && quanNhanId) {
      const accountIds = await getManagerAccountIds(quanNhanId);
      where.nguoi_thuc_hien_id = { in: accountIds };
    }

    const roleKey = userRole.toLowerCase();
    const canViewErrors = await isFeatureEnabled(`allow_view_errors_${roleKey}`);
    if (!canViewErrors) {
      where.action = action && action !== 'ERROR' ? action : { not: 'ERROR' };
    } else if (action) {
      where.action = action;
    }

    if (search) where.description = { contains: search, mode: 'insensitive' };

    // Backup logs are restricted to SUPER_ADMIN only
    if (userRole !== ROLES.SUPER_ADMIN) {
      if (resource) {
        if (resource === 'backup') return { logs: [], total: 0, stats: { create: 0, delete: 0, update: 0 } };
        where.resource = resource;
      } else {
        where.resource = { not: 'backup' };
      }
    } else if (resource) {
      where.resource = resource;
    }

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const [logs, total, createCount, deleteCount, updateCount] = await Promise.all([
      prisma.systemLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where,
        include: {
          NguoiThucHien: {
            select: {
              id: true,
              username: true,
              role: true,
              QuanNhan: { select: { ho_ten: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.systemLog.count({ where }),
      prisma.systemLog.count({ where: { ...where, action: { contains: 'CREATE' } } }),
      prisma.systemLog.count({ where: { ...where, action: { contains: 'DELETE' } } }),
      prisma.systemLog.count({ where: { ...where, action: { contains: 'UPDATE' } } }),
    ]);

    return { logs, total, stats: { create: createCount, delete: deleteCount, update: updateCount } };
  }

  /**
   * Returns distinct action values from system logs.
   * @returns List of action strings
   */
  async getActions() {
    const actions = await prisma.systemLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return actions.map((item: { action: string }) => item.action);
  }

  /**
   * Returns distinct resource values from system logs, filtered by caller's role.
   * @param userRole - Role of the requesting user
   * @returns List of resource strings visible to that role
   */
  async getResources(userRole: string) {
    const where = userRole !== ROLES.SUPER_ADMIN ? { resource: { not: 'backup' } } : {};
    const resources = await prisma.systemLog.findMany({
      select: { resource: true },
      distinct: ['resource'],
      where,
      orderBy: { resource: 'asc' },
    });
    return resources.map((item: { resource: string }) => item.resource);
  }

  /**
   * Deletes system logs by IDs.
   * @param ids - List of log IDs to delete
   * @returns Number of deleted records
   */
  async deleteLogs(ids: string[]) {
    const result = await prisma.systemLog.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  }

  /**
   * Deletes all system logs and writes an audit entry.
   * @param actorId - ID of the user performing the action
   * @param actorRole - Role of the user performing the action
   * @returns Number of deleted records
   */
  async deleteAllLogs(actorId: string, actorRole: string) {
    const count = await prisma.systemLog.count();
    await prisma.systemLog.deleteMany({});
    await prisma.systemLog.create({
      data: {
        nguoi_thuc_hien_id: actorId,
        actor_role: actorRole,
        action: AUDIT_ACTIONS.DELETE,
        resource: 'system-logs',
        description: `Xoá toàn bộ ${count} nhật ký hệ thống`,
      },
    });
    return count;
  }
}

export default new SystemLogsService();
