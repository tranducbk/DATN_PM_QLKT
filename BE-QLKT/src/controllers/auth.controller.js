const authService = require('../services/auth.service');

class AuthController {
  /**
   * POST /api/auth/login
   * Đăng nhập hệ thống
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu',
        });
      }

      const result = await authService.login(username, password);

      return res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công',
        data: result,
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(401).json({
        success: false,
        message: error.message || 'Đăng nhập thất bại',
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Lấy access token mới khi hết hạn
   */
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token không được cung cấp',
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Làm mới token thành công',
        data: result,
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      return res.status(401).json({
        success: false,
        message: error.message || 'Làm mới token thất bại',
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Đăng xuất (vô hiệu hóa refresh token)
   */
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token không được cung cấp',
        });
      }

      const result = await authService.logout(refreshToken);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Đăng xuất thất bại',
      });
    }
  }

  /**
   * POST /api/auth/change-password
   * Tự đổi mật khẩu (khi đã đăng nhập)
   */
  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.id; // Lấy từ token đã verify

      // Validate input
      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới',
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới phải có ít nhất 6 ký tự',
        });
      }

      const result = await authService.changePassword(userId, oldPassword, newPassword);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Đổi mật khẩu thất bại',
      });
    }
  }
}

module.exports = new AuthController();
