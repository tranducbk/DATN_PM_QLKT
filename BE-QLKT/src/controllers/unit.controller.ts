import { Request, Response } from 'express';
import unitService from '../services/unit.service';
import { normalizeParam, parsePagination } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

interface GetAllUnitsQuery {
  hierarchy?: string;
  [key: string]: unknown;
}

interface UnitBody {
  ma_don_vi?: string;
  ten_don_vi?: string;
  co_quan_don_vi_id?: string | null;
}

interface IdParams {
  id?: string;
}

interface GetAllSubUnitsQuery {
  co_quan_don_vi_id?: string;
}

class UnitController {
  getAllUnits = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAllUnitsQuery;
    const { hierarchy } = query;
    const { page, limit } = parsePagination(query);
    const { items, total } = await unitService.getAllUnits({ hierarchy: hierarchy === 'true', page, limit });
    return ResponseHelper.paginated(res, {
      data: items,
      total,
      page,
      limit,
      message: 'Lấy danh sách đơn vị thành công',
    });
  });

  createUnit = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as UnitBody;
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = body;
    if (!ma_don_vi || !ten_don_vi) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin: ma_don_vi, ten_don_vi'
      );
    }
    const result = await unitService.createUnit({ ma_don_vi, ten_don_vi, co_quan_don_vi_id });
    return ResponseHelper.created(res, {
      message: 'Tạo cơ quan đơn vị/đơn vị trực thuộc thành công',
      data: result,
    });
  });

  updateUnit = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const body = req.body as UnitBody;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = body;
    if (!ma_don_vi && !ten_don_vi && co_quan_don_vi_id === undefined) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp thông tin cần cập nhật');
    }
    const result = await unitService.updateUnit(id, { ma_don_vi, ten_don_vi, co_quan_don_vi_id });
    return ResponseHelper.success(res, {
      message: 'Cập nhật cơ quan đơn vị/đơn vị trực thuộc thành công',
      data: result,
    });
  });

  getAllSubUnits = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAllSubUnitsQuery;
    const { co_quan_don_vi_id } = query;
    const result = await unitService.getAllSubUnits(co_quan_don_vi_id);
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách đơn vị trực thuộc thành công',
      data: result,
    });
  });

  getUnitById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const result = await unitService.getUnitById(id);
    return ResponseHelper.success(res, {
      message: 'Lấy thông tin cơ quan đơn vị/đơn vị trực thuộc thành công',
      data: result,
    });
  });

  deleteUnit = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const result = await unitService.deleteUnit(id);
    return ResponseHelper.success(res, { message: result.message });
  });

  getMyUnits = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const userQuanNhanId = user.quan_nhan_id;
    if (!userQuanNhanId) {
      return ResponseHelper.badRequest(res, 'Không tìm thấy thông tin quân nhân của tài khoản');
    }
    const result = await unitService.getManagerUnits(userQuanNhanId);
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách đơn vị thành công',
      data: result,
    });
  });
}

export default new UnitController();
