import { Request, Response } from 'express';
import positionService from '../services/position.service';
import { normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

class PositionController {
  getPositions = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as { unit_id?: string; include_children?: string };
    const { unit_id, include_children } = query;
    const includeChildren = include_children === 'true';
    const result = await positionService.getPositions(
      unit_id,
      includeChildren
    );
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách chức vụ thành công',
      data: result,
    });
  });

  createPosition = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as {
      unit_id?: string;
      ten_chuc_vu?: string;
      is_manager?: boolean;
      he_so_chuc_vu?: number;
    };
    const { unit_id, ten_chuc_vu, is_manager, he_so_chuc_vu } = body;
    if (!unit_id || !ten_chuc_vu) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ thông tin: đơn vị và tên chức vụ');
    }
    const result = await positionService.createPosition({
      unit_id,
      ten_chuc_vu,
      is_manager,
      he_so_chuc_vu,
    });
    return ResponseHelper.created(res, { message: 'Tạo chức vụ thành công', data: result });
  });

  updatePosition = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as { id?: string };
    const body = req.body as { ten_chuc_vu?: string; is_manager?: boolean; he_so_chuc_vu?: number };
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id chức vụ');
    }
    const { ten_chuc_vu, is_manager, he_so_chuc_vu } = body;
    const result = await positionService.updatePosition(id, {
      ten_chuc_vu,
      is_manager,
      he_so_chuc_vu,
    });
    return ResponseHelper.success(res, {
      message: 'Cập nhật chức vụ thành công',
      data: result,
    });
  });

  deletePosition = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as { id?: string };
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id chức vụ');
    }
    const result = await positionService.deletePosition(id);
    return ResponseHelper.success(res, {
      message: result.message,
      data: {
        id,
        ten_chuc_vu: result.ten_chuc_vu,
        CoQuanDonVi: result.CoQuanDonVi,
        DonViTrucThuoc: result.DonViTrucThuoc,
      },
    });
  });
}

export default new PositionController();
