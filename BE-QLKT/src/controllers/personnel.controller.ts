import { Request, Response } from 'express';
import personnelService from '../services/personnel.service';
import { parsePagination } from '../helpers/paginationHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

interface GetPersonnelQuery {
  search?: string;
  unit_id?: string;
  [key: string]: unknown;
}

interface IdParams {
  id?: string;
}

interface CreatePersonnelBody {
  cccd?: string;
  unit_id?: string;
  position_id?: string;
  role?: string;
}

interface UpdatePersonnelBody {
  unit_id?: string;
  position_id?: string;
  don_vi_id?: string;
  chuc_vu_id?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  ho_ten?: string;
  gioi_tinh?: string;
  ngay_sinh?: Date;
  cccd?: string;
  cap_bac?: string;
  ngay_nhap_ngu?: Date;
  ngay_xuat_ngu?: Date;
  que_quan_2_cap?: string;
  que_quan_3_cap?: string;
  tru_quan?: string;
  cho_o_hien_nay?: string;
  ngay_vao_dang?: Date;
  ngay_vao_dang_chinh_thuc?: Date;
  so_the_dang_vien?: string;
  so_dien_thoai?: string;
}

interface CheckContributionEligibilityBody {
  personnel_ids?: string[];
}

class PersonnelController {
  getPersonnel = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetPersonnelQuery;
    const user = req.user!;
    const { page, limit } = parsePagination(query);
    const { search, unit_id } = query;
    const userRole = user.role;
    const userQuanNhanId = user.quan_nhan_id;
    const { personnel, pagination } = await personnelService.getPersonnel(
      page,
      limit,
      userRole,
      userQuanNhanId,
      { search, unit_id }
    );
    return ResponseHelper.paginated(res, {
      data: personnel,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      message: 'Lấy danh sách quân nhân thành công',
    });
  });

  getPersonnelById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user!;
    const { id } = params;
    if (!id) return ResponseHelper.badRequest(res, 'ID quân nhân không hợp lệ');
    const userRole = user.role;
    const userQuanNhanId = user.quan_nhan_id;
    const result = await personnelService.getPersonnelById(id, userRole, userQuanNhanId);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy thông tin quân nhân thành công',
    });
  });

  createPersonnel = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CreatePersonnelBody;
    const { cccd, unit_id, position_id, role } = body;
    if (!cccd || !unit_id || !position_id) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin: CCCD, đơn vị và chức vụ'
      );
    }
    const result = await personnelService.createPersonnel({ cccd, unit_id, position_id, role });
    return ResponseHelper.created(res, {
      data: result,
      message: `Thêm quân nhân và tạo tài khoản thành công. Username: ${cccd}, Password: mật khẩu mặc định`,
    });
  });

  updatePersonnel = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const user = req.user!;
    const body = req.body as UpdatePersonnelBody;
    const personnelId = params.id;
    if (Array.isArray(personnelId)) {
      return ResponseHelper.badRequest(res, 'ID quân nhân không hợp lệ');
    }
    const {
      unit_id,
      position_id,
      don_vi_id,
      chuc_vu_id,
      co_quan_don_vi_id,
      don_vi_truc_thuoc_id,
      ho_ten,
      gioi_tinh,
      ngay_sinh,
      cccd,
      cap_bac,
      ngay_nhap_ngu,
      ngay_xuat_ngu,
      que_quan_2_cap,
      que_quan_3_cap,
      tru_quan,
      cho_o_hien_nay,
      ngay_vao_dang,
      ngay_vao_dang_chinh_thuc,
      so_the_dang_vien,
      so_dien_thoai,
    } = body;
    const userRole = user.role;
    const userQuanNhanId = user.quan_nhan_id;

    const result = await personnelService.updatePersonnel(
      personnelId,
      {
        co_quan_don_vi_id: co_quan_don_vi_id || don_vi_id || unit_id,
        don_vi_truc_thuoc_id,
        position_id: chuc_vu_id || position_id,
        ho_ten,
        gioi_tinh,
        ngay_sinh,
        cccd,
        cap_bac,
        ngay_nhap_ngu,
        ngay_xuat_ngu,
        que_quan_2_cap,
        que_quan_3_cap,
        tru_quan,
        cho_o_hien_nay,
        ngay_vao_dang,
        ngay_vao_dang_chinh_thuc,
        so_the_dang_vien,
        so_dien_thoai,
      },
      userRole,
      userQuanNhanId,
      user.username
    );
    return ResponseHelper.success(res, { data: result, message: 'Cập nhật quân nhân thành công' });
  });

  deletePersonnel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const params = req.params as IdParams;
    const { id } = params;
    if (!id) return ResponseHelper.badRequest(res, 'ID quân nhân không hợp lệ');
    const userRole = user.role;
    const userQuanNhanId = user.quan_nhan_id;
    const result = await personnelService.deletePersonnel(id, userRole, userQuanNhanId);
    return ResponseHelper.success(res, { data: result, message: 'Xóa quân nhân thành công' });
  });

  exportPersonnel = catchAsync(async (req: Request, res: Response) => {
    const buffer = await personnelService.exportPersonnel();
    const fileName = `quan_nhan_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  checkContributionEligibility = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CheckContributionEligibilityBody;
    const { personnel_ids: personnelIds } = body;
    if (!personnelIds || !Array.isArray(personnelIds)) {
      return ResponseHelper.badRequest(res, 'Danh sách quân nhân không hợp lệ');
    }
    const result = await personnelService.checkContributionEligibility(personnelIds);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Kiểm tra tính đủ điều kiện thành công',
    });
  });
}

export default new PersonnelController();
