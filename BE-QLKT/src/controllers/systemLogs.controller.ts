import { Request, Response } from 'express';
import systemLogsService from '../services/systemLogs.service';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

interface GetLogsQuery {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  actorRole?: string;
}

interface DeleteLogsBody {
  ids?: string[];
}

class SystemLogsController {
  getLogs = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetLogsQuery;
    const currentUser = req.user!;
    const { page = 1, limit = 10, search, action, resource, startDate, endDate, actorRole } = query;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    const result = await systemLogsService.getLogs({
      page: pageNum,
      limit: limitNum,
      search: search as string,
      action: action as string,
      resource: resource as string,
      startDate: startDate as string,
      endDate: endDate as string,
      actorRole: actorRole as string,
      userRole: currentUser.role,
      quanNhanId: currentUser.quan_nhan_id,
      userId: currentUser.id,
    });

    if (!result) {
      return ResponseHelper.forbidden(res, 'Không có quyền xem nhật ký hệ thống');
    }

    return ResponseHelper.paginated(res, {
      data: result.logs,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      message: 'Lấy nhật ký hệ thống thành công',
      stats: result.stats,
    });
  });

  getActions = catchAsync(async (req: Request, res: Response) => {
    const data = await systemLogsService.getActions();
    return ResponseHelper.success(res, { message: 'Lấy danh sách hành động thành công', data });
  });

  getResources = catchAsync(async (req: Request, res: Response) => {
    const data = await systemLogsService.getResources(req.user!.role);
    return ResponseHelper.success(res, { message: 'Lấy danh sách tài nguyên thành công', data });
  });

  deleteLogs = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as DeleteLogsBody;
    const { ids } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return ResponseHelper.badRequest(res, 'Danh sách ID không hợp lệ');
    }
    const deleted = await systemLogsService.deleteLogs(ids);
    return ResponseHelper.success(res, { message: `Đã xoá ${deleted} nhật ký`, data: { deleted } });
  });

  deleteAllLogs = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const deleted = await systemLogsService.deleteAllLogs(user.id, user.role);
    return ResponseHelper.success(res, { message: `Đã xoá toàn bộ ${deleted} nhật ký`, data: { deleted } });
  });
}

export default new SystemLogsController();
