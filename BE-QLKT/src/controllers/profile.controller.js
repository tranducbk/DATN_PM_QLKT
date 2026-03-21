const profileService = require('../services/profile.service');
const unitAnnualAwardService = require('../services/unitAnnualAward.service');

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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  /**
   * POST /api/profiles/check-eligibility
   * Kiểm tra điều kiện khen thưởng chuỗi cho 1 hoặc nhiều quân nhân
   * Body: { items: [{ personnel_id, nam, danh_hieu }] }
   */
  async checkEligibility(req, res) {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Thiếu danh sách cần kiểm tra' });
      }

      const results = [];
      for (const item of items) {
        let result;
        if (item.type === 'DON_VI' && item.don_vi_id) {
          // Check đơn vị
          result = await unitAnnualAwardService.checkUnitAwardEligibility(
            item.don_vi_id,
            item.nam,
            item.danh_hieu
          );
          results.push({
            don_vi_id: item.don_vi_id,
            nam: item.nam,
            danh_hieu: item.danh_hieu,
            type: 'DON_VI',
            ...result,
          });
        } else {
          // Check cá nhân (mặc định)
          result = await profileService.checkAwardEligibility(
            item.personnel_id,
            item.nam,
            item.danh_hieu
          );
          results.push({
            personnel_id: item.personnel_id,
            nam: item.nam,
            danh_hieu: item.danh_hieu,
            type: 'CA_NHAN',
            ...result,
          });
        }
      }

      return res.json({ success: true, data: results });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
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
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }
}

module.exports = new ProfileController();
