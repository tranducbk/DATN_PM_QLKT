const accountService = require('../services/account.service');
const { ROLES } = require('../constants/roles');

class AccountController {
  /**
   * GET /api/accounts
   * Lấy danh sách tài khoản (có phân trang)
   */
  async getAccounts(req, res) {
    try {
      const { page = 1, limit = 10, search = '', role } = req.query;
      const userRole = req.user?.role;

      // Nếu là ADMIN, chỉ cho phép xem MANAGER và USER
      let roleFilter = role;
      if (userRole === ROLES.ADMIN) {
        // Nếu có role filter, kiểm tra xem có hợp lệ không
        if (role && !['MANAGER', 'USER'].includes(role)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN chỉ có thể quản lý tài khoản MANAGER và USER',
          });
        }
        // Nếu không có role filter, set default là MANAGER,USER
        roleFilter = role || 'MANAGER,USER';
      }

      // Nếu là SUPER_ADMIN, exclude SUPER_ADMIN khỏi danh sách
      const excludeSuperAdmin = userRole === ROLES.SUPER_ADMIN;

      const result = await accountService.getAccounts(
        page,
        limit,
        search,
        roleFilter,
        excludeSuperAdmin
      );

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách tài khoản thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get accounts error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách tài khoản thất bại',
      });
    }
  }

  /**
   * GET /api/accounts/:id
   * Lấy chi tiết 1 tài khoản
   */
  async getAccountById(req, res) {
    try {
      const { id } = req.params;
      const result = await accountService.getAccountById(id); // UUID string

      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết tài khoản thành công',
        data: result,
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message || 'Không tìm thấy tài khoản',
      });
    }
  }

  /**
   * POST /api/accounts
   * Tạo tài khoản mới
   */
  async createAccount(req, res) {
    try {
      const {
        personnel_id,
        username,
        password,
        role,
        co_quan_don_vi_id,
        don_vi_truc_thuoc_id,
        chuc_vu_id,
      } = req.body;
      const userRole = req.user?.role;

      // Validate input
      if (!username || !password || !role) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin: username, password, role',
        });
      }

      // Validate role based on user's role
      let validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'];
      if (userRole === ROLES.ADMIN) {
        // ADMIN chỉ có thể tạo MANAGER hoặc USER
        validRoles = ['MANAGER', 'USER'];
        if (!validRoles.includes(role)) {
          return res.status(403).json({
            success: false,
            message: 'ADMIN chỉ có thể tạo tài khoản MANAGER và USER',
          });
        }
      } else {
        // SUPER_ADMIN có thể tạo tất cả
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            success: false,
            message: 'Vai trò không hợp lệ. Vai trò hợp lệ: ' + validRoles.join(', '),
          });
        }
      }

      // Validation theo role
      if (role === ROLES.MANAGER) {
        // MANAGER: Bắt buộc có co_quan_don_vi_id và chuc_vu_id, KHÔNG có don_vi_truc_thuoc_id
        if (!co_quan_don_vi_id || !chuc_vu_id) {
          return res.status(400).json({
            success: false,
            message: 'Vui lòng chọn Cơ quan đơn vị và Chức vụ cho tài khoản MANAGER',
          });
        }
        if (don_vi_truc_thuoc_id) {
          return res.status(400).json({
            success: false,
            message:
              'Tài khoản MANAGER chỉ được chọn Cơ quan đơn vị, không được chọn Đơn vị trực thuộc',
          });
        }
      } else if (role === ROLES.USER) {
        // USER: Bắt buộc có CẢ HAI co_quan_don_vi_id VÀ don_vi_truc_thuoc_id VÀ chuc_vu_id
        if (!co_quan_don_vi_id || !don_vi_truc_thuoc_id || !chuc_vu_id) {
          return res.status(400).json({
            success: false,
            message:
              'Vui lòng chọn đầy đủ Cơ quan đơn vị, Đơn vị trực thuộc và Chức vụ cho tài khoản USER',
          });
        }
      }

      const result = await accountService.createAccount({
        personnel_id,
        username,
        password,
        role,
        co_quan_don_vi_id: co_quan_don_vi_id || undefined, // UUID string
        don_vi_truc_thuoc_id: don_vi_truc_thuoc_id || undefined, // UUID string
        chuc_vu_id: chuc_vu_id || undefined, // UUID string
      });

      return res.status(201).json({
        success: true,
        message: 'Tạo tài khoản thành công',
        data: result,
      });
    } catch (error) {
      console.error('Create account error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Tạo tài khoản thất bại',
      });
    }
  }

  /**
   * PUT /api/accounts/:id
   * Cập nhật tài khoản (đổi vai trò)
   */
  async updateAccount(req, res) {
    try {
      const { id } = req.params;
      const { role, password } = req.body;
      const userRole = req.user?.role;

      // Phải có ít nhất role hoặc password để cập nhật
      if (!role && !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp vai trò hoặc mật khẩu mới',
        });
      }

      const updateData = {};

      // Xử lý role nếu có
      if (role) {
        // Validate role based on user's role
        let validRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'];
        if (userRole === ROLES.ADMIN) {
          // ADMIN chỉ có thể cập nhật MANAGER hoặc USER
          validRoles = ['MANAGER', 'USER'];
          if (!validRoles.includes(role)) {
            return res.status(403).json({
              success: false,
              message: 'ADMIN chỉ có thể cập nhật tài khoản thành MANAGER hoặc USER',
            });
          }

          // Kiểm tra xem tài khoản hiện tại có phải là MANAGER hoặc USER không
          const existingAccount = await accountService.getAccountById(id);
          if (!['MANAGER', 'USER'].includes(existingAccount.role)) {
            return res.status(403).json({
              success: false,
              message: 'ADMIN chỉ có thể quản lý tài khoản MANAGER và USER',
            });
          }
        } else {
          // SUPER_ADMIN có thể cập nhật tất cả
          if (!validRoles.includes(role)) {
            return res.status(400).json({
              success: false,
              message: 'Vai trò không hợp lệ. Vai trò hợp lệ: ' + validRoles.join(', '),
            });
          }
        }
        updateData.role = role;
      }

      // Xử lý password nếu có
      if (password) {
        // Chỉ SUPER_ADMIN mới có thể đặt lại mật khẩu
        if (userRole !== ROLES.SUPER_ADMIN) {
          return res.status(403).json({
            success: false,
            message: 'Chỉ SUPER_ADMIN mới có thể đặt lại mật khẩu',
          });
        }

        // Validate password length
        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            message: 'Mật khẩu phải có ít nhất 6 ký tự',
          });
        }

        updateData.password = password;
      }

      const result = await accountService.updateAccount(id, updateData);

      return res.status(200).json({
        success: true,
        message: 'Cập nhật tài khoản thành công',
        data: result,
      });
    } catch (error) {
      console.error('Update account error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật tài khoản thất bại',
      });
    }
  }

  /**
   * POST /api/accounts/reset-password
   * Đặt lại mật khẩu cho tài khoản
   */
  async resetPassword(req, res) {
    try {
      const { account_id } = req.body;

      if (!account_id) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp account_id',
        });
      }

      const result = await accountService.resetPassword(account_id);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Đặt lại mật khẩu thất bại',
      });
    }
  }

  /**
   * DELETE /api/accounts/:id?force=true
   * Xóa tài khoản và toàn bộ dữ liệu liên quan
   * Query params:
   *   - force: true/false - Bắt buộc xóa ngay cả khi có đề xuất PENDING
   */
  async deleteAccount(req, res) {
    try {
      const { id } = req.params;
      const { force } = req.query;

      const forceDelete = force === 'true' || force === '1';

      const result = await accountService.deleteAccount(id, forceDelete);

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      console.error('Delete account error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa tài khoản thất bại',
      });
    }
  }
}

module.exports = new AccountController();
