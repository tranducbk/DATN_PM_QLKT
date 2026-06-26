/*
 * POSITION HISTORY CONTROLLER — lịch sử chức vụ CRUD.
 * Insert/update có overlap validation (xem service.isOverlapping).
 * Sau mỗi thay đổi → trigger contribution profile recalc (HCBVTQ).
 */

import { Request, Response } from 'express';
import positionHistoryService from '../services/positionHistory.service';
import profileService from '../services/profile.service';
import personnelService from '../services/personnel.service';
import { normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';

interface GetPositionHistoryQuery {
  personnel_id?: string;
  recalculate?: string;
}

interface CreatePositionHistoryParams {
  personnelId?: string;
}

interface CreatePositionHistoryBody {
  personnel_id?: string;
  chuc_vu_id?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string | null;
}

interface IdParams {
  id?: string;
}

interface UpdatePositionHistoryBody {
  chuc_vu_id?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string | null;
}

class PositionHistoryController {
  getPositionHistory = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetPositionHistoryQuery;
    const { personnel_id, recalculate } = query;
    if (!personnel_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin quân nhân');
    }
    await personnelService.assertCanViewPersonnel(
      personnel_id,
      req.user?.role,
      req.user?.quan_nhan_id
    );
    if (recalculate === 'true') {
      try {
        await profileService.recalculateContributionProfile(personnel_id);
      } catch (recalcError) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: RESOURCE_SLUGS.PROFILES,
          description: `Lỗi tính lại hồ sơ khen thưởng cống hiến: ${recalcError}`,
        });
      }
    }
    const result = await positionHistoryService.getPositionHistory(personnel_id);
    return ResponseHelper.success(res, {
      message: 'Lấy lịch sử chức vụ thành công',
      data: result,
    });
  });

  createPositionHistory = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as CreatePositionHistoryParams;
    const body = req.body as CreatePositionHistoryBody;
    const personnel_id = normalizeParam(params.personnelId) || body.personnel_id;
    const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc } = body;
    if (!personnel_id || !chuc_vu_id || !ngay_bat_dau) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ: quân nhân, chức vụ và ngày bắt đầu'
      );
    }
    const result = await positionHistoryService.createPositionHistory(
      {
        personnel_id,
        chuc_vu_id,
        ngay_bat_dau,
        ngay_ket_thuc,
      },
      req.user?.role
    );
    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (recalcError) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.PROFILES,
        description: logMessages.recalcError('thêm', 'chức vụ', recalcError),
      });
    }
    return ResponseHelper.created(res, {
      message: 'Thêm lịch sử chức vụ thành công',
      data: result,
    });
  });

  updatePositionHistory = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const body = req.body as UpdatePositionHistoryBody;
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
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.PROFILES,
        description: logMessages.recalcError('cập nhật', 'chức vụ', recalcError),
      });
    }
    return ResponseHelper.success(res, {
      message: 'Cập nhật lịch sử chức vụ thành công',
      data: result.data || result,
      warning: result.warning,
    });
  });

  deletePositionHistory = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const result = await positionHistoryService.deletePositionHistory(id);
    if (result.quan_nhan_id) {
      try {
        await profileService.recalculateAnnualProfile(result.quan_nhan_id);
      } catch (recalcError) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: RESOURCE_SLUGS.PROFILES,
          description: logMessages.recalcError('xóa', 'chức vụ', recalcError),
        });
      }
    }
    return ResponseHelper.success(res, {
      message: result.message,
      data: { id, QuanNhan: result.QuanNhan, ChucVu: result.ChucVu },
    });
  });
}

export default new PositionHistoryController();
