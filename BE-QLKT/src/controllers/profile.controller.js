const profileService = require('../services/profile.service');

class ProfileController {
  /**
   * GET /api/profiles/annual/:personnel_id
   * Lấy hồ sơ đề xuất khen thưởng hằng năm (CSTT, CSTDCS, BKBQP, CSTDTQ)
   * Query params: ?year=2025 (nếu có năm, tự động recalculate trước khi trả về)
   */
  async getAnnualProfile(req, res) {
    try {
      const { personnel_id } = req.params;
      const { year } = req.query;
      const yearNumber = year ? parseInt(year, 10) : null;

      // Nếu có năm, tự động tính toán lại hồ sơ với năm đó trước khi lấy
      if (yearNumber) {
        await profileService.recalculateAnnualProfile(personnel_id, yearNumber);
      }

      const result = await profileService.getAnnualProfile(personnel_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy hồ sơ hằng năm thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get annual profile error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy hồ sơ hằng năm thất bại',
      });
    }
  }

  /**
   * GET /api/profiles/tenure/:personnel_id
   * Lấy hồ sơ đề xuất Huy chương Chiến sĩ Vẻ vang (HCCSVV) theo niên hạn
   * Tự động tính toán khi gọi API
   */
  async getTenureProfile(req, res) {
    try {
      const { personnel_id } = req.params;

      // Tự động recalculate khi lấy hồ sơ niên hạn
      await profileService.recalculateTenureProfile(personnel_id);
      const result = await profileService.getTenureProfile(personnel_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy hồ sơ Huy chương Chiến sĩ vẻ vang thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get tenure profile error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy hồ sơ Huy chương Chiến sĩ vẻ vang thất bại',
      });
    }
  }

  /**
   * GET /api/profiles/contribution/:personnel_id
   * Lấy hồ sơ đề xuất Huân chương Bảo vệ Tổ quốc (HCBVTQ) theo cống hiến
   * Tự động tính toán khi gọi API
   */
  async getContributionProfile(req, res) {
    try {
      const { personnel_id } = req.params;

      // Tự động recalculate khi lấy hồ sơ cống hiến
      await profileService.recalculateContributionProfile(personnel_id);
      const result = await profileService.getContributionProfile(personnel_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy hồ sơ Huân chương Bảo vệ Tổ quốc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get contribution profile error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy hồ sơ Huân chương Bảo vệ Tổ quốc thất bại',
      });
    }
  }

  /**
   * POST /api/profiles/recalculate/:personnel_id
   * Tính toán lại hồ sơ cho 1 quân nhân
   * Query params: ?year=2025 (optional, mặc định là năm hiện tại)
   */
  async recalculateProfile(req, res) {
    try {
      const { personnel_id } = req.params;
      const { year } = req.query; // Lấy năm từ query params
      const yearNumber = year ? parseInt(year, 10) : null;

      const result = await profileService.recalculateAnnualProfile(personnel_id, yearNumber);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Recalculate profile error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tính toán lại hồ sơ thất bại',
      });
    }
  }

  /**
   * POST /api/profiles/recalculate-all
   * Tính toán lại cho toàn bộ quân nhân
   */
  async recalculateAll(req, res) {
    try {
      const result = await profileService.recalculateAll();

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          success: result.success,
          errors: result.errors,
        },
      });
    } catch (error) {
      console.error('Recalculate all profiles error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tính toán lại toàn bộ hồ sơ thất bại',
      });
    }
  }

  /**
   * GET /api/profiles/tenure
   * Lấy danh sách tất cả hồ sơ niên hạn (cho admin)
   */
  async getAllTenureProfiles(req, res) {
    try {
      const result = await profileService.getAllTenureProfiles();

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách hồ sơ Huy chương Chiến sĩ vẻ vang thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get all tenure profiles error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách hồ sơ Huy chương Chiến sĩ vẻ vang thất bại',
      });
    }
  }

  /**
   * PUT /api/profiles/tenure/:personnel_id
   * Cập nhật trạng thái hồ sơ niên hạn (ADMIN duyệt huân chương)
   */
  async updateTenureProfile(req, res) {
    try {
      const { personnel_id } = req.params;
      const updates = req.body;

      const result = await profileService.updateTenureProfile(personnel_id, updates);

      return res.status(200).json({
        success: true,
        message: 'Cập nhật hồ sơ Huy chương Chiến sĩ vẻ vang thành công',
        data: result,
      });
    } catch (error) {
      console.error('Update tenure profile error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Cập nhật hồ sơ Huy chương Chiến sĩ vẻ vang thất bại',
      });
    }
  }
}

module.exports = new ProfileController();
