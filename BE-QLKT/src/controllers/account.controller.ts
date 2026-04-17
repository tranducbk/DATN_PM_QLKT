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
}

interface ResetPasswordBody {
  account_id?: string;
}

const ALL_ROLES = Object.values(ROLES);
const ADMIN_MANAGED_ROLES: Role[] = [ROLES.MANAGER, ROLES.USER];

class AccountController {
  getAccounts = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAccountsQuery;
    const user = req.user;
    const { page, limit } = parsePagination(query);
    const { search = '', role } = query;
    const userRole = user?.role;

    let roleFilter = role as string | undefined;
    if (userRole === ROLES.ADMIN) {
      if (role && !ADMIN_MANAGED_ROLES.includes(role as Role)) {
        return ResponseHelper.forbidden(res, 'ADMIN chỉ có thể quản lý tài khoản MANAGER và USER');
      }
      roleFilter = (role as string) || ADMIN_MANAGED_ROLES.join(',');
    }

    const excludeSuperAdmin = userRole === ROLES.SUPER_ADMIN;
    const result = await accountService.getAccounts(
      page,
      limit,
      String(search ?? ''),
      roleFilter,
      excludeSuperAdmin
    );

    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy danh sách tài khoản thành công',
    });
  });

  getAccountById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const { id } = params;
    const result = await accountService.getAccountById(id);
    return ResponseHelper.success(res, {
      data: result,
      message: 'Lấy chi tiết tài khoản thành công',
    });
  });

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

  updateAccount = catchAsync(async (req: Request, res: Response) => {
    const user = req.user;
    const params = req.params as IdParams;
    const query = req.query as UpdateAccountQuery;
    const body = req.body as UpdateAccountBody;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id tài khoản');
    }
    const { role, password } = body;
    const userRole = user?.role;

    if (!role && !password) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp vai trò hoặc mật khẩu mới');
    }

    const updateData: Record<string, unknown> = {};

    if (role) {
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

      if (userRole === ROLES.ADMIN) {
        const existingAccount = await accountService.getAccountById(id);
        if (!ADMIN_MANAGED_ROLES.includes(String(existingAccount.role) as Role)) {
          return ResponseHelper.forbidden(
            res,
            'ADMIN chỉ có thể quản lý tài khoản MANAGER và USER'
          );
        }
      }
      updateData.role = role;
    }

    if (password) {
      if (userRole !== ROLES.SUPER_ADMIN) {
        return ResponseHelper.forbidden(res, 'Chỉ SUPER_ADMIN mới có thể đặt lại mật khẩu');
      }
      updateData.password = password;
    }

    const result = await accountService.updateAccount(id, updateData);
    return ResponseHelper.success(res, { data: result, message: 'Cập nhật tài khoản thành công' });
  });

  resetPassword = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as ResetPasswordBody;
    const { account_id } = body;
    if (!account_id) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp thông tin tài khoản');
    }
    const result = await accountService.resetPassword(account_id);
    return ResponseHelper.success(res, { message: result.message });
  });

  deleteAccount = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const query = req.query as UpdateAccountQuery;
    const id = normalizeParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'Thiếu id tài khoản');
    }
    const forceDelete = query.force === 'true' || query.force === '1';
    const result = await accountService.deleteAccount(id, forceDelete);
    return ResponseHelper.success(res, { data: result, message: result.message });
  });
}

export default new AccountController();
