const positionHistoryService = require('../services/positionHistory.service');
const profileService = require('../services/profile.service');

class PositionHistoryController {
  async getPositionHistory(req, res) {
    try {
      const { personnel_id, recalculate } = req.query;

      if (!personnel_id) {
        return res.status(400).json({
          success: false,
          message: 'Tham số personnel_id là bắt buộc',
        });
      }

      // Nếu có tham số recalculate=true, tính toán lại hồ sơ cống hiến
      if (recalculate === 'true') {
        try {
          await profileService.recalculateContributionProfile(personnel_id);
        } catch (recalcError) {
          // Không throw error, tiếp tục lấy dữ liệu
        }
      }

      const result = await positionHistoryService.getPositionHistory(personnel_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy lịch sử chức vụ thành công',
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

  async createPositionHistory(req, res) {
    try {
      // personnel_id lấy từ URL params (nested route: /api/personnel/:personnelId/position-history)
      const personnel_id = req.params.personnelId || req.body.personnel_id;
      const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc } = req.body;

      if (!personnel_id || !chuc_vu_id || !ngay_bat_dau) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ: personnel_id, chuc_vu_id, ngay_bat_dau',
        });
      }

      const result = await positionHistoryService.createPositionHistory({
        personnel_id,
        chuc_vu_id,
        ngay_bat_dau,
        ngay_ket_thuc,
      });

      // Tự động cập nhật lại hồ sơ sau khi thêm lịch sử chức vụ
      try {
        await profileService.recalculateAnnualProfile(personnel_id);
      } catch (recalcError) {
        // Silent fail - không ảnh hưởng đến response
      }

      return res.status(201).json({
        success: true,
        message: 'Thêm lịch sử chức vụ thành công',
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

  async updatePositionHistory(req, res) {
    try {
      const { id } = req.params;
      const { chuc_vu_id, ngay_bat_dau, ngay_ket_thuc } = req.body;

      const result = await positionHistoryService.updatePositionHistory(id, {
        chuc_vu_id,
        ngay_bat_dau,
        ngay_ket_thuc,
      });

      // Tự động cập nhật lại hồ sơ sau khi cập nhật lịch sử chức vụ
      try {
        const personnelId = result.data?.quan_nhan_id || result.quan_nhan_id;
        await profileService.recalculateAnnualProfile(personnelId);
      } catch (recalcError) {
        // Silent fail - không ảnh hưởng đến response
      }

      // Trả về response với warning nếu có
      const response = {
        success: true,
        message: 'Cập nhật lịch sử chức vụ thành công',
        data: result.data || result,
      };

      if (result.warning) {
        response.warning = result.warning;
      }

      return res.status(200).json(response);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  async deletePositionHistory(req, res) {
    try {
      const { id } = req.params;

      const result = await positionHistoryService.deletePositionHistory(id);

      // Tự động cập nhật lại hồ sơ sau khi xóa lịch sử chức vụ
      if (result.personnelId) {
        try {
          await profileService.recalculateAnnualProfile(result.personnelId);
        } catch (recalcError) {
          // Silent fail - không ảnh hưởng đến response
        }
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          id,
          QuanNhan: result.QuanNhan,
          ChucVu: result.ChucVu,
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
}

module.exports = new PositionHistoryController();
