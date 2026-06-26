import { systemLogRepository } from '../repositories/systemLog.repository';
import { ROLES } from '../constants/roles.constants';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS, SUPER_ADMIN_ONLY_RESOURCES } from '../constants/resourceSlugs.constants';
import { buildLogVisibilityScope } from './systemLog/logVisibility';

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
    const {
      page,
      limit,
      search,
      action,
      resource,
      startDate,
      endDate,
      actorRole,
      userRole,
      quanNhanId,
    } = params;

    const scope = await buildLogVisibilityScope(userRole, quanNhanId);
    if (!scope) return null;
    const { where, visibleRoles, canViewErrors } = scope;

    if (actorRole && visibleRoles.includes(actorRole)) {
      where.actor_role = actorRole;
    }

    if (!canViewErrors) {
      where.action =
        action && action !== AUDIT_ACTIONS.ERROR ? action : { not: AUDIT_ACTIONS.ERROR };
    } else if (action) {
      where.action = action;
    }

    if (search) where.description = { contains: search, mode: 'insensitive' };

    // Backup logs are restricted to SUPER_ADMIN only
    if (userRole !== ROLES.SUPER_ADMIN) {
      if (resource) {
        if (SUPER_ADMIN_ONLY_RESOURCES.includes(resource))
          return { logs: [], total: 0, stats: { create: 0, delete: 0, update: 0 } };
        where.resource = resource;
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
      systemLogRepository.findManyRaw({
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
        // createdAt is second-precision; CUID id (time-sortable) breaks ties so logs
        // created within the same second still display in true creation order.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      systemLogRepository.count(where),
      systemLogRepository.count({ ...where, action: { contains: 'CREATE' } }),
      systemLogRepository.count({ ...where, action: { contains: 'DELETE' } }),
      systemLogRepository.count({ ...where, action: { contains: 'UPDATE' } }),
    ]);

    return {
      logs,
      total,
      stats: { create: createCount, delete: deleteCount, update: updateCount },
    };
  }

  /**
   * Returns distinct action values from system logs.
   * @returns List of action strings
   */
  async getActions() {
    const actions = await systemLogRepository.findManyRaw({
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
    const where =
      userRole !== ROLES.SUPER_ADMIN ? { resource: { notIn: SUPER_ADMIN_ONLY_RESOURCES } } : {};
    const resources = await systemLogRepository.findManyRaw({
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
    const result = await systemLogRepository.deleteMany({ id: { in: ids } });
    return result.count;
  }

  /**
   * Deletes all system logs and writes an audit entry.
   * @param actorId - ID of the user performing the action
   * @param actorRole - Role of the user performing the action
   * @returns Number of deleted records
   */
  async deleteAllLogs(actorId: string, actorRole: string) {
    const count = await systemLogRepository.count({});
    await systemLogRepository.deleteMany({});
    await systemLogRepository.create({
      nguoi_thuc_hien_id: actorId,
      actor_role: actorRole,
      action: AUDIT_ACTIONS.DELETE,
      resource: RESOURCE_SLUGS.SYSTEM_LOGS,
      description: `Xóa toàn bộ ${count} nhật ký hệ thống`,
    });
    return count;
  }
}

export default new SystemLogsService();
