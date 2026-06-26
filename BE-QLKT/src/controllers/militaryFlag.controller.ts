/*
 * Controller Huân chương Quân kỳ quyết thắng (HC_QKQT) — CRUD + nhập/xuất Excel.
 * Mỗi quân nhân chỉ có 1 record (trao một lần). Điều kiện: phục vụ từ 25 năm trở lên.
 */

import { Request, Response } from 'express';
import militaryFlagService, { ConfirmImportItem } from '../services/militaryFlag.service';
import { ROLES } from '../constants/roles.constants';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import {
  parsePersonnelIdsFromQuery,
  getManagerUnitFilter,
  getAdminUsername,
  logImportPreview,
} from '../helpers/controllerHelper';
import { parsePagination } from '../helpers/paginationHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { logMessages } from '../constants/logMessages.constants';
import { AWARD_SLUGS } from '../constants/awardSlugs.constants';
import { AWARD_LABELS } from '../constants/awardLabels.constants';
import { safeNotifyImport } from '../helpers/notification';

const AWARD_LABEL = AWARD_LABELS[AWARD_SLUGS.MILITARY_FLAG];

interface GetTemplateQuery {
  repeat_map?: string;
  [key: string]: string | string[] | undefined;
}

interface ConfirmImportBody {
  items?: ConfirmImportItem[];
}

interface GetAllQuery {
  don_vi_id?: string;
  nam?: number;
  ho_ten?: string;
  [key: string]: unknown;
}

interface ExportToExcelQuery {
  don_vi_id?: string;
  nam?: number;
  [key: string]: unknown;
}

interface GetByPersonnelIdParams {
  personnel_id?: string;
}

interface IdParams {
  id?: string;
}

class MilitaryFlagController {
  /** Tải file Excel mẫu để nhập HC_QKQT, có thể prefill theo danh sách quân nhân. */
  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const personnelIds = parsePersonnelIdsFromQuery(query);
    const repeatMap: Record<string, number> = {};
    // repeat_map là chuỗi JSON từ query — parse an toàn, lỗi chỉ ghi log không chặn tải mẫu
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) {
        void writeSystemLog({
          action: AUDIT_ACTIONS.ERROR,
          resource: AWARD_SLUGS.MILITARY_FLAG,
          description: logMessages.invalidRepeatMap(AWARD_LABEL, e),
        });
      }
    }

    const workbook = await militaryFlagService.exportTemplate(personnelIds, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `mau_nhap_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  /** Đọc trước file Excel để hiển thị bản xem trước trước khi xác nhận nhập. */
  previewImport = catchAsync(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');

    const result = await militaryFlagService.previewImport(file.buffer);
    await logImportPreview(req, AWARD_SLUGS.MILITARY_FLAG, AWARD_LABEL, file.originalname, result);
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  /** Xác nhận nhập danh sách HC_QKQT, ghi log và gửi thông báo cho quân nhân. */
  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as ConfirmImportBody;
    const { items } = body;
    const result = await militaryFlagService.confirmImport(items);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: AWARD_SLUGS.MILITARY_FLAG,
      description: logMessages.importSuccess(AWARD_LABEL, result.imported ?? items.length),
      payload: { imported: result.imported ?? items.length },
    });
    // Gom mã quân nhân để gửi thông báo cho từng người được trao thưởng
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    safeNotifyImport(user.id, AWARD_SLUGS.MILITARY_FLAG, result.imported ?? items.length, personnelIds);
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  /** Lấy danh sách HC_QKQT (có phân trang), giới hạn theo đơn vị nếu là MANAGER. */
  getAll = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAllQuery;
    const user = req.user!;
    const { don_vi_id, nam, ho_ten } = query;
    const userRole = user.role;
    const { page, limit } = parsePagination(query);

    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (ho_ten) filters.ho_ten = ho_ten;

    // MANAGER chỉ thấy đơn vị mình quản lý; ghi đè bộ lọc đơn vị theo phạm vi quản lý
    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && userRole === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      // CQDV là đơn vị cha nên gồm cả quân nhân ở các đơn vị con
      if (managerUnit.isCoQuanDonVi) filters.include_sub_units = true;
    }

    const result = await militaryFlagService.getAll(filters, page, limit);
    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: `Lấy danh sách ${AWARD_LABEL} thành công`,
    });
  });

  /** Xuất danh sách HC_QKQT ra file Excel, giới hạn theo đơn vị nếu là MANAGER. */
  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as ExportToExcelQuery;
    const user = req.user!;
    const { don_vi_id, nam } = query;

    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;

    // MANAGER chỉ xuất được dữ liệu trong phạm vi đơn vị mình quản lý
    const managerUnit = await getManagerUnitFilter(req);
    if (managerUnit === null && user.role === ROLES.MANAGER) {
      return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    }
    if (managerUnit) {
      filters.don_vi_id = managerUnit.don_vi_id;
      // CQDV là đơn vị cha nên gồm cả quân nhân ở các đơn vị con
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

  /** Lấy số liệu thống kê tổng hợp về HC_QKQT. */
  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const statistics = await militaryFlagService.getStatistics();
    return ResponseHelper.success(res, {
      data: statistics,
      message: `Lấy thống kê ${AWARD_LABEL} thành công`,
    });
  });

  /** Lấy HC_QKQT của một quân nhân, kiểm soát quyền xem theo vai trò. */
  getByPersonnelId = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as GetByPersonnelIdParams;
    const user = req.user!;
    const { personnel_id } = params;
    const userId = user.id;
    const userRole = user.role;
    const userPersonnelId = user.quan_nhan_id;

    // USER chỉ được xem thông tin của chính mình
    if (userRole === ROLES.USER && userPersonnelId !== personnel_id) {
      return ResponseHelper.forbidden(res, 'Bạn chỉ có thể xem thông tin của mình');
    }

    // MANAGER chỉ xem được quân nhân cùng đơn vị mình quản lý
    if (userRole === ROLES.MANAGER) {
      const user = await militaryFlagService.getUserWithUnit(userId);
      if (!user?.QuanNhan) return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');

      // Ưu tiên CQDV (đơn vị cha) rồi mới đến DVTT khi xác định đơn vị
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
      data: { hasReceived: result.length > 0, data: result },
      message: `Lấy ${AWARD_LABEL} theo quân nhân thành công`,
    });
  });

  /** Xóa một record HC_QKQT theo id. */
  deleteAward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const { id } = params;
    const adminUsername = getAdminUsername(req);
    const result = await militaryFlagService.deleteAward(id, adminUsername);
    return ResponseHelper.success(res, { message: result.message, data: result.award });
  });

  /** Kiểm tra quân nhân đã nhận HC_QKQT hay chưa (để chặn trao trùng). */
  checkReceived = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as GetByPersonnelIdParams;
    const { personnel_id } = params;
    if (!personnel_id) return ResponseHelper.badRequest(res, 'Thiếu mã quân nhân');
    const data = await militaryFlagService.checkAlreadyReceived(personnel_id);
    return ResponseHelper.success(res, { data, message: `Kiểm tra ${AWARD_LABEL} thành công` });
  });
}

export default new MilitaryFlagController();
