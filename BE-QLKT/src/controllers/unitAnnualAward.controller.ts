import { Request, Response } from 'express';
import service from '../services/unitAnnualAward.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

class UnitAnnualAwardController {
  list = catchAsync(async (req: Request, res: Response) => {
    const { page, limit, year, nam, don_vi_id, danh_hieu } = req.query;
    const result = await service.list({
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      year: (year || nam) as string | undefined,
      donViId: don_vi_id as string | undefined,
      danhHieu: danh_hieu as string | undefined,
      userRole: req.user?.role,
      userQuanNhanId: req.user?.quan_nhan_id,
    });
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
    });
  });

  getById = catchAsync(async (req: Request, res: Response) => {
    const data = await service.getById(String(req.params.id), req.user?.role, req.user?.quan_nhan_id);
    if (!data) {
      return ResponseHelper.notFound(res, 'Không tìm thấy bản ghi hoặc không có quyền xem');
    }
    return ResponseHelper.success(res, { data });
  });

  upsert = catchAsync(async (req: Request, res: Response) => {
    const body = req.body || {};
    const data = await service.upsert({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      so_quyet_dinh: body.so_quyet_dinh,
      file_quyet_dinh: body.file_quyet_dinh,
      ghi_chu: body.ghi_chu,
      nguoi_tao_id: req.user?.id || body.nguoi_tao_id,
    });
    return ResponseHelper.created(res, {
      data,
      message: 'Lưu khen thưởng đơn vị hằng năm thành công',
    });
  });

  propose = catchAsync(async (req: Request, res: Response) => {
    const body = req.body || {};
    const data = await service.propose({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      ghi_chu: body.ghi_chu,
      nguoi_tao_id: req.user?.id || body.nguoi_tao_id,
    });
    return ResponseHelper.created(res, {
      data,
      message: 'Đã gửi đề xuất khen thưởng đơn vị. Hãy chờ admin duyệt',
    });
  });

  approve = catchAsync(async (req: Request, res: Response) => {
    const data = await service.approve(req.params.id, {
      so_quyet_dinh: req.body?.so_quyet_dinh,
      file_quyet_dinh: req.body?.file_quyet_dinh,
      nhan_bkbqp: req.body?.nhan_bkbqp,
      so_quyet_dinh_bkbqp: req.body?.so_quyet_dinh_bkbqp,
      file_quyet_dinh_bkbqp: req.body?.file_quyet_dinh_bkbqp,
      nhan_bkttcp: req.body?.nhan_bkttcp,
      so_quyet_dinh_bkttcp: req.body?.so_quyet_dinh_bkttcp,
      file_quyet_dinh_bkttcp: req.body?.file_quyet_dinh_bkttcp,
      nguoi_duyet_id: req.user?.id || req.body?.nguoi_duyet_id,
    });
    return ResponseHelper.success(res, { data, message: 'Đã phê duyệt đề xuất' });
  });

  reject = catchAsync(async (req: Request, res: Response) => {
    const data = await service.reject(String(req.params.id), {
      ghi_chu: req.body?.ghi_chu,
      nguoi_duyet_id: req.user?.id || req.body?.nguoi_duyet_id,
    });
    return ResponseHelper.success(res, { data, message: 'Đã từ chối đề xuất' });
  });

  recalculate = catchAsync(async (req: Request, res: Response) => {
    const count = await service.recalculate({
      don_vi_id: req.body?.don_vi_id,
      nam: req.body?.nam,
    });
    return ResponseHelper.success(res, { data: { updated: count } });
  });

  remove = catchAsync(async (req: Request, res: Response) => {
    await service.remove(String(req.params.id));
    return ResponseHelper.success(res, { data: true, message: 'Đã xóa bản ghi' });
  });

  getUnitAnnualAwards = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id } = req.query;
    if (!don_vi_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị');
    }
    const result = await service.getUnitAnnualAwards(
      don_vi_id as string,
      req.user?.role,
      req.user?.quan_nhan_id
    );
    return ResponseHelper.success(res, {
      message: 'Lấy lịch sử khen thưởng đơn vị thành công',
      data: result,
    });
  });

  getUnitAnnualProfile = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id } = req.params;
    const { year } = req.query;
    const yearNumber = year ? parseInt(year as string, 10) : null;
    if (!don_vi_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị');
    }
    if (yearNumber) await service.recalculateAnnualUnit(don_vi_id, yearNumber);
    const result = await service.getAnnualUnit(don_vi_id, yearNumber || new Date().getFullYear());
    return ResponseHelper.success(res, {
      message: 'Lấy hồ sơ hằng năm đơn vị thành công',
      data: result,
    });
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await service.previewImport(req.file.buffer);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'unit-annual-awards',
      description: `Tải lên file "${req.file?.originalname ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : 'Excel'}" để review khen thưởng đơn vị hằng năm: ${result.valid?.length || 0} hợp lệ, ${result.errors?.length || 0} lỗi`,
      payload: {
        filename: req.file?.originalname ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : undefined,
        total: result.total,
        errors: result.errors?.length || 0,
      },
    });
    return ResponseHelper.success(res, { data: result });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để import');
    }
    const result = await service.confirmImport(items, req.user!.id);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'unit-annual-awards',
      description: `Nhập dữ liệu khen thưởng đơn vị hằng năm thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const userRole = req.user?.role || ROLES.MANAGER;
    const rawIds = (req.query.unit_ids ?? req.query.personnel_ids ?? '') as string;
    let unitIds: string[] = [];
    if (rawIds) {
      unitIds = rawIds
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => id.length > 0);
    }
    const workbook = await service.exportTemplate(unitIds, userRole);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_don_vi_hang_nam_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  });

  importFromExcel = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await service.importFromExcel(req.file.buffer, req.user!.id);
    return ResponseHelper.success(res, {
      message: `Đã thêm thành công ${result.imported}/${result.total} bản ghi`,
      data: result,
    });
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const { nam, danh_hieu } = req.query;
    const filters: Record<string, unknown> = {
      nam: nam ? parseInt(nam as string) : undefined,
      danh_hieu: danh_hieu || undefined,
    };
    const workbook = await service.exportToExcel(filters, req.user?.role, req.user?.quan_nhan_id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_don_vi_hang_nam_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const { nam } = req.query;
    const filters: Record<string, unknown> = { nam: nam ? parseInt(nam as string) : undefined };
    const statistics = await service.getStatistics(filters, req.user?.role, req.user?.quan_nhan_id);
    return ResponseHelper.success(res, { data: statistics });
  });
}

export default new UnitAnnualAwardController();
