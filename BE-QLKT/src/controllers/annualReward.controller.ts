import { Request, Response } from 'express';
import annualRewardService from '../services/annualReward.service';
import profileService from '../services/profile.service';
import { ROLES } from '../constants/roles.constants';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { notifyOnImport } from '../helpers/notification';
import {
  parsePersonnelIdsFromQuery,
  buildManagerQuanNhanFilter,
  getAdminUsername,
} from '../helpers/controllerHelper';

interface GetAnnualRewardsQuery {
  personnel_id?: string;
  page?: number;
  limit?: number;
  nam?: number;
  danh_hieu?: string;
  ho_ten?: string;
}

interface CreateAnnualRewardBody {
  personnel_id?: string;
  nam?: number;
  danh_hieu?: string;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string;
}

interface UpdateAnnualRewardBody {
  nam?: number;
  danh_hieu?: string;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  nhan_bkbqp?: boolean;
  so_quyet_dinh_bkbqp?: string;
  nhan_cstdtq?: boolean;
  so_quyet_dinh_cstdtq?: string;
  nhan_bkttcp?: boolean;
  so_quyet_dinh_bkttcp?: string;
}

interface IdParams {
  id?: string;
}

interface PersonnelIdParams {
  personnelId?: string;
}

interface CheckAnnualRewardsBody {
  personnel_ids?: string[];
  nam?: number;
  danh_hieu?: string;
}

interface BulkCreateAnnualRewardsBody {
  personnel_ids?: string[];
  personnel_rewards_data?: Array<{
    personnel_id: string;
    so_quyet_dinh?: string;
    cap_bac?: string;
    chuc_vu?: string;
  }>;
  nam?: number;
  danh_hieu?: string;
  ghi_chu?: string;
  so_quyet_dinh?: string;
  cap_bac?: string;
  chuc_vu?: string;
}

interface ConfirmImportItem {
  personnel_id: string;
  ho_ten: string;
  nam: number;
  danh_hieu: string;
  cap_bac?: string | null;
  chuc_vu?: string | null;
  so_quyet_dinh?: string | null;
  ghi_chu?: string | null;
}

interface ConfirmImportBody {
  items?: ConfirmImportItem[];
}

interface GetTemplateQuery {
  repeat_map?: string;
  [key: string]: string | string[] | undefined;
}

interface ExportToExcelQuery {
  nam?: number;
  danh_hieu?: string;
  don_vi_id?: string;
  personnel_ids?: string;
}

interface GetStatisticsQuery {
  nam?: number;
}

class AnnualRewardController {
  getAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAnnualRewardsQuery;
    const { personnel_id, page, limit, nam, danh_hieu, ho_ten } = query;

    if (personnel_id) {
      const result = await annualRewardService.getAnnualRewards(personnel_id);
      return ResponseHelper.success(res, {
        data: result,
        message: 'Lấy danh sách danh hiệu thành công',
      });
    }

    const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });

    const quanNhanFilter: Record<string, unknown> = {};
    if (ho_ten) {
      quanNhanFilter.ho_ten = { contains: ho_ten, mode: 'insensitive' };
    }

    const managerQuanNhanWhere = await buildManagerQuanNhanFilter(req, quanNhanFilter);
    const quanNhanWhere = managerQuanNhanWhere ?? (Object.keys(quanNhanFilter).length > 0 ? quanNhanFilter : null);

    const { awards, total } = await annualRewardService.getAnnualRewardsList({
      page: pageNum,
      limit: limitNum,
      nam,
      danh_hieu,
      quanNhanWhere,
    });

    return ResponseHelper.paginated(res, {
      data: awards,
      total,
      page: pageNum,
      limit: limitNum,
      message: 'Lấy danh sách danh hiệu thành công',
    });
  });

  createAnnualReward = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const body = req.body as CreateAnnualRewardBody;
    const {
      personnel_id,
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    } = body;

    const result = await annualRewardService.createAnnualReward({
      personnel_id,
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    });

    try {
      await profileService.recalculateAnnualProfile(personnel_id);
    } catch (recalcError) {
      await writeSystemLog({
        userId: user?.id,
        userRole: user?.role,
        action: 'ERROR',
        resource: 'annual-rewards',
        description: 'Lỗi tính lại hồ sơ hằng năm sau khi thêm danh hiệu',
        payload: { error: String(recalcError), personnel_id },
      });
    }

    return ResponseHelper.created(res, { data: result, message: 'Thêm danh hiệu thành công' });
  });

  updateAnnualReward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user;
    const body = req.body as UpdateAnnualRewardBody;
    const id = normalizeParam(params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const {
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    } = body;

    const result = await annualRewardService.updateAnnualReward(id, {
      nam,
      danh_hieu,
      cap_bac,
      chuc_vu,
      ghi_chu,
      nhan_bkbqp,
      so_quyet_dinh_bkbqp,
      nhan_cstdtq,
      so_quyet_dinh_cstdtq,
      nhan_bkttcp,
      so_quyet_dinh_bkttcp,
    });

    try {
      await profileService.recalculateAnnualProfile(result.quan_nhan_id);
    } catch (recalcError) {
      await writeSystemLog({
        userId: user?.id,
        userRole: user?.role,
        action: 'ERROR',
        resource: 'annual-rewards',
        description: 'Lỗi tính lại hồ sơ hằng năm sau khi cập nhật danh hiệu',
        payload: { error: String(recalcError), personnel_id: result.quan_nhan_id },
      });
    }

    return ResponseHelper.success(res, { data: result, message: 'Cập nhật danh hiệu thành công' });
  });

  deleteAnnualReward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const query = req.query as { awardType?: string };
    const awardType = normalizeParam(query.awardType) || null;
    const adminUsername = getAdminUsername(req);
    const result = await annualRewardService.deleteAnnualReward(id, adminUsername, awardType);
    return ResponseHelper.success(res, { message: result.message });
  });

  checkAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CheckAnnualRewardsBody;
    const { personnel_ids, nam, danh_hieu } = body;
    const result = await annualRewardService.checkAnnualRewards(personnel_ids, nam, danh_hieu);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Kiểm tra khen thưởng hằng năm thành công',
    });
  });

  bulkCreateAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as BulkCreateAnnualRewardsBody;
    const {
      personnel_ids,
      personnel_rewards_data,
      nam,
      danh_hieu,
      ghi_chu,
      so_quyet_dinh,
      cap_bac,
      chuc_vu,
    } = body;

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids,
      personnel_rewards_data,
      nam,
      danh_hieu,
      ghi_chu,
      so_quyet_dinh,
      cap_bac,
      chuc_vu,
    });

    return ResponseHelper.created(res, {
      data: result,
      message: `Thêm danh hiệu thành công cho ${result.success} quân nhân`,
    });
  });

  previewImport = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');

    const result = await annualRewardService.previewImport(file.buffer);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'annual-rewards',
      description: `Tải lên file "${Buffer.from(file.originalname, 'latin1').toString('utf8')}" để review danh hiệu cá nhân hằng năm: ${result.valid?.length ?? 0} hợp lệ, ${result.errors?.length ?? 0} lỗi`,
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
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để nhập');
    }
    const result = await annualRewardService.confirmImport(items);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'annual-rewards',
      description: `Nhập dữ liệu danh hiệu cá nhân hằng năm thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    const personnelIds = items.map((i: { personnel_id: string }) => i.personnel_id);
    notifyOnImport(user.id, 'annual-rewards', result.imported ?? items.length, personnelIds).catch((e) => { console.error('[annual-rewards] notifyOnImport failed:', e); });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  importAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file?.buffer) {
      return ResponseHelper.badRequest(
        res,
        'Không tìm thấy file upload. Vui lòng gửi form-data field "file"'
      );
    }
    const result = await annualRewardService.importFromExcelBuffer(file.buffer);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Import danh hiệu hằng năm hoàn tất',
    });
  });

  checkAlreadyReceivedHCQKQT = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const personnelId = normalizeParam(params.personnelId);
    if (!personnelId) return ResponseHelper.badRequest(res, 'Thiếu personnelId');
    const data = await annualRewardService.checkAlreadyReceivedHCQKQT(personnelId);
    return ResponseHelper.success(res, { data, message: 'Kiểm tra HCQKQT thành công' });
  });

  checkAlreadyReceivedKNCVSNXDQDNDVN = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const personnelId = normalizeParam(params.personnelId);
    if (!personnelId) return ResponseHelper.badRequest(res, 'Thiếu personnelId');
    const data = await annualRewardService.checkAlreadyReceivedKNCVSNXDQDNDVN(personnelId);
    return ResponseHelper.success(res, { data, message: 'Kiểm tra KNC VSNXD QDNDVN thành công' });
  });

  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetTemplateQuery;
    const personnelIds = parsePersonnelIdsFromQuery(query);
    const repeatMap: Record<string, number> = {};
    if (query.repeat_map) {
      try {
        const parsed = JSON.parse(query.repeat_map);
        Object.assign(repeatMap, parsed);
      } catch (e) { console.error('Invalid repeat_map JSON:', e); }
    }

    const workbook = await annualRewardService.exportTemplate(personnelIds, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_nhap_ca_nhan_hang_nam_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const rawQuery = req.query;
    const query = rawQuery as ExportToExcelQuery;
    const user = req.user;
    const { nam, danh_hieu, don_vi_id } = query;
    const role = user?.role;
    const userUnitId = user?.co_quan_don_vi_id ?? user?.don_vi_truc_thuoc_id;

    const filters: Record<string, unknown> = {
      nam,
      danh_hieu,
      don_vi_id,
    };

    const parsedPersonnelIds = parsePersonnelIdsFromQuery(rawQuery);
    if (parsedPersonnelIds.length > 0) {
      filters.personnel_ids = parsedPersonnelIds;
    }

    if (role === ROLES.MANAGER && userUnitId) {
      filters.don_vi_id = userUnitId;
    }

    const workbook = await annualRewardService.exportToExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_ca_nhan_hang_nam_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetStatisticsQuery;
    const user = req.user;
    const { nam } = query;
    const role = user?.role;
    const userUnitId = user?.co_quan_don_vi_id ?? user?.don_vi_truc_thuoc_id;

    const filters: Record<string, unknown> = {
      nam,
    };
    if (role === ROLES.MANAGER && userUnitId) {
      filters.don_vi_id = userUnitId;
    }

    const statistics = await annualRewardService.getStatistics(filters);
    return ResponseHelper.success(res, {
      data: statistics,
      message: 'Lấy thống kê danh hiệu hằng năm thành công',
    });
  });
}

export default new AnnualRewardController();
