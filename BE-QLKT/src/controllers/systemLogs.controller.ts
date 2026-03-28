import { Request, Response } from 'express';
import { prisma } from '../models';
import { ROLES } from '../constants/roles.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

class SystemLogsController {
  // Roles mỗi cấp được xem (bao gồm SYSTEM cho ADMIN+)
  private static readonly VISIBLE_ROLES: Record<string, string[]> = {
    MANAGER: ['USER', 'MANAGER'],
    ADMIN: ['USER', 'MANAGER', 'ADMIN', 'SYSTEM'],
    SUPER_ADMIN: ['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM'],
  };

  /** Lấy danh sách account IDs trong đơn vị của manager */
  private async getManagerAccountIds(quanNhanId: string): Promise<string[]> {
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

  getLogs = catchAsync(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, search, action, resource, startDate, endDate, actorRole } =
      req.query;
    const currentUser = req.user!;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const visibleRoles = SystemLogsController.VISIBLE_ROLES[currentUser.role];
    if (!visibleRoles) {
      return ResponseHelper.forbidden(res, 'Không có quyền xem nhật ký hệ thống');
    }

    const where: Record<string, any> = {};

    // Filter theo role
    if (actorRole && visibleRoles.includes(actorRole as string)) {
      where.actor_role = actorRole;
    } else {
      where.actor_role = { in: visibleRoles };
    }

    // Manager chỉ xem log của đơn vị mình
    if (currentUser.role === ROLES.MANAGER && currentUser.quan_nhan_id) {
      const accountIds = await this.getManagerAccountIds(currentUser.quan_nhan_id);
      where.nguoi_thuc_hien_id = { in: accountIds };
    }

    // Các filter chung
    if (search) where.description = { contains: search, mode: 'insensitive' };
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (startDate || endDate) {
      where.created_at = {
        ...(startDate && { gte: new Date(startDate as string) }),
        ...(endDate && { lte: new Date(endDate as string) }),
      };
    }

    const [logs, total, createCount, deleteCount, updateCount] = await Promise.all([
      prisma.systemLog.findMany({
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
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
        orderBy: { created_at: 'desc' },
      }),
      prisma.systemLog.count({ where }),
      prisma.systemLog.count({ where: { ...where, action: { contains: 'CREATE' } } }),
      prisma.systemLog.count({ where: { ...where, action: { contains: 'DELETE' } } }),
      prisma.systemLog.count({ where: { ...where, action: { contains: 'UPDATE' } } }),
    ]);

    return ResponseHelper.paginated(res, {
      data: logs,
      total,
      page: pageNum,
      limit: limitNum,
      message: 'Lấy nhật ký hệ thống thành công',
      stats: { create: createCount, delete: deleteCount, update: updateCount },
    });
  });

  getActions = catchAsync(async (req: Request, res: Response) => {
    const actions = await prisma.systemLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách hành động thành công',
      data: actions.map((item: { action: string }) => item.action),
    });
  });

  getResources = catchAsync(async (req: Request, res: Response) => {
    const resources = await prisma.systemLog.findMany({
      select: { resource: true },
      distinct: ['resource'],
      orderBy: { resource: 'asc' },
    });
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách tài nguyên thành công',
      data: resources.map((item: { resource: string }) => item.resource),
    });
  });

  deleteLogs = catchAsync(async (req: Request, res: Response) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return ResponseHelper.badRequest(res, 'Danh sách ID không hợp lệ');
    }
    const result = await prisma.systemLog.deleteMany({ where: { id: { in: ids } } });
    return ResponseHelper.success(res, {
      message: `Đã xoá ${result.count} nhật ký`,
      data: { deleted: result.count },
    });
  });

  deleteAllLogs = catchAsync(async (req: Request, res: Response) => {
    const count = await prisma.systemLog.count();
    await prisma.systemLog.deleteMany({});
    await prisma.systemLog.create({
      data: {
        nguoi_thuc_hien_id: req.user!.id,
        actor_role: req.user!.role,
        action: AUDIT_ACTIONS.DELETE,
        resource: 'system-logs',
        description: `Xoá toàn bộ ${count} nhật ký hệ thống`,
      },
    });
    return ResponseHelper.success(res, {
      message: `Đã xoá toàn bộ ${count} nhật ký`,
      data: { deleted: count },
    });
  });
}

export default new SystemLogsController();
