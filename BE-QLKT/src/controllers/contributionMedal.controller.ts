import { Request, Response } from 'express';
import contributionAwardService from '../services/contributionMedal.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePersonnelIdsFromQuery, getManagerUnitFilter, getAdminUsername } from '../helpers/controllerHelper';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { notifyOnImport } from '../helpers/notification';

interface GetTemplateQuery {
  repeat_map?: string;
  [key: string]: string | string[] | undefined;
}

interface ConfirmImportItem {
  row: number;
  personnel_id: string;
  ho_ten: string | null;
  nam: number;
  thang: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  cap_bac: string | null;
  chuc_vu: string | null;
  ghi_chu: string | null;
  history: Array<{ nam: number; danh_hieu: string; so_quyet_dinh: string | null }>;
}

interface ConfirmImportBody {
  items?: ConfirmImportItem[];
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

interface IdParams {
  id?: string;
}

class ContributionAwardController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const personnelIds = parsePersonnelIdsFromQuery(query);
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) { console.error('Invalid repeat_map JSON:', e); }
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
    const user = req.user!;
    const file = req.file;
    if (!file) return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');

    const result = await contributionAwardService.previewImport(file.buffer);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'contribution-medals',
      description: `Tải lên file "${Buffer.from(file.originalname, 'latin1').toString('utf8')}" để review Huân chương Bảo vệ Tổ quốc: ${result.valid?.length ?? 0} hợp lệ, ${result.errors?.length ?? 0} lỗi`,
      payload: {
        filename: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        total: result.total,
        errors: result.errors?.length ?? 0,
      },
    });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ConfirmImportBody;
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để import');
    }
    const result = await contributionAwardService.confirmImport(items, user.id);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'contribution-medals',
      description: `Nhập dữ liệu Huân chương Bảo vệ Tổ quốc thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    notifyOnImport(user.id, 'contribution-medals', result.imported ?? items.length, personnelIds).catch((e) => { console.error('[contribution-awards] notifyOnImport failed:', e); });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  getAll = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as GetAllQuery;
    const { don_vi_id, nam, danh_hieu, ho_ten } = query;
    const userRole = user.role;
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
    const user = req.user!;
    const query = req.query as ExportToExcelQuery;
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
    const params = req.params as IdParams;
    const { id } = params;
    const adminUsername = getAdminUsername(req);
    const result = await contributionAwardService.deleteAward(String(id), adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });
}

export default new ContributionAwardController();
