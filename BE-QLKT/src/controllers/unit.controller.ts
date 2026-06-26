/*
 * CONTROLLER ĐƠN VỊ — CRUD đơn vị 2 cấp.
 * Các method: getAllUnits, getAllSubUnits, getById, create, update, delete.
 * Chế độ cây: ?hierarchy=true → trả về cây CQDV (cha) kèm DVTT (con).
 */

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
  /** Lấy danh sách đơn vị (có phân trang); hierarchy=true trả cây cha-con. */
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

  /** Tạo đơn vị mới; có co_quan_don_vi_id → là DVTT (con), không có → là CQDV (cha). */
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

  /** Cập nhật đơn vị theo id; cho phép sửa một phần thông tin. */
  updateUnit = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const body = req.body as UnitBody;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = body;
    // Phải có ít nhất một trường để cập nhật (co_quan_don_vi_id null vẫn hợp lệ).
    if (!ma_don_vi && !ten_don_vi && co_quan_don_vi_id === undefined) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp thông tin cần cập nhật');
    }
    const result = await unitService.updateUnit(id, { ma_don_vi, ten_don_vi, co_quan_don_vi_id });
    return ResponseHelper.success(res, {
      message: 'Cập nhật cơ quan đơn vị/đơn vị trực thuộc thành công',
      data: result,
    });
  });

  /** Lấy danh sách DVTT (đơn vị con); lọc theo CQDV cha nếu có co_quan_don_vi_id. */
  getAllSubUnits = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAllSubUnitsQuery;
    const { co_quan_don_vi_id } = query;
    const result = await unitService.getAllSubUnits(co_quan_don_vi_id);
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách đơn vị trực thuộc thành công',
      data: result,
    });
  });

  /** Lấy thông tin chi tiết một đơn vị theo id. */
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

  /** Xóa đơn vị theo id; service chặn xóa khi còn quân nhân hoặc DVTT con. */
  deleteUnit = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id đơn vị');
    }
    const result = await unitService.deleteUnit(id);
    return ResponseHelper.success(res, {
      data: {
        ten_don_vi: result.ten_don_vi,
        ma_don_vi: result.ma_don_vi,
        co_quan_don_vi_id: result.co_quan_don_vi_id,
      },
      message: result.message,
    });
  });

  /** Lấy các đơn vị mà Manager đang phụ trách, suy ra từ quân nhân của tài khoản. */
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
