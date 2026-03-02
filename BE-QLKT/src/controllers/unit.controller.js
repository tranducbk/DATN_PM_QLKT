const unitService = require('../services/unit.service');

class UnitController {
  /**
   * GET /api/units
   * Lấy tất cả cơ quan đơn vị và đơn vị trực thuộc
   * Query params: ?hierarchy=true để lấy theo cấu trúc cây
   */
  async getAllUnits(req, res) {
    try {
      const includeHierarchy = req.query.hierarchy === 'true';
      const result = await unitService.getAllUnits(includeHierarchy);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách cơ quan đơn vị và đơn vị trực thuộc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get units error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách cơ quan đơn vị và đơn vị trực thuộc thất bại',
      });
    }
  }

  /**
   * POST /api/units
   * Tạo cơ quan đơn vị mới hoặc đơn vị trực thuộc (nếu có co_quan_don_vi_id)
   */
  async createUnit(req, res) {
    try {
      const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = req.body;

      // Validate input
      if (!ma_don_vi || !ten_don_vi) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin: ma_don_vi, ten_don_vi',
        });
      }

      const result = await unitService.createUnit({
        ma_don_vi,
        ten_don_vi,
        co_quan_don_vi_id,
      });

      return res.status(201).json({
        success: true,
        message: 'Tạo cơ quan đơn vị/đơn vị trực thuộc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Create unit error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Tạo cơ quan đơn vị/đơn vị trực thuộc thất bại',
      });
    }
  }

  /**
   * PUT /api/units/:id
   * Sửa cơ quan đơn vị hoặc đơn vị trực thuộc (mã, tên, co_quan_don_vi_id)
   */
  async updateUnit(req, res) {
    try {
      const { id } = req.params;
      const { ma_don_vi, ten_don_vi, co_quan_don_vi_id } = req.body;

      if (!ma_don_vi && !ten_don_vi && co_quan_don_vi_id === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp thông tin cần cập nhật',
        });
      }

      const result = await unitService.updateUnit(id, {
        ma_don_vi,
        ten_don_vi,
        co_quan_don_vi_id,
      });

      return res.status(200).json({
        success: true,
        message: 'Cập nhật cơ quan đơn vị/đơn vị trực thuộc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Update unit error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật cơ quan đơn vị/đơn vị trực thuộc thất bại',
      });
    }
  }

  /**
   * GET /api/sub-units
   * Lấy tất cả đơn vị trực thuộc
   * Query params: ?co_quan_don_vi_id=xxx để lọc theo cơ quan đơn vị
   */
  async getAllSubUnits(req, res) {
    try {
      const { co_quan_don_vi_id } = req.query;
      const result = await unitService.getAllSubUnits(co_quan_don_vi_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách đơn vị trực thuộc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get sub units error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách đơn vị trực thuộc thất bại',
      });
    }
  }

  /**
   * GET /api/units/:id
   * Lấy chi tiết cơ quan đơn vị hoặc đơn vị trực thuộc với cấu trúc cây
   */
  async getUnitById(req, res) {
    try {
      const { id } = req.params;
      const result = await unitService.getUnitById(id);

      return res.status(200).json({
        success: true,
        message: 'Lấy thông tin cơ quan đơn vị/đơn vị trực thuộc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get unit by id error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Không tìm thấy cơ quan đơn vị hoặc đơn vị trực thuộc',
      });
    }
  }

  /**
   * DELETE /api/units/:id
   * Xóa cơ quan đơn vị hoặc đơn vị trực thuộc
   */
  async deleteUnit(req, res) {
    try {
      const { id } = req.params;

      const result = await unitService.deleteUnit(id);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Delete unit error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa cơ quan đơn vị/đơn vị trực thuộc thất bại',
      });
    }
  }

  /**
   * GET /api/units/my-units
   * Lấy đơn vị của Manager và các đơn vị con
   * Access: MANAGER
   */
  async getMyUnits(req, res) {
    try {
      const userQuanNhanId = req.user.quan_nhan_id;

      if (!userQuanNhanId) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy thông tin quân nhân của tài khoản',
        });
      }

      const result = await unitService.getManagerUnits(userQuanNhanId);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách đơn vị thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get my units error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách đơn vị thất bại',
      });
    }
  }
}

module.exports = new UnitController();
