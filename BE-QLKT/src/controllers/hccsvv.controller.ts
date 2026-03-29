import { Request, Response } from 'express';
import hccsvvService from '../services/hccsvv.service';
import { prisma } from '../models';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { parsePersonnelIdsFromQuery } from '../helpers/controllerHelpers';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

class HCCSVVController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const userRole = req.user?.role ?? ROLES.MANAGER;
    const personnelIds = parsePersonnelIdsFromQuery(req.query);
    const workbook = await hccsvvService.exportTemplate(personnelIds);
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
      userId: req.user?.id,
      userRole: req.user?.role,
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
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để import');
    }
    const result = await hccsvvService.confirmImport(items, req.user!.id);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'hccsvv',
      description: `Nhập dữ liệu huy chương chiến sĩ vẻ vang thành công: ${result.imported || items.length} bản ghi`,
      payload: { imported: result.imported || items.length },
    });
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
    if (userRole === ROLES.MANAGER) {
      const userQuanNhanId = req.user?.quan_nhan_id;
      if (!userQuanNhanId) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin quân nhân');
      }
      const managerPersonnel = await prisma.quanNhan.findUnique({
        where: { id: userQuanNhanId },
        select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
      });
      if (!managerPersonnel) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      if (managerPersonnel.co_quan_don_vi_id) {
        filters.don_vi_id = managerPersonnel.co_quan_don_vi_id;
        filters.include_sub_units = true;
      } else if (managerPersonnel.don_vi_truc_thuoc_id) {
        filters.don_vi_id = managerPersonnel.don_vi_truc_thuoc_id;
      }
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
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { don_vi_id, nam, danh_hieu } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (userRole === ROLES.MANAGER) {
      const user = await hccsvvService.getUserWithUnit(userId);
      if (!user || !user.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = user.QuanNhan.co_quan_don_vi_id ?? user.QuanNhan.don_vi_truc_thuoc_id;
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
    const adminUsername = req.user?.username ?? 'SuperAdmin';
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
    const adminUsername = req.user?.username ?? 'Admin';
    const result = await hccsvvService.deleteAward(String(id), adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new HCCSVVController();
