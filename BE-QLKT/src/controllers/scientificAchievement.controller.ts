import { Request, Response } from 'express';
import scientificAchievementService, { ConfirmImportItem } from '../services/scientificAchievement.service';
import profileService from '../services/profile.service';
import { ROLES } from '../constants/roles.constants';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { parsePersonnelIdsFromQuery, buildManagerQuanNhanFilter, getAdminUsername } from '../helpers/controllerHelper';
import { notifyOnImport } from '../helpers/notification';

class ScientificAchievementController {
  getAchievements = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as {
      personnel_id?: string;
      page?: number;
      limit?: number;
      nam?: number;
      loai?: string;
      ho_ten?: string;
    };
    const { personnel_id, page, limit, nam, loai, ho_ten } = query;
    if (personnel_id) {
      const result = await scientificAchievementService.getAchievements(personnel_id);
      return ResponseHelper.success(res, {
        message: 'Lấy danh sách thành tích khoa học thành công',
        data: result,
      });
    }
    const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });
    const quanNhanFilter: Record<string, unknown> = {};
    if (ho_ten) quanNhanFilter.ho_ten = { contains: ho_ten, mode: 'insensitive' };
    const managerQuanNhanWhere = await buildManagerQuanNhanFilter(req, quanNhanFilter);
    const quanNhanWhere = managerQuanNhanWhere ?? (Object.keys(quanNhanFilter).length > 0 ? quanNhanFilter : null);

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

  createAchievement = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const body = req.body as {
      personnel_id?: string;
      nam?: number;
      loai?: string;
      mo_ta?: string;
      cap_bac?: string;
      chuc_vu?: string;
      ghi_chu?: string;
    };
    const { personnel_id, nam, loai, mo_ta, cap_bac, chuc_vu, ghi_chu } = body;
    if (!personnel_id || !nam || !loai || !mo_ta) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ: quân nhân, năm, loại và mô tả');
    }
    const result = await scientificAchievementService.createAchievement({
      personnel_id,
      nam,
      loai,
      mo_ta,
      cap_bac,
      chuc_vu,
      ghi_chu,
    });
    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (recalcError) {
      await writeSystemLog({
        userId: user?.id,
        userRole: user?.role,
        action: 'ERROR',
        resource: 'scientific-achievements',
        description: 'Lỗi tính lại hồ sơ hằng năm sau khi thêm thành tích NCKH',
        payload: { error: String(recalcError), personnel_id },
      });
    }
    return ResponseHelper.created(res, { message: 'Thêm thành tích thành công', data: result });
  });

  updateAchievement = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const params = req.params as { id?: string };
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const body = req.body as {
      nam?: number;
      loai?: string;
      mo_ta?: string;
      cap_bac?: string;
      chuc_vu?: string;
      ghi_chu?: string;
    };
    const { nam, loai, mo_ta, cap_bac, chuc_vu, ghi_chu } = body;
    const result = await scientificAchievementService.updateAchievement(id, {
      nam,
      loai,
      mo_ta,
      cap_bac,
      chuc_vu,
      ghi_chu,
    });
    try {
      await profileService.recalculateAnnualProfile(result.quan_nhan_id);
    } catch (recalcError) {
      await writeSystemLog({
        userId: user?.id,
        userRole: user?.role,
        action: 'ERROR',
        resource: 'scientific-achievements',
        description: 'Lỗi tính lại hồ sơ hằng năm sau khi cập nhật thành tích NCKH',
        payload: { error: String(recalcError), personnel_id: result.quan_nhan_id },
      });
    }
    return ResponseHelper.success(res, { message: 'Cập nhật thành tích thành công', data: result });
  });

  deleteAchievement = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as { id?: string };
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const adminUsername = getAdminUsername(req);
    const result = await scientificAchievementService.deleteAchievement(id, adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as {
      nam?: number;
      loai?: string;
    };
    const user = req.user;
    const { nam, loai } = query;
    const role = user?.role;
    const userUnitId = user?.co_quan_don_vi_id ?? user?.don_vi_truc_thuoc_id;
    const filters: Record<string, unknown> = {
      nam,
      loai,
    };
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

  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as { repeat_map?: string };
    const personnelIds = parsePersonnelIdsFromQuery(query);
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        Object.assign(repeatMap, JSON.parse(query.repeat_map));
      } catch (e) { console.error('Invalid repeat_map JSON:', e); }
    }
    const workbook = await scientificAchievementService.generateTemplate(personnelIds, repeatMap);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_thanh_tich_khoa_hoc_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');
    }
    const result = await scientificAchievementService.previewImport(file.buffer);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'scientific-achievements',
      description: `Tải lên file "${file.originalname ? Buffer.from(file.originalname, 'latin1').toString('utf8') : 'Excel'}" để review thành tích khoa học: ${result.valid?.length || 0} hợp lệ, ${result.errors?.length || 0} lỗi`,
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
    const body = req.body as { items?: ConfirmImportItem[] };
    const { items } = body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để import');
    }
    const result = await scientificAchievementService.confirmImport(items, user.id);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'scientific-achievements',
      description: `Nhập dữ liệu thành tích khoa học thành công: ${result.imported || items.length} bản ghi`,
      payload: { imported: result.imported || items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    notifyOnImport(user.id, 'scientific-achievements', result.imported || items.length, personnelIds).catch((e) => { console.error('[scientific-achievements] notifyOnImport failed:', e); });
    return ResponseHelper.success(res, { message: 'Thao tác thành công', data: result });
  });
}

export default new ScientificAchievementController();
