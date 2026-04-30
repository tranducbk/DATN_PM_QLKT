import { Request, Response } from 'express';
import service from '../services/unitAnnualAward.service';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import { notifyOnImport } from '../helpers/notification';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.UNIT_ANNUAL_AWARDS];

interface ListQuery {
  page?: number;
  limit?: number;
  year?: number;
  nam?: number;
  don_vi_id?: string;
  danh_hieu?: string;
}

interface IdParams {
  id?: string;
}

interface ApproveBody {
  so_quyet_dinh?: string;
  file_quyet_dinh?: string;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string;
  file_quyet_dinh_bkbqp?: string;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string;
  file_quyet_dinh_bkttcp?: string;
  nguoi_duyet_id?: string;
}

interface RejectBody {
  ghi_chu?: string;
  nguoi_duyet_id?: string;
}

interface RecalculateBody {
  don_vi_id?: string;
  nam?: number;
}

interface GetUnitAnnualAwardsQuery {
  don_vi_id?: string;
}

interface GetUnitAnnualProfileParams {
  don_vi_id?: string;
}

interface GetUnitAnnualProfileQuery {
  year?: string;
}

interface ConfirmImportItem {
  row: number;
  unit_id: string;
  ma_don_vi: string;
  ten_don_vi: string;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh: string;
  ghi_chu: string | null;
  is_co_quan_don_vi: boolean;
  history: Array<{
    nam: number;
    danh_hieu: string;
    nhan_bkbqp: boolean;
    nhan_bkttcp: boolean;
    so_quyet_dinh: string | null;
  }>;
}

interface ConfirmImportBody {
  items?: ConfirmImportItem[];
}

interface GetTemplateQuery {
  unit_ids?: string;
  personnel_ids?: string;
  repeat_map?: string;
}

interface ExportToExcelQuery {
  nam?: number;
  danh_hieu?: string;
}

interface GetStatisticsQuery {
  nam?: number;
}

class UnitAnnualAwardController {
  list = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ListQuery;
    const user = req.user;
    const { page, limit, year, nam, don_vi_id, danh_hieu } = query;
    const result = await service.list({
      page: page ?? 1,
      limit: limit ?? 10,
      year: year !== undefined ? String(year) : nam !== undefined ? String(nam) : undefined,
      donViId: don_vi_id,
      danhHieu: danh_hieu,
      userRole: user?.role,
      userQuanNhanId: user?.quan_nhan_id,
    });
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
    });
  });

  getById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user;
    const data = await service.getById(String(params.id), user?.role, user?.quan_nhan_id);
    if (!data) {
      return ResponseHelper.notFound(res, 'Không tìm thấy bản ghi hoặc không có quyền xem');
    }
    return ResponseHelper.success(res, { data });
  });

  upsert = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const body = req.body || {};
    const data = await service.upsert({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      so_quyet_dinh: body.so_quyet_dinh,
      ghi_chu: body.ghi_chu,
      nguoi_tao_id: user?.id || body.nguoi_tao_id,
    });
    return ResponseHelper.created(res, {
      data,
      message: 'Lưu khen thưởng đơn vị hằng năm thành công',
    });
  });

  propose = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const body = req.body || {};
    const data = await service.propose({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      ghi_chu: body.ghi_chu,
      nguoi_tao_id: user?.id || body.nguoi_tao_id,
    });
    return ResponseHelper.created(res, {
      data,
      message: 'Đã gửi đề xuất khen thưởng đơn vị. Hãy chờ admin duyệt',
    });
  });

  approve = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user;
    const body = req.body as ApproveBody;
    const data = await service.approve(params.id, {
      so_quyet_dinh: body.so_quyet_dinh,
      nhan_bkbqp: body.nhan_bkbqp,
      so_quyet_dinh_bkbqp: body.so_quyet_dinh_bkbqp,
      file_quyet_dinh_bkbqp: body.file_quyet_dinh_bkbqp,
      nhan_bkttcp: body.nhan_bkttcp,
      so_quyet_dinh_bkttcp: body.so_quyet_dinh_bkttcp,
      file_quyet_dinh_bkttcp: body.file_quyet_dinh_bkttcp,
      nguoi_duyet_id: user?.id || (body.nguoi_duyet_id as string | undefined),
    });
    return ResponseHelper.success(res, { data, message: 'Đã phê duyệt đề xuất' });
  });

  reject = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user;
    const body = req.body as RejectBody;
    const data = await service.reject(String(params.id), {
      ghi_chu: body.ghi_chu as string | undefined,
      nguoi_duyet_id: user?.id || (body.nguoi_duyet_id as string | undefined),
    });
    return ResponseHelper.success(res, { data, message: 'Đã từ chối đề xuất' });
  });

  recalculate = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as RecalculateBody;
    const count = await service.recalculate({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
    });
    return ResponseHelper.success(res, { data: { updated: count } });
  });

  remove = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const query = req.query as { awardType?: string };
    const awardType = typeof query.awardType === 'string' ? query.awardType.trim() || null : null;
    await service.remove(String(params.id), awardType);
    return ResponseHelper.success(res, { data: true, message: 'Đã xóa bản ghi' });
  });

  getUnitAnnualAwards = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetUnitAnnualAwardsQuery;
    const user = req.user;
    const { don_vi_id } = query;
    if (!don_vi_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị');
    }
    const result = await service.getUnitAnnualAwards(
      don_vi_id,
      user?.role,
      user?.quan_nhan_id
    );
    return ResponseHelper.success(res, {
      message: 'Lấy lịch sử khen thưởng đơn vị thành công',
      data: result,
    });
  });

  getUnitAnnualProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as GetUnitAnnualProfileParams;
    const query = req.query as GetUnitAnnualProfileQuery;
    const { don_vi_id } = params;
    const { year } = query;
    const yearNumber = year != null && year !== '' ? Number(year) : null;
    if (!don_vi_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị');
    }
    if (yearNumber && !Number.isNaN(yearNumber)) {
      await service.recalculateAnnualUnit(don_vi_id, yearNumber);
    }
    const result = await service.getAnnualUnit(don_vi_id, yearNumber && !Number.isNaN(yearNumber) ? yearNumber : new Date().getFullYear());
    return ResponseHelper.success(res, {
      message: 'Lấy hồ sơ hằng năm đơn vị thành công',
      data: result,
    });
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await service.previewImport(file.buffer);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
      description: `Tải lên file "${file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : 'Excel'}" để review ${AWARD_LABEL}: ${result.valid?.length || 0} hợp lệ, ${result.errors?.length || 0} lỗi`,
      payload: {
        filename: file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : undefined,
        total: result.total,
        errors: result.errors?.length || 0,
      },
    });
    return ResponseHelper.success(res, { data: result });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ConfirmImportBody;
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để nhập');
    }
    const result = await service.confirmImport(items, user.id);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
      description: `Nhập dữ liệu ${AWARD_LABEL} thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    const unitIds = items.map((i: { unit_id: string }) => i.unit_id);
    notifyOnImport(user.id, AWARD_SLUGS.UNIT_ANNUAL_AWARDS, result.imported ?? items.length, [], unitIds).catch((e) => { console.error('[unit-annual-awards] notifyOnImport failed:', e); });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const rawIds = query.unit_ids ?? query.personnel_ids ?? '';
    let unitIds: string[] = [];
    if (rawIds) {
      unitIds = rawIds
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => id.length > 0);
    }
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) { console.error('Invalid repeat_map JSON:', e); }
    }
    const workbook = await service.exportTemplate(unitIds, repeatMap);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_nhap_don_vi_hang_nam_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  });

  importFromExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await service.importFromExcel(file.buffer, user.id);
    return ResponseHelper.success(res, {
      message: `Đã thêm thành công ${result.imported}/${result.total} bản ghi`,
      data: result,
    });
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ExportToExcelQuery;
    const user = req.user;
    const { nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {
      nam,
      danh_hieu,
    };
    const workbook = await service.exportToExcel(filters, user?.role, user?.quan_nhan_id);
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
    const query = req.query as GetStatisticsQuery;
    const user = req.user;
    const { nam } = query;
    const filters: Record<string, unknown> = { nam };
    const statistics = await service.getStatistics(filters, user?.role, user?.quan_nhan_id);
    return ResponseHelper.success(res, { data: statistics });
  });
}

export default new UnitAnnualAwardController();
