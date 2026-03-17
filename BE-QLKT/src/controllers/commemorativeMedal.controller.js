const commemorativeMedalService = require('../services/commemorativeMedal.service');
const { ROLES } = require('../constants/roles');

class CommemorativeMedalController {
  /**
   * GET /api/commemorative-medals/template
   * Tải file mẫu Excel để import Kỷ niệm chương
   */
  async getTemplate(req, res) {
    try {
      const userRole = req.user?.role || 'MANAGER';
      const buffer = await commemorativeMedalService.exportTemplate(userRole);

      const fileName = `mau_import_knc_vsnxd_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Get commemorative medals template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tải file mẫu thất bại',
      });
    }
  }

  /**
   * POST /api/commemorative-medals/import
   * Import Kỷ niệm chương từ file Excel
   */
  async importFromExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await commemorativeMedalService.importFromExcel(req.file.buffer, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Import Kỷ niệm chương thành công',
        data: result,
      });
    } catch (error) {
      console.error('Import commemorative medals error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Import thất bại',
      });
    }
  }

  /**
   * GET /api/commemorative-medals
   * Lấy danh sách Kỷ niệm chương
   */
  async getAll(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, ho_ten, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (ho_ten) filters.ho_ten = ho_ten;

      if (userRole === ROLES.MANAGER) {
        const userQuanNhanId = req.user?.quan_nhan_id;
        if (!userQuanNhanId) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin quân nhân',
          });
        }
        const { prisma } = require('../models');
        const managerPersonnel = await prisma.quanNhan.findUnique({
          where: { id: userQuanNhanId },
          select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
        });
        if (!managerPersonnel) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        if (managerPersonnel.co_quan_don_vi_id) {
          filters.don_vi_id = managerPersonnel.co_quan_don_vi_id;
          filters.include_sub_units = true;
        } else if (managerPersonnel.don_vi_truc_thuoc_id) {
          filters.don_vi_id = managerPersonnel.don_vi_truc_thuoc_id;
        }
      }

      const result = await commemorativeMedalService.getAll(filters, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách Kỷ niệm chương thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get all commemorative medals error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách thất bại',
      });
    }
  }

  /**
   * GET /api/commemorative-medals/export
   * Xuất file Excel Kỷ niệm chương
   */
  async exportToExcel(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;

      if (userRole === ROLES.MANAGER) {
        const user = await commemorativeMedalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
      }

      const buffer = await commemorativeMedalService.exportToExcel(filters);

      const fileName = `danh_sach_knc_vsnxd_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export commemorative medals Excel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file Excel thất bại',
      });
    }
  }

  /**
   * GET /api/commemorative-medals/statistics
   * Thống kê Kỷ niệm chương
   */
  async getStatistics(req, res) {
    try {
      const statistics = await commemorativeMedalService.getStatistics();

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê Kỷ niệm chương thành công',
        data: statistics,
      });
    } catch (error) {
      console.error('Get commemorative medals statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy thống kê thất bại',
      });
    }
  }

  /**
   * GET /api/commemorative-medals/personnel/:personnel_id
   * Lấy Kỷ niệm chương theo personnel_id
   */
  async getByPersonnelId(req, res) {
    try {
      const { personnel_id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      const userPersonnelId = req.user.quan_nhan_id;

      // Nếu là USER, chỉ cho phép xem của chính mình
      if (userRole === ROLES.USER && userPersonnelId !== personnel_id) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ có thể xem thông tin của mình',
        });
      }

      // Nếu là MANAGER, kiểm tra personnel có thuộc đơn vị của mình không
      if (userRole === ROLES.MANAGER) {
        const user = await commemorativeMedalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        const managerUnitId = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;

        // Lấy thông tin personnel để kiểm tra đơn vị
        const personnel = await commemorativeMedalService.getPersonnelById(personnel_id);
        if (!personnel) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy thông tin quân nhân',
          });
        }

        const personnelUnitId = personnel.co_quan_don_vi_id || personnel.don_vi_truc_thuoc_id;
        if (personnelUnitId !== managerUnitId) {
          return res.status(403).json({
            success: false,
            message: 'Bạn chỉ có thể xem thông tin của đơn vị mình',
          });
        }
      }

      const result = await commemorativeMedalService.getByPersonnelId(personnel_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy Kỷ niệm chương theo personnel_id thành công',
        data: {
          hasReceived: result.length > 0,
          data: result,
        },
      });
    } catch (error) {
      console.error('Get commemorative medal by personnel id error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy dữ liệu thất bại',
      });
    }
  }

  /**
   * DELETE /api/commemorative-medals/:id
   * Xóa khen thưởng KNC VSNXD (không xóa đề xuất)
   */
  async deleteAward(req, res) {
    try {
      const { id } = req.params;
      const adminUsername = req.user?.username || 'Admin';
      const result = await commemorativeMedalService.deleteAward(id, adminUsername);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Delete commemorative medal error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa khen thưởng thất bại',
      });
    }
  }
}

module.exports = new CommemorativeMedalController();
