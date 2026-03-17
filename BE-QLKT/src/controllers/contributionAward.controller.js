const contributionAwardService = require('../services/contributionAward.service');
const { ROLES } = require('../constants/roles');

class ContributionAwardController {
  /**
   * GET /api/contribution-awards/template
   * Tải file mẫu Excel để import Huân chương Bảo vệ Tổ quốc
   */
  async getTemplate(req, res) {
    try {
      const userRole = req.user?.role || 'MANAGER';
      const buffer = await contributionAwardService.exportTemplate(userRole);

      const fileName = `mau_import_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Get contribution awards template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tải file mẫu thất bại',
      });
    }
  }

  /**
   * POST /api/contribution-awards/import
   * Import Huân chương Bảo vệ Tổ quốc từ file Excel
   */
  async importFromExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await contributionAwardService.importFromExcel(req.file.buffer, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Import Huân chương Bảo vệ Tổ quốc thành công',
        data: result,
      });
    } catch (error) {
      console.error('Import contribution awards error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Import thất bại',
      });
    }
  }

  /**
   * GET /api/contribution-awards
   * Lấy danh sách Huân chương Bảo vệ Tổ quốc
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

      const result = await contributionAwardService.getAll(filters, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách HCBVTQ thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get all contribution awards error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách thất bại',
      });
    }
  }

  /**
   * GET /api/contribution-awards/export
   * Xuất file Excel Huân chương Bảo vệ Tổ quốc
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

      if (userRole === ROLES.MANAGER) {
        const user = await contributionAwardService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.co_quan_don_vi_id || user.QuanNhan.don_vi_truc_thuoc_id;
      }

      const buffer = await contributionAwardService.exportToExcel(filters);

      const fileName = `danh_sach_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export contribution awards Excel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file Excel thất bại',
      });
    }
  }

  /**
   * GET /api/contribution-awards/statistics
   * Thống kê Huân chương Bảo vệ Tổ quốc theo hạng
   */
  async getStatistics(req, res) {
    try {
      const statistics = await contributionAwardService.getStatistics();

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê HCBVTQ thành công',
        data: statistics,
      });
    } catch (error) {
      console.error('Get contribution awards statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy thống kê thất bại',
      });
    }
  }

  /**
   * DELETE /api/contribution-awards/:id
   * Xóa khen thưởng HCBVTQ (không xóa đề xuất)
   */
  async deleteAward(req, res) {
    try {
      const { id } = req.params;
      const adminUsername = req.user?.username || 'Admin';
      const result = await contributionAwardService.deleteAward(id, adminUsername);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error('Delete contribution award error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa khen thưởng thất bại',
      });
    }
  }
}

module.exports = new ContributionAwardController();
