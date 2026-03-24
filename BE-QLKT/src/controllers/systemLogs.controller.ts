import { Request, Response } from 'express';
import { prisma } from '../models';
import { ROLES } from '../constants/roles';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

class SystemLogsController {
  getLogs = catchAsync(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      search,
      action,
      resource,
      startDate,
      endDate,
      actorRole,
    } = req.query;
    const currentUser = req.user!;
    const roleHierarchy: Record<string, number> = {
      USER: 1,
      MANAGER: 2,
      ADMIN: 3,
      SUPER_ADMIN: 4,
    };
    const currentUserLevel = roleHierarchy[currentUser.role] || 0;
    const allowedRoles = Object.keys(roleHierarchy).filter(
      role => roleHierarchy[role] <= currentUserLevel
    );
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const where: Record<string, any> = {};

    if (currentUser.role === ROLES.MANAGER) {
      where.actor_role = { in: ['USER', ROLES.MANAGER] };
      if (currentUser.quan_nhan_id) {
        const managerPersonnel = await prisma.quanNhan.findUnique({
          where: { id: currentUser.quan_nhan_id },
          select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
        });
        if (managerPersonnel) {
          let personnelInUnit: { id: string }[] = [];
          if (managerPersonnel.co_quan_don_vi_id) {
            const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
              where: { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
              select: { id: true },
            });
            const donViTrucThuocIdList = donViTrucThuocIds.map((d: { id: string }) => d.id);
            personnelInUnit = await prisma.quanNhan.findMany({
              where: {
                OR: [
                  { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
                  { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
                ],
              },
              select: { id: true },
            });
          } else if (managerPersonnel.don_vi_truc_thuoc_id) {
            personnelInUnit = await prisma.quanNhan.findMany({
              where: { don_vi_truc_thuoc_id: managerPersonnel.don_vi_truc_thuoc_id },
              select: { id: true },
            });
          }
          const personnelIds = personnelInUnit.map(p => p.id);
          if (personnelIds.length > 0) {
            const accountsInUnit = await prisma.taiKhoan.findMany({
              where: { quan_nhan_id: { in: personnelIds } },
              select: { id: true },
            });
            const accountIds = accountsInUnit.map((a: { id: string }) => a.id);
            where.nguoi_thuc_hien_id = accountIds.length > 0 ? { in: accountIds } : { in: [] };
          } else {
            where.nguoi_thuc_hien_id = { in: [] };
          }
        }
      }
    } else if (currentUser.role === ROLES.ADMIN) {
      where.actor_role = { in: ['USER', ROLES.MANAGER, ROLES.ADMIN] };
    } else if (currentUser.role === ROLES.SUPER_ADMIN) {
      if (actorRole && allowedRoles.includes(actorRole as string)) where.actor_role = actorRole;
      else where.actor_role = { in: allowedRoles };
    } else {
      return ResponseHelper.forbidden(res, 'Không có quyền xem nhật ký hệ thống');
    }

    if (actorRole && allowedRoles.includes(actorRole as string)) where.actor_role = actorRole;
    if (search) where.description = { contains: search, mode: 'insensitive' };
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate)
        (where.created_at as Record<string, unknown>).gte = new Date(startDate as string);
      if (endDate) (where.created_at as Record<string, unknown>).lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.systemLog.findMany({
        skip,
        take: parseInt(limit as string),
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
    ]);

    return ResponseHelper.success(res, {
      message: 'Lấy nhật ký hệ thống thành công',
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      },
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
