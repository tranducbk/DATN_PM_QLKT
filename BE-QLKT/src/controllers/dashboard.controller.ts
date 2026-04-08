import { Request, Response } from 'express';
import dashboardService from '../services/dashboard.service';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class DashboardController {
  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const data = await dashboardService.getStatistics();
    return ResponseHelper.success(res, { message: 'Lấy thống kê thành công', data });
  });

  getAdminStatistics = catchAsync(async (req: Request, res: Response) => {
    const data = await dashboardService.getAdminStatistics();
    return ResponseHelper.success(res, { message: 'Lấy thống kê Admin thành công', data });
  });

  getManagerStatistics = catchAsync(async (req: Request, res: Response) => {
    const currentUser = req.user!;
    const data = await dashboardService.getManagerStatistics(currentUser.id, currentUser.quan_nhan_id);
    return ResponseHelper.success(res, { message: 'Lấy thống kê Manager thành công', data });
  });
}

export default new DashboardController();
