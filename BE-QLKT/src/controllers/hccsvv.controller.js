const hccsvvService = require('../services/hccsvv.service');

class HCCSVVController {
  /**
   * GET /api/hccsvv/template
   * Tải file mẫu Excel để import HCCSVV
   */
  async getTemplate(req, res) {
    try {
      const userRole = req.user?.role || 'MANAGER';
      const buffer = await hccsvvService.exportTemplate(userRole);

      const fileName = `mau_import_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Get HCCSVV template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tải file mẫu thất bại',
      });
    }
  }

  /**
   * POST /api/hccsvv/import
   * Import HCCSVV từ file Excel
   */
  async importFromExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await hccsvvService.importFromExcel(req.file.buffer, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Import Huy chương Chiến sĩ Vẻ vang thành công',
        data: result,
      });
    } catch (error) {
      console.error('Import HCCSVV error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Import thất bại',
      });
    }
  }

  /**
   * GET /api/hccsvv
   * Lấy danh sách HCCSVV
   */
  async getAll(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu, ho_ten, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;
      if (ho_ten) filters.ho_ten = ho_ten;

      // Nếu là Manager, chỉ xem khen thưởng đơn vị mình
      if (userRole === 'MANAGER') {
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
          // Manager thuộc cơ quan đơn vị - cần filter theo cơ quan và tất cả đơn vị trực thuộc
          // Service sẽ xử lý logic này qua don_vi_id
          filters.don_vi_id = managerPersonnel.co_quan_don_vi_id;
          filters.include_sub_units = true; // Flag để service biết cần lấy cả đơn vị trực thuộc
        } else if (managerPersonnel.don_vi_truc_thuoc_id) {
          filters.don_vi_id = managerPersonnel.don_vi_truc_thuoc_id;
        }
      }

      const result = await hccsvvService.getAll(filters, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách HCCSVV thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get all HCCSVV error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách thất bại',
      });
    }
  }

  /**
   * GET /api/hccsvv/export
   * Xuất file Excel HCCSVV
   */
  async exportToExcel(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;

      // Nếu là Manager, chỉ xuất khen thưởng đơn vị mình
      if (userRole === 'MANAGER') {
        const user = await hccsvvService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
      }

      const buffer = await hccsvvService.exportToExcel(filters);

      const fileName = `danh_sach_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export HCCSVV Excel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file Excel thất bại',
      });
    }
  }

  /**
   * GET /api/hccsvv/statistics
   * Thống kê HCCSVV theo hạng
   */
  async getStatistics(req, res) {
    try {
      const statistics = await hccsvvService.getStatistics();

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê HCCSVV thành công',
        data: statistics,
      });
    } catch (error) {
      console.error('Get HCCSVV statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy thống kê thất bại',
      });
    }
  }

  /**
   * POST /api/hccsvv
   * Thêm khen thưởng HCCSVV trực tiếp (không cần tính điều kiện)
   */
  async createDirect(req, res) {
    try {
      const { quan_nhan_id, danh_hieu, nam, cap_bac, chuc_vu, so_quyet_dinh, ghi_chu } = req.body;
      const adminUsername = req.user?.username || 'SuperAdmin';

      // Validate required fields
      if (!quan_nhan_id || !danh_hieu || !nam) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc: quan_nhan_id, danh_hieu, nam',
        });
      }

      const result = await hccsvvService.createDirect({
        quan_nhan_id,
        danh_hieu,
        nam: parseInt(nam),
        cap_bac,
        chuc_vu,
        so_quyet_dinh,
        ghi_chu,
      }, adminUsername);

      // Save created ID for audit log
      res.locals.createdId = result.id;

      return res.status(201).json({
        success: true,
        message: 'Thêm khen thưởng HCCSVV thành công',
        data: result,
      });
    } catch (error) {
      console.error('Create HCCSVV direct error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Thêm khen thưởng thất bại',
      });
    }
  }

  /**
   * DELETE /api/hccsvv/:id
   * Xóa khen thưởng HCCSVV (không xóa đề xuất)
   */
  async deleteAward(req, res) {
    try {
      const { id } = req.params;
      const adminUsername = req.user?.username || 'Admin';
      const result = await hccsvvService.deleteAward(id, adminUsername);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Delete HCCSVV award error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa khen thưởng thất bại',
      });
    }
  }
}

module.exports = new HCCSVVController();
