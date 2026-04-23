import { Request, Response } from 'express';
import hccsvvService, { HccsvvValidItem } from '../services/tenureMedal.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { parsePersonnelIdsFromQuery, getManagerUnitFilter, getAdminUsername } from '../helpers/controllerHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { notifyOnImport } from '../helpers/notification';

interface GetTemplateQuery {
  repeat_map?: string;
  [key: string]: string | string[] | undefined;
}

interface ConfirmImportBody {
  items?: HccsvvValidItem[];
}

interface GetAllQuery {
  don_vi_id?: string;
  nam?: number;
  danh_hieu?: string;
  ho_ten?: string;
  [key: string]: unknown;
}

interface ExportToExcelQuery {
  don_vi_id?: string;
  nam?: number;
  danh_hieu?: string;
  [key: string]: unknown;
}

interface CreateDirectBody {
  quan_nhan_id?: string;
  danh_hieu?: string;
  nam?: number | string;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
}

interface IdParams {
  id?: string;
}

class HCCSVVController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const personnelIds = parsePersonnelIdsFromQuery(query);
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) { console.error('Invalid repeat_map JSON:', e); }
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
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await hccsvvService.previewImport(file.buffer);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'tenure-medals',
      description: `Tải lên file "${file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : 'Excel'}" để review huy chương chiến sĩ vẻ vang: ${result.valid?.length || 0} hợp lệ, ${result.errors?.length || 0} lỗi`,
      payload: {
        filename: file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : undefined,
        total: result.total,
        errors: result.errors?.length || 0,
      },
    });
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ConfirmImportBody;
    const { items } = body;
    const result = await hccsvvService.confirmImport(items, user.id);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'tenure-medals',
      description: `Nhập dữ liệu huy chương chiến sĩ vẻ vang thành công: ${result.imported || items.length} bản ghi`,
      payload: { imported: result.imported || items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    notifyOnImport(user.id, 'tenure-medals', result.imported || items.length, personnelIds).catch((e) => { console.error('[hccsvv] notifyOnImport failed:', e); });
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });

  importFromExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    const result = await hccsvvService.importFromExcel(file.buffer, user.id);
    return ResponseHelper.success(res, {
      message: 'Import Huy chương Chiến sĩ vẻ vang thành công',
      data: result,
    });
  });

  getAll = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAllQuery;
    const user = req.user!;
    const userRole = user.role;
    const { don_vi_id, nam, danh_hieu, ho_ten } = query;
    const { page, limit } = parsePagination(query);
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
    const query = req.query as ExportToExcelQuery;
    const user = req.user!;
    const { don_vi_id, nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;

    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && user.role === ROLES.MANAGER) {
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
    const body = req.body as CreateDirectBody;
    const { quan_nhan_id, danh_hieu, nam, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = body;
    const adminUsername = getAdminUsername(req);
    if (!quan_nhan_id || !danh_hieu || !nam) {
      return ResponseHelper.badRequest(
        res,
        'Thiếu thông tin bắt buộc: quân nhân, danh hiệu và năm'
      );
    }
    const yearNumber = typeof nam === 'number' ? nam : Number(nam);
    if (!Number.isInteger(yearNumber) || yearNumber <= 0) {
      return ResponseHelper.badRequest(res, 'Năm không hợp lệ');
    }
    const result = await hccsvvService.createDirect(
      { quan_nhan_id, danh_hieu, nam: yearNumber, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu },
      adminUsername
    );
    res.locals.createdId = result.id;
    return ResponseHelper.created(res, {
      message: 'Thêm khen thưởng HCCSVV thành công',
      data: result,
    });
  });

  deleteAward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const { id } = params;
    const adminUsername = getAdminUsername(req);
    const result = await hccsvvService.deleteAward(String(id), adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new HCCSVVController();
