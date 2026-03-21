const contributionAwardService = require('../services/contributionAward.service');
const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');
const { writeSystemLog } = require('../helpers/systemLogHelper');

class ContributionAwardController {
  /**
   * GET /api/contribution-awards/template
   * Tải file mẫu Excel để import Huân chương Bảo vệ Tổ quốc
   */
  async getTemplate(req, res) {
    try {
      const userRole = req.user?.role ?? 'MANAGER';

      // Parse personnel_ids from query string (comma-separated)
      let personnelIds = [];
      if (req.query.personnel_ids) {
        personnelIds = req.query.personnel_ids
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
      }

      const workbook = await contributionAwardService.exportTemplate(personnelIds, userRole);

      // Chuyển workbook thành buffer
      const buffer = await workbook.xlsx.writeBuffer();

      const fileName = `mau_import_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message ?? 'Lỗi hệ thống',
      });
    }
  }

  /**
   * POST /api/contribution-awards/import/preview
   * Preview import HCBVTQ — validate only, no DB write
   */
  async previewImport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng upload file Excel' });
      }
      const result = await contributionAwardService.previewImport(req.file.buffer);

      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT_PREVIEW',
        resource: 'contribution-awards',
        description: `Tải lên file ${req.file?.originalname || 'Excel'} để review huân chương bảo vệ tổ quốc: ${result.total || result.valid?.length || 0} dòng, ${result.errors?.length || 0} lỗi`,
        payload: { filename: req.file?.originalname, total: result.total, errors: result.errors?.length || 0 },
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return res
        .status(statusCode)
        .json({ success: false, message: error.message ?? 'Lỗi hệ thống' });
    }
  }

  /**
   * POST /api/contribution-awards/import/confirm
   * Confirm import HCBVTQ — save validated items to DB
   */
  async confirmImport(req, res) {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có dữ liệu để import' });
      }
      const adminId = req.user?.id;
      const result = await contributionAwardService.confirmImport(items, adminId);

      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT',
        resource: 'contribution-awards',
        description: `Import huân chương bảo vệ tổ quốc thành công: ${result.imported || items.length} bản ghi`,
        payload: { imported: result.imported || items.length },
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return res
        .status(statusCode)
        .json({ success: false, message: error.message ?? 'Lỗi hệ thống' });
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
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message ?? 'Lỗi hệ thống',
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
        filters.don_vi_id = user.QuanNhan.co_quan_don_vi_id ?? user.QuanNhan.don_vi_truc_thuoc_id;
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
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message ?? 'Lỗi hệ thống',
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
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message ?? 'Lỗi hệ thống',
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
      const adminUsername = req.user?.username ?? 'Admin';
      const result = await contributionAwardService.deleteAward(id, adminUsername);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message ?? 'Lỗi hệ thống',
      });
    }
  }
}

module.exports = new ContributionAwardController();
