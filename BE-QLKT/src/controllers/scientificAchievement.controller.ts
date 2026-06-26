/*
 * Controller thành tích NCKH (Nghiên cứu khoa học).
 * Gồm CRUD + Excel preview/confirm. Khi thêm mới sẽ tự kích hoạt tính lại
 * hồ sơ khen thưởng hằng năm.
 * Chống trùng theo bộ ba (personnel_id, nam, mo_ta).
 */

import { Request, Response } from 'express';
import scientificAchievementService, {
  ConfirmImportItem,
} from '../services/scientificAchievement.service';
import personnelService from '../services/personnel.service';
import { ROLES } from '../constants/roles.constants';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import {
  parsePersonnelIdsFromQuery,
  buildManagerQuanNhanFilter,
  getAdminUsername,
  logImportPreview,
} from '../helpers/controllerHelper';
import { safeNotifyImport } from '../helpers/notification';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS];

interface GetAchievementsQuery {
  personnel_id?: string;
  page?: number;
  limit?: number;
  nam?: number;
  loai?: string;
  ho_ten?: string;
}

interface IdParams {
  id?: string;
}

interface ExportToExcelQuery {
  nam?: number;
  loai?: string;
}

interface GetTemplateQuery {
  repeat_map?: string;
  [key: string]: string | string[] | undefined;
}

interface ConfirmImportBody {
  items?: ConfirmImportItem[];
}

class ScientificAchievementController {
  /** Lấy danh sách thành tích NCKH: theo 1 quân nhân hoặc danh sách phân trang. */
  getAchievements = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAchievementsQuery;
    const { personnel_id, page, limit, nam, loai, ho_ten } = query;
    if (personnel_id) {
      await personnelService.assertCanViewPersonnel(
        personnel_id,
        req.user?.role,
        req.user?.quan_nhan_id
      );
      const result = await scientificAchievementService.getAchievements(personnel_id);
      return ResponseHelper.success(res, {
        message: 'Lấy danh sách thành tích khoa học thành công',
        data: result,
      });
    }
    const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });
    const quanNhanFilter: Record<string, unknown> = {};
    if (ho_ten) quanNhanFilter.ho_ten = { contains: ho_ten, mode: 'insensitive' };
    // MANAGER chỉ thấy quân nhân trong đơn vị mình; trả null nếu không giới hạn
    const managerQuanNhanWhere = await buildManagerQuanNhanFilter(req, quanNhanFilter);
    const quanNhanWhere =
      managerQuanNhanWhere ?? (Object.keys(quanNhanFilter).length > 0 ? quanNhanFilter : null);

    const { achievements, total } = await scientificAchievementService.getAchievementsList({
      page: pageNum,
      limit: limitNum,
      nam: nam !== undefined ? String(nam) : undefined,
      loai,
      quanNhanWhere,
    });

    return ResponseHelper.paginated(res, {
      data: achievements,
      total,
      page: pageNum,
      limit: limitNum,
      message: 'Lấy danh sách thành tích khoa học thành công',
    });
  });

  /** Xóa 1 thành tích NCKH theo id. */
  deleteAchievement = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const adminUsername = getAdminUsername(req);
    const result = await scientificAchievementService.deleteAchievement(id, adminUsername);
    return ResponseHelper.success(res, { message: result.message, data: result.achievement });
  });

  /** Xuất danh sách thành tích NCKH ra file Excel theo bộ lọc. */
  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ExportToExcelQuery;
    const user = req.user;
    const { nam, loai } = query;
    const role = user?.role;
    const userUnitId = user?.co_quan_don_vi_id ?? user?.don_vi_truc_thuoc_id;
    const filters: Record<string, unknown> = {
      nam,
      loai,
    };
    // MANAGER chỉ xuất dữ liệu trong phạm vi đơn vị mình
    if (role === ROLES.MANAGER && userUnitId) filters.don_vi_id = userUnitId;
    const workbook = await scientificAchievementService.exportToExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_thanh_tich_khoa_hoc_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  });

  /** Tạo file Excel mẫu để nhập thành tích NCKH (theo danh sách quân nhân). */
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const personnelIds = parsePersonnelIdsFromQuery(query);
    // repeat_map: JSON {personnel_id: số dòng lặp} để chừa sẵn nhiều dòng/quân nhân
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
          description: logMessages.invalidRepeatMap(AWARD_LABEL, e),
        });
      }
    }
    const workbook = await scientificAchievementService.generateTemplate(personnelIds, repeatMap);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_nhap_thanh_tich_khoa_hoc_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  });

  /** Đọc thử file Excel tải lên, trả về kết quả xem trước trước khi nhập thật. */
  previewImport = catchAsync(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await scientificAchievementService.previewImport(file.buffer);
    await logImportPreview(
      req,
      AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
      AWARD_LABEL,
      file.originalname,
      result
    );
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });

  /** Xác nhận nhập danh sách thành tích NCKH đã xem trước vào hệ thống. */
  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ConfirmImportBody;
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để nhập');
    }
    const result = await scientificAchievementService.confirmImport(items, user.id);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS,
      description: logMessages.importSuccess(AWARD_LABEL, result.imported || items.length),
      payload: { imported: result.imported || items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    safeNotifyImport(user.id, AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS, result.imported || items.length, personnelIds);
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });
}

export default new ScientificAchievementController();
