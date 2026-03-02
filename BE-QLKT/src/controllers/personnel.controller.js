const personnelService = require('../services/personnel.service');
const profileService = require('../services/profile.service');
const notificationHelper = require('../helpers/notificationHelper');

class PersonnelController {
  /**
   * GET /api/personnel?page=1&limit=10&search=&unit_id=
   * Lấy danh sách quân nhân
   */
  async getPersonnel(req, res) {
    try {
      const { page = 1, limit = 10, search, unit_id } = req.query;
      const userRole = req.user.role;
      const userQuanNhanId = req.user.quan_nhan_id;

      const result = await personnelService.getPersonnel(
        page,
        limit,
        userRole,
        userQuanNhanId,
        { search, unit_id }
      );

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách quân nhân thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get personnel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách quân nhân thất bại',
      });
    }
  }

  /**
   * GET /api/personnel/:id
   * Lấy chi tiết 1 quân nhân
   */
  async getPersonnelById(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user.role;
      const userQuanNhanId = req.user.quan_nhan_id;

      // Validate id parameter
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID quân nhân không hợp lệ',
        });
      }

      const result = await personnelService.getPersonnelById(id, userRole, userQuanNhanId);

      return res.status(200).json({
        success: true,
        message: 'Lấy thông tin quân nhân thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get personnel by id error:', error);
      return res.status(403).json({
        success: false,
        message: error.message || 'Lấy thông tin quân nhân thất bại',
      });
    }
  }

  /**
   * POST /api/personnel
   * Thêm quân nhân mới - tự động tạo tài khoản
   * Chỉ cần: cccd, unit_id, position_id
   * Hệ thống tự động:
   * - Tạo username = cccd
   * - Họ tên mặc định = cccd
   * - Password mặc định = 123456
   * - Các trường khác để trống, admin có thể cập nhật sau
   */
  async createPersonnel(req, res) {
    try {
      const { cccd, unit_id, position_id, role } = req.body;

      // Validate input - chỉ cần cccd, unit_id, position_id
      if (!cccd || !unit_id || !position_id) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin: cccd, unit_id, position_id',
        });
      }

      const result = await personnelService.createPersonnel({
        cccd,
        unit_id,
        position_id,
        role, // Truyền role (optional, mặc định USER trong service)
      });

      return res.status(201).json({
        success: true,
        message:
          'Thêm quân nhân và tạo tài khoản thành công. Username: ' + cccd + ', Password: 123456',
        data: result,
      });
    } catch (error) {
      console.error('Create personnel error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Thêm quân nhân thất bại',
      });
    }
  }

  /**
   * PUT /api/personnel/:id
   * Cập nhật quân nhân
   */
  async updatePersonnel(req, res) {
    try {
      const { id } = req.params;
      const {
        unit_id,
        position_id,
        don_vi_id,
        chuc_vu_id,
        co_quan_don_vi_id,
        don_vi_truc_thuoc_id,
        ho_ten,
        gioi_tinh,
        ngay_sinh,
        cccd,
        cap_bac,
        ngay_nhap_ngu,
        ngay_xuat_ngu,
        que_quan_2_cap,
        que_quan_3_cap,
        tru_quan,
        cho_o_hien_nay,
        ngay_vao_dang,
        ngay_vao_dang_chinh_thuc,
        so_the_dang_vien,
        so_dien_thoai,
      } = req.body;
      const userRole = req.user.role;
      const userQuanNhanId = req.user.quan_nhan_id;

      // Hỗ trợ cả 2 format: unit_id/position_id hoặc don_vi_id/chuc_vu_id hoặc co_quan_don_vi_id/don_vi_truc_thuoc_id
      const finalCoQuanDonViId = co_quan_don_vi_id || don_vi_id || unit_id;
      const finalDonViTrucThuocId = don_vi_truc_thuoc_id;
      const finalPositionId = chuc_vu_id || position_id;

      const result = await personnelService.updatePersonnel(
        id,
        {
          co_quan_don_vi_id: finalCoQuanDonViId,
          don_vi_truc_thuoc_id: finalDonViTrucThuocId,
          position_id: finalPositionId,
          ho_ten,
          gioi_tinh,
          ngay_sinh,
          cccd,
          cap_bac,
          ngay_nhap_ngu,
          ngay_xuat_ngu,
          que_quan_2_cap,
          que_quan_3_cap,
          tru_quan,
          cho_o_hien_nay,
          ngay_vao_dang,
          ngay_vao_dang_chinh_thuc,
          so_the_dang_vien,
          so_dien_thoai,
        },
        userRole,
        userQuanNhanId
      );

      // Tự động cập nhật lại hồ sơ sau khi update
      try {
        await profileService.recalculateAnnualProfile(id);
        console.log(`✅ Auto-recalculated profile for personnel ${id}`);
      } catch (recalcError) {
        console.error(
          `⚠️ Failed to auto-recalculate profile for personnel ${id}:`,
          recalcError.message
        );
        // Không throw error để không ảnh hưởng đến việc update personnel
      }

      // Gửi thông báo nếu có chuyển đơn vị
      if (result.unitTransferInfo) {
        try {
          const { unitTransferInfo, ...personnelData } = result;
          await notificationHelper.notifyOnPersonnelTransfer(
            personnelData,
            unitTransferInfo.oldUnit,
            unitTransferInfo.newUnit,
            req.user.username
          );
          console.log(`✅ Sent transfer notifications for personnel ${id}`);
        } catch (notifError) {
          console.error(
            `⚠️ Failed to send transfer notifications for personnel ${id}:`,
            notifError.message
          );
          // Không throw error để không ảnh hưởng đến việc update personnel
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Cập nhật quân nhân thành công',
        data: result,
      });
    } catch (error) {
      console.error('Update personnel error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật quân nhân thất bại',
      });
    }
  }

  /**
   * DELETE /api/personnel/:id
   * Xóa quân nhân
   * NOTE: Endpoint này không được expose trong route.
   * Sử dụng DELETE /api/accounts/:id để xóa tài khoản và toàn bộ dữ liệu liên quan.
   */
  async deletePersonnel(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user.role;
      const userQuanNhanId = req.user.quan_nhan_id;

      // Validate id parameter
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID quân nhân không hợp lệ',
        });
      }

      const result = await personnelService.deletePersonnel(id, userRole, userQuanNhanId);

      return res.status(200).json({
        success: true,
        message: 'Xóa quân nhân thành công',
        data: result,
      });
    } catch (error) {
      console.error('Delete personnel error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa quân nhân thất bại',
      });
    }
  }

  /**
   * POST /api/personnel/import
   * Import hàng loạt từ Excel
   */
  async importPersonnel(req, res) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy file upload. Vui lòng gửi form-data field "file"',
        });
      }

      const result = await personnelService.importFromExcelBuffer(req.file.buffer);

      return res.status(200).json({
        success: true,
        message: 'Import quân nhân hoàn tất',
        data: result,
      });
    } catch (error) {
      console.error('Import personnel error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Import quân nhân thất bại',
      });
    }
  }

  /**
   * GET /api/personnel/export
   * Xuất toàn bộ dữ liệu ra Excel
   */
  async exportPersonnel(req, res) {
    try {
      const buffer = await personnelService.exportPersonnel();

      const fileName = `quan_nhan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export personnel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất dữ liệu quân nhân thất bại',
      });
    }
  }

  /**
   * GET /api/personnel/export-sample
   * Xuất file mẫu Excel để import
   */
  async exportPersonnelSample(req, res) {
    try {
      const buffer = await personnelService.exportPersonnelSample();

      const fileName = `mau_quan_nhan.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export personnel sample error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file mẫu quân nhân thất bại',
      });
    }
  }

  /**
   * POST /api/personnel/check-contribution-eligibility
   * Kiểm tra tính đủ điều kiện nhận danh hiệu cống hiến cho danh sách quân nhân
   * Returns array of personnel IDs that are ineligible (already received or pending approval)
   */
  async checkContributionEligibility(req, res) {
    try {
      const { personnelIds } = req.body;

      if (!personnelIds || !Array.isArray(personnelIds)) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách quân nhân không hợp lệ',
        });
      }

      const result = await personnelService.checkContributionEligibility(personnelIds);

      return res.status(200).json({
        success: true,
        message: 'Kiểm tra tính đủ điều kiện thành công',
        data: result,
      });
    } catch (error) {
      console.error('Check contribution eligibility error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Kiểm tra tính đủ điều kiện thất bại',
      });
    }
  }
}

module.exports = new PersonnelController();
