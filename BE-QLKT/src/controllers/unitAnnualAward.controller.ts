import { Request, Response } from 'express';
import service from '../services/unitAnnualAward.service';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import { safeNotifyImport, notifyOnUnitAwardDeleted } from '../helpers/notification';
import { logImportPreview, getAdminUsername } from '../helpers/controllerHelper';

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

interface AwardTypeQuery {
  awardType?: string;
}

interface RecalculateBody {
  don_vi_id?: string;
  nam?: number;
}

interface UpsertBody {
  don_vi_id?: string;
  nam?: number;
  danh_hieu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
  nguoi_tao_id?: string;
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
  /**
   * Lấy danh sách khen thưởng đơn vị hằng năm (có phân trang, lọc theo năm/đơn vị/danh hiệu).
   * @returns Danh sách kèm thông tin phân trang
   */
  list = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ListQuery;
    const user = req.user;
    const { page, limit, year, nam, don_vi_id, danh_hieu } = query;
    const result = await service.list({
      page: page ?? 1,
      limit: limit ?? 10,
      // Chấp nhận cả query `year` lẫn alias `nam`; ưu tiên `year` trước
      year: year !== undefined ? String(year) : nam !== undefined ? String(nam) : undefined,
      donViId: don_vi_id,
      danhHieu: danh_hieu,
      // Truyền role + quân nhân để service giới hạn dữ liệu theo CQDV của MANAGER
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

  /**
   * Lấy chi tiết một bản ghi khen thưởng đơn vị theo id.
   * @returns Bản ghi, hoặc 404 nếu không tồn tại / ngoài phạm vi đơn vị của user
   */
  getById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user;
    // Service tự kiểm tra quyền theo CQDV của MANAGER, trả null nếu ngoài phạm vi
    const data = await service.getById(String(params.id), user?.role, user?.quan_nhan_id);
    if (!data) {
      return ResponseHelper.notFound(res, 'Không tìm thấy bản ghi hoặc không có quyền xem');
    }
    return ResponseHelper.success(res, { data });
  });

  /**
   * Tạo mới hoặc cập nhật bản ghi khen thưởng đơn vị hằng năm.
   * @returns Bản ghi vừa lưu
   */
  upsert = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const body = req.body as UpsertBody;
    const data = await service.upsert({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
      so_quyet_dinh: body.so_quyet_dinh,
      ghi_chu: body.ghi_chu,
      // Ưu tiên user đăng nhập làm người tạo; chỉ dùng body khi không có user
      nguoi_tao_id: user?.id || body.nguoi_tao_id,
    });
    return ResponseHelper.created(res, {
      data,
      message: 'Lưu khen thưởng đơn vị hằng năm thành công',
    });
  });

  /**
   * Tính lại điều kiện đạt danh hiệu cho đơn vị (theo đơn vị/năm tùy chọn).
   * @returns Số bản ghi đã cập nhật
   */
  recalculate = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as RecalculateBody;
    const count = await service.recalculate({
      don_vi_id: body.don_vi_id,
      nam: body.nam,
    });
    return ResponseHelper.success(res, { data: { updated: count } });
  });

  /**
   * Xóa một bản ghi khen thưởng đơn vị và gửi thông báo cho đơn vị liên quan.
   * @returns Bản ghi vừa xóa
   */
  remove = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const query = req.query as AwardTypeQuery;
    // Chuẩn hóa awardType từ query: trim, rỗng coi như null (xóa toàn bộ bản ghi)
    const awardType = typeof query.awardType === 'string' ? query.awardType.trim() || null : null;
    const record = await service.remove(String(params.id), awardType);
    // Fire-and-forget: thông báo không được chặn response xóa
    void notifyOnUnitAwardDeleted(record, awardType, getAdminUsername(req));
    return ResponseHelper.success(res, { data: record, message: 'Đã xóa bản ghi' });
  });

  /**
   * Lấy lịch sử khen thưởng hằng năm của một đơn vị.
   * @returns Danh sách lịch sử khen thưởng, hoặc 400 nếu thiếu đơn vị
   */
  getUnitAnnualAwards = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetUnitAnnualAwardsQuery;
    const user = req.user;
    const { don_vi_id } = query;
    if (!don_vi_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị');
    }
    // Service áp ràng buộc phạm vi đơn vị theo role (MANAGER giới hạn theo CQDV)
    const result = await service.getUnitAnnualAwards(don_vi_id, user?.role, user?.quan_nhan_id);
    return ResponseHelper.success(res, {
      message: 'Lấy lịch sử khen thưởng đơn vị thành công',
      data: result,
    });
  });

  /**
   * Lấy hồ sơ khen thưởng hằng năm của đơn vị theo năm; tính lại điều kiện trước khi trả về.
   * @returns Hồ sơ đơn vị theo năm, hoặc 400 nếu thiếu đơn vị
   */
  getUnitAnnualProfile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as GetUnitAnnualProfileParams;
    const query = req.query as GetUnitAnnualProfileQuery;
    const user = req.user;
    const { don_vi_id } = params;
    const { year } = query;
    // Năm để trống coi như null → mặc định năm hiện tại ở bước getAnnualUnit
    const yearNumber = year != null && year !== '' ? Number(year) : null;
    if (!don_vi_id) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị');
    }
    // Chặn truy cập ngoài phạm vi đơn vị của user trước khi tính toán/trả dữ liệu
    await service.assertUnitInScope(don_vi_id, user?.role, user?.quan_nhan_id);
    // Chỉ tính lại khi có năm hợp lệ; năm trống chỉ đọc dữ liệu sẵn có
    if (yearNumber && !Number.isNaN(yearNumber)) {
      await service.recalculateAnnualUnit(don_vi_id, yearNumber);
    }
    const result = await service.getAnnualUnit(
      don_vi_id,
      yearNumber && !Number.isNaN(yearNumber) ? yearNumber : new Date().getFullYear()
    );
    return ResponseHelper.success(res, {
      message: 'Lấy hồ sơ hằng năm đơn vị thành công',
      data: result,
    });
  });

  /**
   * Đọc thử file Excel nhập liệu để xem trước kết quả (chưa lưu vào DB).
   * @returns Kết quả xem trước, hoặc 400 nếu thiếu file
   */
  previewImport = catchAsync(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await service.previewImport(file.buffer);
    // Ghi audit log cho thao tác xem trước import
    await logImportPreview(
      req,
      AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
      AWARD_LABEL,
      file.originalname,
      result
    );
    return ResponseHelper.success(res, { data: result });
  });

  /**
   * Xác nhận và lưu dữ liệu Excel đã xem trước vào DB; ghi log và gửi thông báo.
   * @returns Kết quả import (số bản ghi đã nhập), hoặc 400 nếu không có dữ liệu
   */
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
      description: logMessages.importSuccess(AWARD_LABEL, result.imported ?? items.length),
      payload: { imported: result.imported ?? items.length },
    });
    // Gom đơn vị từ các dòng đã nhập để thông báo đúng các đơn vị bị ảnh hưởng
    const unitIds = items.map((i: { unit_id: string }) => i.unit_id);
    safeNotifyImport(user.id, AWARD_SLUGS.UNIT_ANNUAL_AWARDS, result.imported ?? items.length, [], unitIds);
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  /**
   * Xuất file Excel mẫu nhập liệu cho các đơn vị được chọn.
   * @returns File .xlsx mẫu nhập liệu
   */
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    // Chấp nhận cả `unit_ids` lẫn alias cũ `personnel_ids` (danh sách phân tách dấu phẩy)
    const rawIds = query.unit_ids ?? query.personnel_ids ?? '';
    let unitIds: string[] = [];
    if (rawIds) {
      unitIds = rawIds
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => id.length > 0);
    }
    const repeatMap: Record<string, number> = {};
    // repeat_map là JSON map đơn vị → số dòng lặp; parse lỗi chỉ log, không chặn xuất file
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: AWARD_SLUGS.UNIT_ANNUAL_AWARDS,
          description: logMessages.invalidRepeatMap(AWARD_LABEL, e),
        });
      }
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

  /**
   * Xuất danh sách khen thưởng đơn vị ra file Excel theo bộ lọc năm/danh hiệu.
   * @returns File .xlsx danh sách khen thưởng
   */
  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ExportToExcelQuery;
    const user = req.user;
    const { nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {
      nam,
      danh_hieu,
    };
    // Truyền role + quân nhân để service chỉ xuất dữ liệu trong phạm vi đơn vị của user
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

  /**
   * Thống kê khen thưởng đơn vị theo năm, trong phạm vi đơn vị của user.
   * @returns Số liệu thống kê
   */
  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetStatisticsQuery;
    const user = req.user;
    const { nam } = query;
    const filters: Record<string, unknown> = { nam };
    // Truyền role + quân nhân để service giới hạn thống kê theo CQDV của MANAGER
    const statistics = await service.getStatistics(filters, user?.role, user?.quan_nhan_id);
    return ResponseHelper.success(res, { data: statistics });
  });
}

export default new UnitAnnualAwardController();
