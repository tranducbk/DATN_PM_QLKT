import { Request, Response } from 'express';
import contributionAwardService from '../services/contributionAward.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePersonnelIdsFromQuery, getManagerUnitFilter } from '../helpers/controllerHelpers';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

class ContributionAwardController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const personnelIds = parsePersonnelIdsFromQuery(req.query);
    const repeatMap: Record<string, number> = {};
    if (req.query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(req.query.repeat_map as string));
      } catch { /* ignore */ }
    }

    const workbook = await contributionAwardService.exportTemplate(personnelIds, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `mau_import_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');

    const result = await contributionAwardService.previewImport(req.file.buffer);
    await writeSystemLog({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'contribution-awards',
      description: `Tải lên file "${Buffer.from(req.file.originalname, 'latin1').toString('utf8')}" để review Huân chương Bảo vệ Tổ quốc: ${result.valid?.length ?? 0} hợp lệ, ${result.errors?.length ?? 0} lỗi`,
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
    const result = await contributionAwardService.confirmImport(items, req.user!.id);
    await writeSystemLog({
      userId: req.user!.id,
      userRole: req.user!.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'contribution-awards',
      description: `Nhập dữ liệu huân chương bảo vệ tổ quốc thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
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

    const result = await contributionAwardService.getAll(filters, page, limit);
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: 'Lấy danh sách HCBVTQ thành công',
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

    const buffer = await contributionAwardService.exportToExcel(filters);
    const fileName = `danh_sach_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const statistics = await contributionAwardService.getStatistics();
    return ResponseHelper.success(res, {
      data: statistics,
      message: 'Lấy thống kê HCBVTQ thành công',
    });
  });

  deleteAward = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminUsername = req.user!.username ?? 'Admin';
    const result = await contributionAwardService.deleteAward(String(id), adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new ContributionAwardController();
