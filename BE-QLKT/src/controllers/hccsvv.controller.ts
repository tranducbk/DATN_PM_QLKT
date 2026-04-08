import { Request, Response } from 'express';
import hccsvvService from '../services/hccsvv.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { parsePersonnelIdsFromQuery, getManagerUnitFilter, getAdminUsername } from '../helpers/controllerHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { notifyOnImport } from '../helpers/notification';

class HCCSVVController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const personnelIds = parsePersonnelIdsFromQuery(req.query);
    const repeatMap: Record<string, number> = {};
    if (req.query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(req.query.repeat_map as string));
      } catch { /* ignore */ }
    }
    const workbook = await hccsvvService.exportTemplate(personnelIds, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `mau_import_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await hccsvvService.previewImport(req.file.buffer);
    await writeSystemLog({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'hccsvv',
      description: `Tải lên file "${req.file?.originalname ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : 'Excel'}" để review huy chương chiến sĩ vẻ vang: ${result.valid?.length || 0} hợp lệ, ${result.errors?.length || 0} lỗi`,
      payload: {
        filename: req.file?.originalname ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : undefined,
        total: result.total,
        errors: result.errors?.length || 0,
      },
    });
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const { items } = req.body;
    const result = await hccsvvService.confirmImport(items, req.user!.id);
    await writeSystemLog({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'hccsvv',
      description: `Nhập dữ liệu huy chương chiến sĩ vẻ vang thành công: ${result.imported || items.length} bản ghi`,
      payload: { imported: result.imported || items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    notifyOnImport(req.user!.id, 'hccsvv', result.imported || items.length, personnelIds).catch(() => {});
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });

  importFromExcel = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    const result = await hccsvvService.importFromExcel(req.file.buffer, req.user!.id);
    return ResponseHelper.success(res, {
      message: 'Import Huy chương Chiến sĩ Vẻ vang thành công',
      data: result,
    });
  });

  getAll = catchAsync(async (req: Request, res: Response) => {
    const userRole = req.user!.role;
    const { don_vi_id, nam, danh_hieu, ho_ten } = req.query;
    const { page, limit } = parsePagination(req.query);
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (ho_ten) filters.ho_ten = ho_ten;

    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && userRole === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      if (managerUnit.isCoQuanDonVi) filters.include_sub_units = true;
    }
    const result = await hccsvvService.getAll(filters, page, limit);
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: 'Lấy danh sách HCCSVV thành công',
    });
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;

    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && req.user!.role === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      if (managerUnit.isCoQuanDonVi) filters.include_sub_units = true;
    }
    const buffer = await hccsvvService.exportToExcel(filters);
    const fileName = `danh_sach_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const statistics = await hccsvvService.getStatistics();
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê HCCSVV thành công',
      data: statistics,
    });
  });

  createDirect = catchAsync(async (req: Request, res: Response) => {
    const { quan_nhan_id, danh_hieu, nam, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = req.body;
    const adminUsername = getAdminUsername(req);
    if (!quan_nhan_id || !danh_hieu || !nam) {
      return ResponseHelper.badRequest(
        res,
        'Thiếu thông tin bắt buộc: quân nhân, danh hiệu và năm'
      );
    }
    const result = await hccsvvService.createDirect(
      { quan_nhan_id, danh_hieu, nam: parseInt(nam), cap_bac, chuc_vu, so_quyet_dinh, ghi_chu },
      adminUsername
    );
    res.locals.createdId = result.id;
    return ResponseHelper.created(res, {
      message: 'Thêm khen thưởng HCCSVV thành công',
      data: result,
    });
  });

  deleteAward = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminUsername = getAdminUsername(req);
    const result = await hccsvvService.deleteAward(String(id), adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new HCCSVVController();
