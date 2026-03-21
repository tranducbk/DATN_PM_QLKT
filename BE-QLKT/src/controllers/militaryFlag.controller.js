const militaryFlagService = require('../services/militaryFlag.service');
const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');
const { writeSystemLog } = require('../helpers/systemLogHelper');

class MilitaryFlagController {
  /**
   * GET /api/military-flag/template
   * Tải file mẫu Excel để import Huy chương quân kỳ Quyết thắng
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

      const workbook = await militaryFlagService.exportTemplate(personnelIds, userRole);
      const buffer = await workbook.xlsx.writeBuffer();

      const fileName = `mau_import_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
   * POST /api/military-flag/import/preview
   * Preview import — parse + validate file Excel, trả về valid/errors
   */
  async previewImport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng upload file Excel' });
      }
      const result = await militaryFlagService.previewImport(req.file.buffer);

      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT_PREVIEW',
        resource: 'military-flag',
        description: `Tải lên file ${req.file?.originalname || 'Excel'} để review huân chương quân kỳ quyết thắng: ${result.total || result.valid?.length || 0} dòng, ${result.errors?.length || 0} lỗi`,
        payload: { filename: req.file?.originalname, total: result.total, errors: result.errors?.length || 0 },
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/military-flag/import/confirm
   * Confirm import — lưu dữ liệu đã validate vào DB
   */
  async confirmImport(req, res) {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có dữ liệu để import' });
      }
      const result = await militaryFlagService.confirmImport(items, req.user.id);

      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT',
        resource: 'military-flag',
        description: `Import huân chương quân kỳ quyết thắng thành công: ${result.imported || items.length} bản ghi`,
        payload: { imported: result.imported || items.length },
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.statusCode ?? 500;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/military-flag/import
   * Import Huy chương quân kỳ Quyết thắng từ file Excel (legacy)
   */
  async importFromExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await militaryFlagService.importFromExcel(req.file.buffer, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Import Huy chương quân kỳ Quyết thắng thành công',
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
   * GET /api/military-flag
   * Lấy danh sách Huy chương quân kỳ Quyết thắng
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

      const result = await militaryFlagService.getAll(filters, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách HCQKQT thành công',
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
   * GET /api/military-flag/export
   * Xuất file Excel Huy chương quân kỳ Quyết thắng
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
        const user = await militaryFlagService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.co_quan_don_vi_id ?? user.QuanNhan.don_vi_truc_thuoc_id;
      }

      const buffer = await militaryFlagService.exportToExcel(filters);

      const fileName = `danh_sach_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
   * GET /api/military-flag/statistics
   * Thống kê Huy chương quân kỳ Quyết thắng
   */
  async getStatistics(req, res) {
    try {
      const statistics = await militaryFlagService.getStatistics();

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê HCQKQT thành công',
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
   * GET /api/military-flag/personnel/:personnel_id
   * Lấy Huy chương quân kỳ Quyết thắng theo personnel_id
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
        const user = await militaryFlagService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        const managerUnitId = user.QuanNhan.co_quan_don_vi_id ?? user.QuanNhan.don_vi_truc_thuoc_id;

        // Lấy thông tin personnel để kiểm tra đơn vị
        const personnel = await militaryFlagService.getPersonnelById(personnel_id);
        if (!personnel) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy thông tin quân nhân',
          });
        }

        const personnelUnitId = personnel.co_quan_don_vi_id ?? personnel.don_vi_truc_thuoc_id;
        if (personnelUnitId !== managerUnitId) {
          return res.status(403).json({
            success: false,
            message: 'Bạn chỉ có thể xem thông tin của đơn vị mình',
          });
        }
      }

      const result = await militaryFlagService.getByPersonnelId(personnel_id);

      return res.status(200).json({
        success: true,
        message: 'Lấy HCQKQT theo personnel_id thành công',
        data: {
          hasReceived: result.length > 0,
          data: result,
        },
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
   * DELETE /api/military-flag/:id
   * Xóa khen thưởng HCQKQT (không xóa đề xuất)
   */
  async deleteAward(req, res) {
    try {
      const { id } = req.params;
      const adminUsername = req.user?.username ?? 'Admin';
      const result = await militaryFlagService.deleteAward(id, adminUsername);

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

module.exports = new MilitaryFlagController();
