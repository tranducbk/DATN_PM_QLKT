import { Request, Response } from 'express';
import unitService from '../services/unit.service';
import { normalizeParam, parsePagination } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class UnitController {
  getAllUnits = catchAsync(async (req: Request, res: Response) => {
    const hierarchy = req.query.hierarchy === 'true';
    const { page, limit } = parsePagination(req.query);
    const result = await unitService.getAllUnits({ hierarchy, page, limit });
    const { items, total } = result as { items: unknown[]; total: number };
    return ResponseHelper.paginated(res, {
      data: items,
      total,
      page,
      limit,
      message: 'Lấy danh sách đơn vị thành công',
    });
  });

  createUnit = catchAsync(async (req: Request, res: Response) => {
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = req.body;
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
    const id = normalizeParam(req.params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = req.body;
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
    const { co_quan_don_vi_id } = req.query;
    const result = await unitService.getAllSubUnits(co_quan_don_vi_id as string | undefined);
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách đơn vị trực thuộc thành công',
      data: result,
    });
  });

  getUnitById = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
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
    const id = normalizeParam(req.params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const result = await unitService.deleteUnit(id);
    return ResponseHelper.success(res, { message: result.message });
  });

  getMyUnits = catchAsync(async (req: Request, res: Response) => {
    const userQuanNhanId = req.user!.quan_nhan_id;
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
