import { Request, Response } from 'express';
import positionHistoryService from '../services/positionHistory.service';
import profileService from '../services/profile.service';
import { normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { writeSystemLog } from '../helpers/systemLogHelper';

class PositionHistoryController {
  getPositionHistory = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as { personnel_id?: string; recalculate?: string };
    const { personnel_id, recalculate } = query;
    if (!personnel_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin quân nhân');
    }
    if (recalculate === 'true') {
      try {
        await profileService.recalculateContributionProfile(personnel_id);
      } catch (recalcError) {
        writeSystemLog({ action: 'ERROR', resource: 'profiles', description: `Lỗi tính lại hồ sơ cống hiến: ${recalcError}` });
      }
    }
    const result = await positionHistoryService.getPositionHistory(personnel_id);
    return ResponseHelper.success(res, {
      message: 'Lấy lịch sử chức vụ thành công',
      data: result,
    });
  });

  createPositionHistory = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as { personnelId?: string };
    const body = req.body as {
      personnel_id?: string;
      chuc_vu_id?: string;
      ngay_bat_dau?: string;
      ngay_ket_thuc?: string | null;
    };
    const personnel_id = normalizeParam(params.personnelId) || body.personnel_id;
    const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc } = body;
    if (!personnel_id || !chuc_vu_id || !ngay_bat_dau) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ: quân nhân, chức vụ và ngày bắt đầu'
      );
    }
    const result = await positionHistoryService.createPositionHistory({
      personnel_id,
      chuc_vu_id,
      ngay_bat_dau,
      ngay_ket_thuc,
    });
    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (recalcError) {
      writeSystemLog({ action: 'ERROR', resource: 'profiles', description: `Lỗi tính lại hồ sơ hằng năm sau khi thêm chức vụ: ${recalcError}` });
    }
    return ResponseHelper.created(res, {
      message: 'Thêm lịch sử chức vụ thành công',
      data: result,
    });
  });

  updatePositionHistory = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as { id?: string };
    const body = req.body as { chuc_vu_id?: string; ngay_bat_dau?: string; ngay_ket_thuc?: string | null };
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc } = body;
    const result = await positionHistoryService.updatePositionHistory(id, {
      chuc_vu_id,
      ngay_bat_dau,
      ngay_ket_thuc,
    });
    try {
      const personnelId = result.data?.quan_nhan_id;
      if (personnelId) await profileService.recalculateAnnualProfile(personnelId);
    } catch (recalcError) {
      writeSystemLog({ action: 'ERROR', resource: 'profiles', description: `Lỗi tính lại hồ sơ hằng năm sau khi cập nhật chức vụ: ${recalcError}` });
    }
    const response: Record<string, unknown> = {
      success: true,
      message: 'Cập nhật lịch sử chức vụ thành công',
      data: result.data || result,
    };
    if (result.warning) response.warning = result.warning;
    return res.status(200).json(response);
  });

  deletePositionHistory = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as { id?: string };
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const result = await positionHistoryService.deletePositionHistory(id);
    if (result.quan_nhan_id) {
      try {
        await profileService.recalculateAnnualProfile(result.quan_nhan_id);
      } catch (recalcError) {
        writeSystemLog({ action: 'ERROR', resource: 'profiles', description: `Lỗi tính lại hồ sơ hằng năm sau khi xóa chức vụ: ${recalcError}` });
      }
    }
    return ResponseHelper.success(res, { message: result.message, data: { id } });
  });
}

export default new PositionHistoryController();
