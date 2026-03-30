import { Request, Response } from 'express';
import militaryFlagService from '../services/militaryFlag.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePersonnelIdsFromQuery, getManagerUnitFilter } from '../helpers/controllerHelpers';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { notifyOnImport } from '../helpers/notification';

class MilitaryFlagController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const personnelIds = parsePersonnelIdsFromQuery(req.query);
    const repeatMap: Record<string, number> = {};
    if (req.query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(req.query.repeat_map as string));
      } catch { /* ignore */ }
    }

    const workbook = await militaryFlagService.exportTemplate(personnelIds, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `mau_import_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');

    const result = await militaryFlagService.previewImport(req.file.buffer);
    await writeSystemLog({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'military-flag',
      description: `Tải lên file "${Buffer.from(req.file.originalname, 'latin1').toString('utf8')}" để review Huy chương Quân kỳ Quyết thắng: ${result.valid?.length ?? 0} hợp lệ, ${result.errors?.length ?? 0} lỗi`,
      payload: {
        filename: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        total: result.total,
        errors: result.errors?.length ?? 0,
      },
    });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const { items } = req.body;
    const result = await militaryFlagService.confirmImport(items, req.user!.id);
    await writeSystemLog({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'military-flag',
      description: `Nhập dữ liệu huân chương quân kỳ quyết thắng thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    notifyOnImport(req.user!.id, 'military-flag', result.imported ?? items.length, personnelIds).catch(() => {});
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  importFromExcel = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');

    const result = await militaryFlagService.importFromExcel(req.file.buffer, req.user!.id);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Import Huy chương Quân kỳ Quyết thắng thành công',
    });
  });

  getAll = catchAsync(async (req: Request, res: Response) => {
    const userRole = req.user!.role;
    const { don_vi_id, nam, ho_ten } = req.query;
    const { page, limit } = parsePagination(req.query);

    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (ho_ten) filters.ho_ten = ho_ten;

    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && userRole === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      if (managerUnit.isCoQuanDonVi) filters.include_sub_units = true;
    }

    const result = await militaryFlagService.getAll(filters, page, limit);
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: 'Lấy danh sách HCQKQT thành công',
    });
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam } = req.query;

    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;

    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && req.user!.role === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      if (managerUnit.isCoQuanDonVi) filters.include_sub_units = true;
    }

    const buffer = await militaryFlagService.exportToExcel(filters);
    const fileName = `danh_sach_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const statistics = await militaryFlagService.getStatistics();
    return ResponseHelper.success(res, {
      data: statistics,
      message: 'Lấy thống kê HCQKQT thành công',
    });
  });

  getByPersonnelId = catchAsync(async (req: Request, res: Response) => {
    const personnel_id = req.params.personnel_id as string;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const userPersonnelId = req.user!.quan_nhan_id;

    if (userRole === ROLES.USER && userPersonnelId !== personnel_id) {
      return ResponseHelper.forbidden(res, 'Bạn chỉ có thể xem thông tin của mình');
    }

    if (userRole === ROLES.MANAGER) {
      const user = await militaryFlagService.getUserWithUnit(userId);
      if (!user?.QuanNhan) return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');

      const managerUnitId = user.QuanNhan.co_quan_don_vi_id ?? user.QuanNhan.don_vi_truc_thuoc_id;
      const personnel = await militaryFlagService.getPersonnelById(personnel_id);
      if (!personnel) return ResponseHelper.notFound(res, 'Không tìm thấy thông tin quân nhân');

      const personnelUnitId = personnel.co_quan_don_vi_id ?? personnel.don_vi_truc_thuoc_id;
      if (personnelUnitId !== managerUnitId) {
        return ResponseHelper.forbidden(res, 'Bạn chỉ có thể xem thông tin của đơn vị mình');
      }
    }

    const result = await militaryFlagService.getByPersonnelId(personnel_id);
    return ResponseHelper.success(res, {
      data: { hasReceived: result.length > 0, items: result },
      message: 'Lấy Huân chương Quân kỳ Quyết thắng theo quân nhân thành công',
    });
  });

  deleteAward = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const adminUsername = req.user!.username ?? 'Admin';
    const result = await militaryFlagService.deleteAward(id, adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new MilitaryFlagController();
