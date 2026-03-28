import { Request, Response } from 'express';
import annualRewardService from '../services/annualReward.service';
import profileService from '../services/profile.service';
import { prisma } from '../models';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { PROPOSAL_STATUS } from '../constants/proposalStatus.constants';
import {
  parsePersonnelIdsFromQuery,
  buildManagerQuanNhanFilter,
} from '../helpers/controllerHelpers';

class AnnualRewardController {
  getAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    const { personnel_id, page, limit, nam, danh_hieu, ho_ten } = req.query;

    if (personnel_id) {
      const result = await annualRewardService.getAnnualRewards(personnel_id as string);
      return ResponseHelper.success(res, {
        data: result,
        message: 'Lấy danh sách danh hiệu thành công',
      });
    }

    const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });
    const where: Record<string, unknown> = {};

    if (nam) where.nam = parseInt(nam as string);
    if (danh_hieu) where.danh_hieu = danh_hieu;

    const quanNhanFilter: Record<string, unknown> = {};
    if (ho_ten) {
      quanNhanFilter.ho_ten = { contains: ho_ten, mode: 'insensitive' };
    }

    const managerQuanNhanWhere = await buildManagerQuanNhanFilter(req, quanNhanFilter);
    if (managerQuanNhanWhere) {
      where.QuanNhan = managerQuanNhanWhere;
    } else if (Object.keys(quanNhanFilter).length > 0) {
      where.QuanNhan = quanNhanFilter;
    }

    const [awards, total] = await Promise.all([
      prisma.danhHieuHangNam.findMany({
        where,
        include: {
          QuanNhan: {
            include: { CoQuanDonVi: true, DonViTrucThuoc: true, ChucVu: true },
          },
        },
        orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.danhHieuHangNam.count({ where }),
    ]);

    return ResponseHelper.paginated(res, {
      data: awards,
      total,
      page: pageNum,
      limit: limitNum,
      message: 'Lấy danh sách danh hiệu thành công',
    });
  });

  createAnnualReward = catchAsync(async (req: Request, res: Response) => {
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
    } = req.body;

    if (!personnel_id || !nam || !danh_hieu) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin: quân nhân, năm và danh hiệu'
      );
    }

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
      console.warn('Recalculate annual profile failed:', recalcError);
    }

    return ResponseHelper.created(res, { data: result, message: 'Thêm danh hiệu thành công' });
  });

  updateAnnualReward = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
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
    } = req.body;

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
      console.warn('Recalculate annual profile failed:', recalcError);
    }

    return ResponseHelper.success(res, { data: result, message: 'Cập nhật danh hiệu thành công' });
  });

  deleteAnnualReward = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const adminUsername = req.user?.username ?? 'Admin';
    const result = await annualRewardService.deleteAnnualReward(id, adminUsername);
    return ResponseHelper.success(res, { message: result.message });
  });

  checkAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    let { personnel_ids, nam, danh_hieu } = req.body;

    if (personnel_ids && Array.isArray(personnel_ids)) {
      personnel_ids = personnel_ids.filter(
        (id: unknown) => id !== null && id !== undefined && id !== '' && typeof id === 'string'
      );
    }

    if (!personnel_ids || !Array.isArray(personnel_ids) || personnel_ids.length === 0) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp danh sách quân nhân hợp lệ');
    }
    if (!nam || !danh_hieu) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp năm và danh hiệu');
    }

    const result = await annualRewardService.checkAnnualRewards(personnel_ids, nam, danh_hieu);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Kiểm tra khen thưởng hằng năm thành công',
    });
  });

  bulkCreateAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    const {
      personnel_ids,
      personnel_rewards_data,
      nam,
      danh_hieu,
      ghi_chu,
      so_quyet_dinh,
      cap_bac,
      chuc_vu,
    } = req.body;

    let parsedPersonnelIds = personnel_ids;
    if (typeof personnel_ids === 'string') {
      try {
        parsedPersonnelIds = JSON.parse(personnel_ids);
      } catch {
        return ResponseHelper.badRequest(res, 'Danh sách quân nhân không hợp lệ');
      }
    }

    if (
      !parsedPersonnelIds ||
      !Array.isArray(parsedPersonnelIds) ||
      parsedPersonnelIds.length === 0
    ) {
      return ResponseHelper.badRequest(res, 'Vui lòng chọn ít nhất một quân nhân');
    }
    if (!nam || !danh_hieu) {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập đầy đủ thông tin: năm và danh hiệu');
    }

    let parsedPersonnelRewardsData = personnel_rewards_data;
    if (typeof personnel_rewards_data === 'string') {
      try {
        parsedPersonnelRewardsData = JSON.parse(personnel_rewards_data);
      } catch {
        parsedPersonnelRewardsData = null;
      }
    }

    const result = await annualRewardService.bulkCreateAnnualRewards({
      personnel_ids: parsedPersonnelIds,
      personnel_rewards_data: parsedPersonnelRewardsData,
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
    if (!req.file) return ResponseHelper.badRequest(res, 'Vui lòng upload file Excel');

    const result = await annualRewardService.previewImport(req.file.buffer);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AUDIT_ACTIONS.IMPORT_PREVIEW,
      resource: 'annual-rewards',
      description: `Tải lên file "${Buffer.from(req.file.originalname, 'latin1').toString('utf8')}" để review danh hiệu cá nhân hằng năm: ${result.valid?.length ?? 0} hợp lệ, ${result.errors?.length ?? 0} lỗi`,
      payload: {
        filename: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        total: result.total,
        errors: result.errors?.length ?? 0,
      },
    });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  confirmImport = catchAsync(async (req: Request, res: Response) => {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Không có dữ liệu để import');
    }
    const result = await annualRewardService.confirmImport(items);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'annual-rewards',
      description: `Nhập dữ liệu danh hiệu cá nhân hằng năm thành công: ${result.imported ?? items.length} bản ghi`,
      payload: { imported: result.imported ?? items.length },
    });
    return ResponseHelper.success(res, { data: result, message: 'Thao tác thành công' });
  });

  importAnnualRewards = catchAsync(async (req: Request, res: Response) => {
    if (!req.file?.buffer) {
      return ResponseHelper.badRequest(
        res,
        'Không tìm thấy file upload. Vui lòng gửi form-data field "file"'
      );
    }
    const result = await annualRewardService.importFromExcelBuffer(req.file.buffer);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Import danh hiệu hằng năm hoàn tất',
    });
  });

  checkAlreadyReceivedHCQKQT = catchAsync(async (req: Request, res: Response) => {
    const personnelId = normalizeParam(req.params.personnelId);
    if (!personnelId) return ResponseHelper.badRequest(res, 'Thiếu personnelId');

    const existingAward = await prisma.huanChuongQuanKyQuyetThang.findUnique({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) {
      return ResponseHelper.success(res, {
        data: { alreadyReceived: true, reason: 'Đã nhận', award: existingAward },
        message: 'Kiểm tra HCQKQT thành công',
      });
    }

    const pendingProposal = await prisma.bangDeXuat.findFirst({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.HC_QKQT,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
      },
    });
    if (pendingProposal) {
      return ResponseHelper.success(res, {
        data: { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal },
        message: 'Kiểm tra HCQKQT thành công',
      });
    }

    return ResponseHelper.success(res, {
      data: { alreadyReceived: false, reason: null },
      message: 'Kiểm tra HCQKQT thành công',
    });
  });

  checkAlreadyReceivedKNCVSNXD = catchAsync(async (req: Request, res: Response) => {
    const personnelId = normalizeParam(req.params.personnelId);
    if (!personnelId) return ResponseHelper.badRequest(res, 'Thiếu personnelId');

    const existingAward = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
      where: { quan_nhan_id: personnelId },
    });
    if (existingAward) {
      return ResponseHelper.success(res, {
        data: { alreadyReceived: true, reason: 'Đã nhận', award: existingAward },
        message: 'Kiểm tra KNC VSNXD thành công',
      });
    }

    const pendingProposal = await prisma.bangDeXuat.findFirst({
      where: {
        loai_de_xuat: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
        status: PROPOSAL_STATUS.PENDING,
        data_nien_han: { array_contains: [{ personnel_id: personnelId }] },
      },
    });
    if (pendingProposal) {
      return ResponseHelper.success(res, {
        data: { alreadyReceived: true, reason: 'Đang chờ duyệt', proposal: pendingProposal },
        message: 'Kiểm tra KNC VSNXD thành công',
      });
    }

    return ResponseHelper.success(res, {
      data: { alreadyReceived: false, reason: null },
      message: 'Kiểm tra KNC VSNXD thành công',
    });
  });

  getTemplate = catchAsync(async (req: Request, res: Response) => {
    const userRole = req.user!.role;
    const personnelIds = parsePersonnelIdsFromQuery(req.query);
    const repeatMap: Record<string, number> = {};
    if (req.query.repeat_map) {
      try {
        const parsed = JSON.parse(req.query.repeat_map as string);
        Object.assign(repeatMap, parsed);
      } catch { /* ignore */ }
    }

    const workbook = await annualRewardService.exportTemplate(personnelIds, userRole, repeatMap);
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_ca_nhan_hang_nam_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.send(buffer);
  });

  exportToExcel = catchAsync(async (req: Request, res: Response) => {
    const { nam, danh_hieu, don_vi_id, personnel_ids } = req.query;
    const role = req.user?.role;
    const userUnitId = req.user?.co_quan_don_vi_id ?? req.user?.don_vi_truc_thuoc_id;

    const filters: Record<string, unknown> = {
      nam: nam ? parseInt(nam as string) : undefined,
      danh_hieu: danh_hieu ?? undefined,
      don_vi_id: don_vi_id ?? undefined,
    };

    const parsedPersonnelIds = parsePersonnelIdsFromQuery(req.query);
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
    return res.send(buffer);
  });

  getStatistics = catchAsync(async (req: Request, res: Response) => {
    const { nam } = req.query;
    const role = req.user?.role;
    const userUnitId = req.user?.co_quan_don_vi_id ?? req.user?.don_vi_truc_thuoc_id;

    const filters: Record<string, unknown> = {
      nam: nam ? parseInt(nam as string) : undefined,
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
