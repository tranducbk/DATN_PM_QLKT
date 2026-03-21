const awardBulkService = require('../services/awardBulk.service');
const { writeSystemLog } = require('../helpers/systemLogHelper');
const { getLoaiDeXuatName } = require('../constants/danhHieu.constants');

class AwardBulkController {
  /**
   * POST /api/awards/bulk
   * Thêm khen thưởng đồng loạt với validation đầy đủ
   * Body: { type, nam, selected_personnel/selected_units, title_data, ghi_chu, attached_files[] }
   */
  async bulkCreateAwards(req, res) {
    try {
      const { type, nam, selected_personnel, selected_units, title_data, ghi_chu } = req.body;
      const adminId = req.user.id;

      // Parse JSON strings nếu cần
      let parsedSelectedPersonnel = selected_personnel;
      let parsedSelectedUnits = selected_units;
      let parsedTitleData = title_data;

      if (typeof selected_personnel === 'string') {
        try {
          parsedSelectedPersonnel = JSON.parse(selected_personnel);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'selected_personnel phải là mảng hoặc chuỗi JSON hợp lệ',
          });
        }
      }

      if (typeof selected_units === 'string') {
        try {
          parsedSelectedUnits = JSON.parse(selected_units);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'selected_units phải là mảng hoặc chuỗi JSON hợp lệ',
          });
        }
      }

      if (typeof title_data === 'string') {
        try {
          parsedTitleData = JSON.parse(title_data);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'title_data phải là mảng hoặc chuỗi JSON hợp lệ',
          });
        }
      }

      // Validate required fields
      if (!type || !nam) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ: type, nam',
        });
      }

      if (type === 'DON_VI_HANG_NAM') {
        if (
          !parsedSelectedUnits ||
          !Array.isArray(parsedSelectedUnits) ||
          parsedSelectedUnits.length === 0
        ) {
          return res.status(400).json({
            success: false,
            message: 'Vui lòng chọn ít nhất một đơn vị',
          });
        }
      } else {
        if (
          !parsedSelectedPersonnel ||
          !Array.isArray(parsedSelectedPersonnel) ||
          parsedSelectedPersonnel.length === 0
        ) {
          return res.status(400).json({
            success: false,
            message: 'Vui lòng chọn ít nhất một quân nhân',
          });
        }
      }

      if (!parsedTitleData || !Array.isArray(parsedTitleData) || parsedTitleData.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin danh hiệu',
        });
      }

      // Lấy file đính kèm nếu có
      const attachedFiles = req.files?.attached_files || [];

      // Gọi service để xử lý với validation đầy đủ
      const result = await awardBulkService.bulkCreateAwards({
        type,
        nam: parseInt(nam),
        selectedPersonnel: parsedSelectedPersonnel,
        selectedUnits: parsedSelectedUnits,
        titleData: parsedTitleData,
        ghiChu: ghi_chu || null,
        attachedFiles,
        adminId,
      });

      // Ghi system log
      const typeName = getLoaiDeXuatName(type);
      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'BULK_CREATE',
        resource: 'awards',
        description: `Thêm đồng loạt ${typeName} năm ${nam}: ${result.data?.importedCount || 0} thành công, ${result.data?.errorCount || 0} lỗi`,
        payload: { type, nam: parseInt(nam), importedCount: result.data?.importedCount, errorCount: result.data?.errorCount },
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data,
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

module.exports = new AwardBulkController();
