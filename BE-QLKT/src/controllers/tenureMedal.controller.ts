import { Request, Response } from 'express';
import tenureMedalService, { HccsvvValidItem } from '../services/tenureMedal.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import {
  parsePersonnelIdsFromQuery,
  getManagerUnitFilter,
  getAdminUsername,
  logImportPreview,
} from '../helpers/controllerHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import { safeNotifyImport } from '../helpers/notification';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.TENURE_MEDALS];

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
  nam?: number;
  tu_nam?: number;
  den_nam?: number;
  danh_hieu?: string;
  don_vi_id?: string;
  personnel_ids?: string;
}

interface IdParams {
  id?: string;
}

class TenureMedalController {
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const personnelIds = parsePersonnelIdsFromQuery(query);
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: AWARD_SLUGS.TENURE_MEDALS,
          description: logMessages.invalidRepeatMap(AWARD_LABEL, e),
        });
      }
    }
    const workbook = await tenureMedalService.exportTemplate(personnelIds, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `mau_nhap_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await tenureMedalService.previewImport(file.buffer);
    await logImportPreview(req, AWARD_SLUGS.TENURE_MEDALS, AWARD_LABEL, file.originalname, result);
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ConfirmImportBody;
    const { items } = body;
    const result = await tenureMedalService.confirmImport(items);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: AWARD_SLUGS.TENURE_MEDALS,
      description: logMessages.importSuccess(AWARD_LABEL, result.imported || items.length),
      payload: { imported: result.imported || items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    safeNotifyImport(user.id, AWARD_SLUGS.TENURE_MEDALS, result.imported || items.length, personnelIds);
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
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
    const result = await tenureMedalService.getAll(filters, page, limit);
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: `Lấy danh sách ${AWARD_LABEL} thành công`,
    });
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const rawQuery = req.query;
    const query = rawQuery as ExportToExcelQuery;
    const user = req.user!;
    const { don_vi_id, nam, tu_nam, den_nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (tu_nam) filters.tu_nam = tu_nam;
    if (den_nam) filters.den_nam = den_nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    const parsedPersonnelIds = parsePersonnelIdsFromQuery(rawQuery);
    if (parsedPersonnelIds.length > 0) {
      filters.personnel_ids = parsedPersonnelIds;
    }

    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && user.role === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      if (managerUnit.isCoQuanDonVi) filters.include_sub_units = true;
    }
    const buffer = await tenureMedalService.exportToExcel(filters);
    const fileName = `danh_sach_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const statistics = await tenureMedalService.getStatistics();
    return ResponseHelper.success(res, {
      message: `Lấy thống kê ${AWARD_LABEL} thành công`,
      data: statistics,
    });
  });

  deleteAward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const { id } = params;
    const adminUsername = getAdminUsername(req);
    const result = await tenureMedalService.deleteAward(String(id), adminUsername);
    return ResponseHelper.success(res, { message: result.message, data: result.award });
  });
}

export default new TenureMedalController();
