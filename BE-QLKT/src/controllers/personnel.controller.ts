import { Request, Response } from 'express';
import personnelService from '../services/personnel.service';
import { parsePagination } from '../helpers/paginationHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

class PersonnelController {
  getPersonnel = catchAsync(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const { search, unit_id } = req.query;
    const userRole = req.user!.role;
    const userQuanNhanId = req.user!.quan_nhan_id;
    const result = await personnelService.getPersonnel(page, limit, userRole, userQuanNhanId, {
      search,
      unit_id,
    });
    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy danh sách quân nhân thành công',
    });
  });

  getPersonnelById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return ResponseHelper.badRequest(res, 'ID quân nhân không hợp lệ');
    const userRole = req.user!.role;
    const userQuanNhanId = req.user!.quan_nhan_id;
    const result = await personnelService.getPersonnelById(id, userRole, userQuanNhanId);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy thông tin quân nhân thành công',
    });
  });

  createPersonnel = catchAsync(async (req: Request, res: Response) => {
    const { cccd, unit_id, position_id, role } = req.body;
    if (!cccd || !unit_id || !position_id) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin: cccd, unit_id, position_id'
      );
    }
    const result = await personnelService.createPersonnel({ cccd, unit_id, position_id, role });
    return ResponseHelper.created(res, {
      data: result,
      message: `Thêm quân nhân và tạo tài khoản thành công. Username: ${cccd}, Password: mật khẩu mặc định`,
    });
  });

  updatePersonnel = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
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
    } = req.body;
    const userRole = req.user!.role;
    const userQuanNhanId = req.user!.quan_nhan_id;

    const result = await personnelService.updatePersonnel(
      id,
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
      req.user!.username
    );
    return ResponseHelper.success(res, { data: result, message: 'Cập nhật quân nhân thành công' });
  });

  deletePersonnel = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!id) return ResponseHelper.badRequest(res, 'ID quân nhân không hợp lệ');
    const userRole = req.user!.role;
    const userQuanNhanId = req.user!.quan_nhan_id;
    const result = await personnelService.deletePersonnel(id, userRole, userQuanNhanId);
    return ResponseHelper.success(res, { data: result, message: 'Xóa quân nhân thành công' });
  });

  importPersonnel = catchAsync(async (req: Request, res: Response) => {
    if (!req.file?.buffer) {
      return ResponseHelper.badRequest(
        res,
        'Không tìm thấy file upload. Vui lòng gửi form-data field "file"'
      );
    }
    const result = await personnelService.importFromExcelBuffer(req.file.buffer);
    await writeSystemLog({
      userId: req.user?.id,
      userRole: req.user?.role,
      action: AUDIT_ACTIONS.IMPORT,
      resource: 'personnel',
      description: `Nhập dữ liệu quân nhân: ${result.createdCount} tạo mới, ${result.updatedCount} cập nhật, ${result.errors?.length ?? 0} lỗi`,
      payload: {
        created: result.createdCount,
        updated: result.updatedCount,
        errorCount: result.errors?.length ?? 0,
      },
    });
    return ResponseHelper.success(res, { data: result, message: 'Import quân nhân hoàn tất' });
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

  exportPersonnelSample = catchAsync(async (req: Request, res: Response) => {
    const buffer = await personnelService.exportPersonnelSample();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="mau_quan_nhan.xlsx"`);
    return res.status(200).send(buffer);
  });

  checkContributionEligibility = catchAsync(async (req: Request, res: Response) => {
    const { personnelIds } = req.body;
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
