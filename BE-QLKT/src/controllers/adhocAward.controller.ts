/*
 * Controller khen thưởng đột xuất (DOT_XUAT).
 * Admin thêm trực tiếp, không qua chuỗi điều kiện như khen thưởng hằng năm.
 * Nhận multipart (file quyết định + file đính kèm). CRUD + lọc theo quân nhân/đơn vị.
 */

import { Request, Response } from 'express';
import adhocAwardService from '../services/adhocAward.service';
import { ROLES } from '../constants/roles.constants';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { getManagerUnitFilter, getSubordinateUnitIds } from '../helpers/controllerHelper';
import { ADHOC_TYPE } from '../constants/adhocType.constants';
import { UNIT_TYPE } from '../constants/unitType.constants';

interface CreateAdhocAwardBody {
  type?: (typeof ADHOC_TYPE)[keyof typeof ADHOC_TYPE];
  year?: unknown;
  awardForm?: string;
  personnelId?: string;
  unitId?: string;
  unitType?: string;
  rank?: string;
  position?: string;
  note?: string;
  decisionNumber?: string;
  decisionYear?: unknown;
  signDate?: string;
  signer?: string;
}

interface GetAdhocAwardsQuery {
  type?: string;
  year?: string;
  personnelId?: string;
  unitId?: string;
  ho_ten?: string;
  page?: number;
  limit?: number;
}

interface IdParams {
  id?: string;
}

interface UpdateAdhocAwardBody {
  awardForm?: string;
  year?: unknown;
  rank?: string;
  position?: string;
  note?: string;
  decisionNumber?: string;
  removeAttachedFileIndexes?: string;
}

interface PersonnelIdParams {
  personnelId?: string;
}

interface UnitIdParams {
  unitId?: string;
}

interface GetAdhocAwardsByUnitQuery {
  unitType?: string;
}

class AdhocAwardController {
  /** Tạo khen thưởng đột xuất cho cá nhân hoặc tập thể (kèm file đính kèm). */
  createAdhocAward = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const adminId = user.id;
    const body = req.body as CreateAdhocAwardBody;
    const {
      type,
      year,
      awardForm,
      personnelId,
      unitId,
      unitType,
      rank,
      position,
      note,
      decisionNumber,
      decisionYear,
      signDate,
      signer,
    } = body;

    if (!type || !Object.values(ADHOC_TYPE).includes(type)) {
      return ResponseHelper.badRequest(
        res,
        'Loại khen thưởng không hợp lệ. Chỉ chấp nhận: CA_NHAN, TAP_THE'
      );
    }

    if (type === ADHOC_TYPE.CA_NHAN && !personnelId) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin quân nhân (personnelId)');
    }

    if (type === ADHOC_TYPE.TAP_THE && (!unitId || !unitType)) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin đơn vị (unitId và unitType)');
    }

    if (!awardForm || !year) {
      return ResponseHelper.badRequest(res, 'Thiếu thông tin bắt buộc (awardForm, year)');
    }

    // Tách file đính kèm (nhiều) và file quyết định (chỉ lấy file đầu) từ multipart
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const attachedFiles = files?.attachedFiles || [];
    const decisionFile = files?.decisionFiles?.[0];

    const result = await adhocAwardService.createAdhocAward({
      adminId,
      type,
      year: parseInt(String(year), 10),
      awardForm,
      personnelId,
      unitId,
      unitType,
      rank,
      position,
      note,
      decisionNumber,
      decisionYear:
        decisionYear != null && decisionYear !== ''
          ? parseInt(String(decisionYear), 10)
          : undefined,
      signDate,
      signer,
      decisionFile,
      attachedFiles,
    });

    return ResponseHelper.created(res, {
      data: result,
      message: 'Tạo khen thưởng đột xuất thành công',
    });
  });

  /** Danh sách khen thưởng đột xuất có phân trang; Manager bị giới hạn theo đơn vị. */
  getAdhocAwards = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const query = req.query as GetAdhocAwardsQuery;
    const { type, year, personnelId, unitId, ho_ten, page, limit } = query;
    const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });
    const userRole = user?.role;
    const userQuanNhanId = user?.quan_nhan_id;

    const filterOptions: Record<string, unknown> = {
      type,
      year: year ? parseInt(year as string) : undefined,
      personnelId,
      unitId,
      ho_ten,
      page: pageNum,
      limit: limitNum,
    };

    // Manager chỉ thấy khen thưởng trong phạm vi đơn vị mình quản lý
    if (userRole === ROLES.MANAGER) {
      if (!userQuanNhanId) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin quân nhân');
      }

      const managerUnit = await getManagerUnitFilter(req);
      if (!managerUnit) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }

      // Manager cấp CQDV: gom cả CQDV cha + các DVTT con; cấp DVTT: chỉ đơn vị đó
      if (managerUnit.co_quan_don_vi_id) {
        filterOptions.managerCoQuanId = managerUnit.co_quan_don_vi_id;
        filterOptions.managerDonViTrucThuocIds = await getSubordinateUnitIds(
          managerUnit.co_quan_don_vi_id
        );
      } else if (managerUnit.don_vi_truc_thuoc_id) {
        filterOptions.managerDonViTrucThuocId = managerUnit.don_vi_truc_thuoc_id;
      }
    }

    const result = await adhocAwardService.getAdhocAwards(filterOptions);

    return ResponseHelper.paginated(res, {
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: 'Lấy danh sách khen thưởng đột xuất thành công',
    });
  });

  /** Chi tiết một khen thưởng đột xuất theo id. */
  getAdhocAwardById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const result = await adhocAwardService.getAdhocAwardById(id);

    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy chi tiết khen thưởng đột xuất thành công',
    });
  });

  /** Cập nhật khen thưởng đột xuất; thêm file mới và xóa file đính kèm theo chỉ số. */
  updateAdhocAward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user!;
    const body = req.body as UpdateAdhocAwardBody;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const adminId = user.id;
    const { awardForm, year, rank, position, note, decisionNumber, removeAttachedFileIndexes } =
      body;

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const attachedFiles = files?.attachedFiles || [];

    const result = await adhocAwardService.updateAdhocAward({
      id,
      adminId,
      awardForm,
      year: year != null && year !== '' ? parseInt(String(year), 10) : undefined,
      rank,
      position,
      note,
      decisionNumber,
      attachedFiles,
      // FE gửi danh sách chỉ số file cần xóa dưới dạng chuỗi JSON
      removeAttachedFileIndexes: removeAttachedFileIndexes
        ? JSON.parse(removeAttachedFileIndexes)
        : [],
    });

    return ResponseHelper.success(res, {
      data: result,
      message: 'Cập nhật khen thưởng đột xuất thành công',
    });
  });

  /** Xóa khen thưởng đột xuất theo id. */
  deleteAdhocAward = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user!;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id');
    }
    const adminId = user.id;

    const result = await adhocAwardService.deleteAdhocAward(id, adminId);

    return ResponseHelper.success(res, {
      message: 'Xóa khen thưởng đột xuất thành công',
      data: result.award,
    });
  });

  /** Khen thưởng đột xuất của một quân nhân; người dùng thường chỉ xem của chính mình. */
  getAdhocAwardsByPersonnel = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as PersonnelIdParams;
    const user = req.user!;
    const personnelId = normalizeParam(params.personnelId);
    if (!personnelId) {
      return ResponseHelper.badRequest(res, 'Thiếu personnelId');
    }
    const userPersonnelId = user.quan_nhan_id;
    const userRole = user.role;

    // User thường chỉ xem được của mình; Admin/Manager xem được của quân nhân khác
    if (
      personnelId !== userPersonnelId &&
      !([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER] as string[]).includes(userRole)
    ) {
      return ResponseHelper.forbidden(res, 'Bạn chỉ có thể xem khen thưởng của chính mình.');
    }

    const result = await adhocAwardService.getAdhocAwardsByPersonnel(personnelId);

    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy danh sách khen thưởng đột xuất của quân nhân thành công',
    });
  });

  /** Khen thưởng đột xuất của một đơn vị; cần unitType để phân biệt CQDV/DVTT. */
  getAdhocAwardsByUnit = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as UnitIdParams;
    const query = req.query as GetAdhocAwardsByUnitQuery;
    const unitId = normalizeParam(params.unitId);
    if (!unitId) {
      return ResponseHelper.badRequest(res, 'Thiếu unitId');
    }
    const { unitType } = query;

    if (!unitType || !(Object.values(UNIT_TYPE) as string[]).includes(unitType as string)) {
      return ResponseHelper.badRequest(res, 'Thiếu hoặc sai loại đơn vị (unitType)');
    }

    const result = await adhocAwardService.getAdhocAwardsByUnit(unitId, unitType as string);

    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy danh sách khen thưởng đột xuất của đơn vị thành công',
    });
  });
}

export default new AdhocAwardController();
