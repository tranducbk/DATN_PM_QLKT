/*
 * Controller quản lý tài khoản (TaiKhoan) gắn với quân nhân.
 * Bao gồm: CRUD tài khoản, đặt lại mật khẩu.
 * Phân quyền theo vai trò: SUPER_ADMIN > ADMIN > MANAGER > USER.
 * ADMIN chỉ quản lý được MANAGER và USER; chỉ SUPER_ADMIN mới đổi mật khẩu.
 * Controller mỏng: validate cơ bản + dispatch xuống service.
 */

import { Request, Response } from 'express';
import accountService from '../services/account.service';
import { ROLES, Role } from '../constants/roles.constants';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';

interface GetAccountsQuery {
  search?: string;
  role?: string;
  [key: string]: unknown;
}

interface IdParams {
  id?: string;
}

interface CreateAccountBody {
  personnel_id?: string;
  username?: string;
  password?: string;
  role?: Role;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
}

interface UpdateAccountQuery {
  force?: string;
}

interface UpdateAccountBody {
  role?: Role;
  password?: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
}

interface ResetPasswordBody {
  account_id?: string;
}

const ALL_ROLES = Object.values(ROLES);
// Các vai trò mà ADMIN được phép quản lý (không đụng tới SUPER_ADMIN/ADMIN)
const ADMIN_MANAGED_ROLES: Role[] = [ROLES.MANAGER, ROLES.USER];

class AccountController {
  /**
   * Lấy danh sách tài khoản (có phân trang, tìm kiếm, lọc theo vai trò).
   * @returns Danh sách tài khoản kèm thông tin phân trang
   */
  getAccounts = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAccountsQuery;
    const user = req.user;
    const { page, limit } = parsePagination(query);
    const { search = '', role } = query;
    const userRole = user?.role;

    // ADMIN chỉ được xem MANAGER/USER: ép roleFilter về tập vai trò cho phép
    let roleFilter = role as string | undefined;
    if (userRole === ROLES.ADMIN) {
      if (role && !ADMIN_MANAGED_ROLES.includes(role as Role)) {
        return ResponseHelper.forbidden(res, 'ADMIN chỉ có thể quản lý tài khoản MANAGER và USER');
      }
      roleFilter = (role as string) || ADMIN_MANAGED_ROLES.join(',');
    }

    // Chỉ SUPER_ADMIN mới thấy tài khoản SUPER_ADMIN
    const excludeSuperAdmin = userRole !== ROLES.SUPER_ADMIN;
    const result = await accountService.getAccounts(
      page,
      limit,
      String(search ?? ''),
      roleFilter,
      excludeSuperAdmin
    );

    return ResponseHelper.paginated(res, {
      data: result.accounts,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      message: 'Lấy danh sách tài khoản thành công',
    });
  });

  /**
   * Lấy chi tiết một tài khoản theo id.
   * @returns Thông tin tài khoản
   */
  getAccountById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const { id } = params;
    const result = await accountService.getAccountById(id, req.user?.role);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy chi tiết tài khoản thành công',
    });
  });

  /**
   * Tạo tài khoản mới gắn với quân nhân, đơn vị và chức vụ.
   * @returns Tài khoản vừa tạo
   */
  createAccount = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const body = req.body as CreateAccountBody;
    const {
      personnel_id,
      username,
      password,
      role,
      co_quan_don_vi_id,
      don_vi_truc_thuoc_id,
      chuc_vu_id,
    } = body;
    const userRole = user?.role;

    if (!username || !role) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin: tên đăng nhập và vai trò'
      );
    }

    // ADMIN chỉ được tạo MANAGER/USER; SUPER_ADMIN tạo được mọi vai trò
    const validRoles = userRole === ROLES.ADMIN ? ADMIN_MANAGED_ROLES : ALL_ROLES;
    if (!validRoles.includes(role)) {
      if (userRole === ROLES.ADMIN) {
        return ResponseHelper.forbidden(res, 'ADMIN chỉ có thể tạo tài khoản MANAGER và USER');
      }
      return ResponseHelper.badRequest(
        res,
        `Vai trò không hợp lệ. Vai trò hợp lệ: ${validRoles.join(', ')}`
      );
    }

    // MANAGER quản lý cấp Cơ quan đơn vị (đơn vị cha) nên không gán Đơn vị trực thuộc
    if (role === ROLES.MANAGER) {
      if (!co_quan_don_vi_id || !chuc_vu_id) {
        return ResponseHelper.badRequest(
          res,
          'Vui lòng chọn Cơ quan đơn vị và Chức vụ cho tài khoản MANAGER'
        );
      }
      if (don_vi_truc_thuoc_id) {
        return ResponseHelper.badRequest(
          res,
          'Tài khoản MANAGER chỉ được chọn Cơ quan đơn vị, không được chọn Đơn vị trực thuộc'
        );
      }
      // USER thuộc đơn vị con nên phải có đủ cả đơn vị cha lẫn đơn vị trực thuộc
    } else if (role === ROLES.USER) {
      if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id || !chuc_vu_id) {
        return ResponseHelper.badRequest(
          res,
          'Vui lòng chọn đầy đủ Cơ quan đơn vị, Đơn vị trực thuộc và Chức vụ cho tài khoản USER'
        );
      }
    }

    const result = await accountService.createAccount({
      personnel_id,
      username,
      password,
      role,
      co_quan_don_vi_id: co_quan_don_vi_id || undefined,
      don_vi_truc_thuoc_id: don_vi_truc_thuoc_id || undefined,
      chuc_vu_id: chuc_vu_id || undefined,
    });

    return ResponseHelper.created(res, { data: result, message: 'Tạo tài khoản thành công' });
  });

  /**
   * Cập nhật tài khoản: vai trò, mật khẩu, đơn vị, chức vụ.
   * Chỉ áp các field thực sự được gửi lên.
   * @returns Tài khoản sau khi cập nhật
   */
  updateAccount = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const params = req.params as IdParams;
    const body = req.body as UpdateAccountBody;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id tài khoản');
    }
    const { role, password, co_quan_don_vi_id, don_vi_truc_thuoc_id, chuc_vu_id } = body;
    const userRole = user?.role;

    // Từ chối nếu không có field nào cần cập nhật (tránh gọi service vô ích)
    if (
      !role &&
      !password &&
      co_quan_don_vi_id === undefined &&
      don_vi_truc_thuoc_id === undefined &&
      chuc_vu_id === undefined
    ) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp thông tin cần cập nhật');
    }

    const updateData: Record<string, unknown> = {};

    if (role) {
      // ADMIN chỉ được đặt vai trò trong phạm vi MANAGER/USER
      const validRoles = userRole === ROLES.ADMIN ? ADMIN_MANAGED_ROLES : ALL_ROLES;
      if (!validRoles.includes(role)) {
        if (userRole === ROLES.ADMIN) {
          return ResponseHelper.forbidden(
            res,
            'ADMIN chỉ có thể cập nhật tài khoản thành MANAGER hoặc USER'
          );
        }
        return ResponseHelper.badRequest(
          res,
          `Vai trò không hợp lệ. Vai trò hợp lệ: ${validRoles.join(', ')}`
        );
      }

      // ADMIN còn phải kiểm tra vai trò HIỆN TẠI của tài khoản đích nằm trong phạm vi cho phép
      if (userRole === ROLES.ADMIN) {
        const existingAccount = await accountService.getAccountById(id);
        if (!ADMIN_MANAGED_ROLES.includes(String(existingAccount.role) as Role)) {
          return ResponseHelper.forbidden(
            res,
            'ADMIN chỉ có thể quản lý tài khoản MANAGER và USER'
          );
        }
      }

      // Chặn tự hạ quyền: đổi vai trò của chính mình sẽ thu hồi quyền ngay giữa phiên
      if (id === user?.id) {
        const ownAccount = await accountService.getAccountById(id);
        if (String(ownAccount.role) !== role) {
          return ResponseHelper.forbidden(res, 'Bạn không thể thay đổi vai trò của chính mình.');
        }
      }
      updateData.role = role;
    }

    // Đổi mật khẩu trực tiếp chỉ dành cho SUPER_ADMIN
    if (password) {
      if (userRole !== ROLES.SUPER_ADMIN) {
        return ResponseHelper.forbidden(res, 'Chỉ SUPER_ADMIN mới có thể đặt lại mật khẩu');
      }
      updateData.password = password;
    }

    // Chỉ cập nhật đơn vị/chức vụ khi field được gửi lên (cho phép set rỗng tường minh)
    if (co_quan_don_vi_id !== undefined) updateData.co_quan_don_vi_id = co_quan_don_vi_id;
    if (don_vi_truc_thuoc_id !== undefined) updateData.don_vi_truc_thuoc_id = don_vi_truc_thuoc_id;
    if (chuc_vu_id !== undefined) updateData.chuc_vu_id = chuc_vu_id;

    const result = await accountService.updateAccount(id, updateData);
    return ResponseHelper.success(res, { data: result, message: 'Cập nhật tài khoản thành công' });
  });

  /**
   * Đặt lại mật khẩu của một tài khoản về mật khẩu mặc định.
   * @returns Thông báo kết quả
   */
  resetPassword = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as ResetPasswordBody;
    const { account_id } = body;
    if (!account_id) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp thông tin tài khoản');
    }
    const result = await accountService.resetPassword(account_id, req.user?.role);
    return ResponseHelper.success(res, { message: result.message });
  });

  /**
   * Xóa tài khoản; hỗ trợ xóa cưỡng bức qua query `force`.
   * @returns Thông báo kết quả
   */
  deleteAccount = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const query = req.query as UpdateAccountQuery;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id tài khoản');
    }
    // Cho phép truyền force=true hoặc force=1 để xóa bỏ qua ràng buộc
    const forceDelete = query.force === 'true' || query.force === '1';
    const result = await accountService.deleteAccount(id, forceDelete, req.user?.role);
    return ResponseHelper.success(res, { data: result, message: result.message });
  });
}

export default new AccountController();
