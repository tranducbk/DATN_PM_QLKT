const positionService = require('../services/position.service');

class PositionController {
  /**
   * GET /api/positions?unit_id={id}&include_children=true
   * Lấy chức vụ (lọc theo đơn vị, nếu không có unit_id thì trả về tất cả)
   * include_children=true: Lấy cả chức vụ của đơn vị con
   */
  async getPositions(req, res) {
    try {
      const { unit_id, include_children } = req.query;
      const includeChildren = include_children === 'true';

      const result = await positionService.getPositions(unit_id, includeChildren);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách chức vụ thành công',
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
   * POST /api/positions
   * Tạo chức vụ mới
   */
  async createPosition(req, res) {
    try {
      const { unit_id, ten_chuc_vu, is_manager, he_so_chuc_vu } = req.body;

      // Validate input
      if (!unit_id || !ten_chuc_vu) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin: unit_id, ten_chuc_vu',
        });
      }

      const result = await positionService.createPosition({
        unit_id,
        ten_chuc_vu,
        is_manager,
        he_so_chuc_vu,
      });

      return res.status(201).json({
        success: true,
        message: 'Tạo chức vụ thành công',
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
   * PUT /api/positions/:id
   * Sửa chức vụ
   */
  async updatePosition(req, res) {
    try {
      const { id } = req.params;
      const { ten_chuc_vu, is_manager, he_so_chuc_vu } = req.body;

      const result = await positionService.updatePosition(id, {
        ten_chuc_vu,
        is_manager,
        he_so_chuc_vu,
      });

      return res.status(200).json({
        success: true,
        message: 'Cập nhật chức vụ thành công',
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
   * DELETE /api/positions/:id
   * Xóa chức vụ
   */
  async deletePosition(req, res) {
    try {
      const { id } = req.params;

      const result = await positionService.deletePosition(id);

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          id,
          ten_chuc_vu: result.ten_chuc_vu,
          CoQuanDonVi: result.CoQuanDonVi,
          DonViTrucThuoc: result.DonViTrucThuoc,
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

module.exports = new PositionController();
