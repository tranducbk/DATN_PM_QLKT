const adhocAwardService = require('../services/adhocAward.service');
const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');

/**
 * Helper: Get manager's unit info
 */
async function getManagerUnitInfo(quanNhanId) {
  if (!quanNhanId) return null;
  const managerPersonnel = await prisma.quanNhan.findUnique({
    where: { id: quanNhanId },
    select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
  });
  return managerPersonnel;
}

/**
 * Helper: Get all subordinate unit IDs for a co_quan_don_vi
 */
async function getSubordinateUnitIds(coQuanDonViId) {
  const donViTrucThuocList = await prisma.donViTrucThuoc.findMany({
    where: { co_quan_don_vi_id: coQuanDonViId },
    select: { id: true },
  });
  return donViTrucThuocList.map(d => d.id);
}

class AdhocAwardController {
  /**
   * POST /api/adhoc-awards
   * Create ad-hoc award (for individual or unit)
   * Body: { type, year, awardForm, personnelId?, unitId?, unitType?, rank?, position?, note?, decisionNumber?, files[] }
   */
  async createAdhocAward(req, res) {
    try {
      const adminId = req.user.id;
      const {
        type, // CA_NHAN or TAP_THE
        year,
        awardForm, // e.g., "Giấy khen của abc", "Bằng khen của def"
        personnelId, // Required if type = CA_NHAN
        unitId, // Required if type = TAP_THE
        unitType, // CO_QUAN_DON_VI or DON_VI_TRUC_THUOC (required if type = TAP_THE)
        rank, // For CA_NHAN
        position, // For CA_NHAN
        note,
        decisionNumber,
        decisionFilePath, // File path từ số quyết định đã chọn
      } = req.body;

      // Validate type
      if (!['CA_NHAN', 'TAP_THE'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Loại khen thưởng không hợp lệ. Chỉ chấp nhận: CA_NHAN, TAP_THE',
        });
      }

      // Validate required fields based on type
      if (type === 'CA_NHAN' && !personnelId) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin quân nhân (personnelId)',
        });
      }

      if (type === 'TAP_THE' && (!unitId || !unitType)) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin đơn vị (unitId và unitType)',
        });
      }

      if (!awardForm || !year) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc (awardForm, year)',
        });
      }

      // Handle uploaded files - chỉ xử lý attached files (file quyết định không lưu trong award)
      const attachedFiles = req.files?.attachedFiles || [];

      const result = await adhocAwardService.createAdhocAward({
        adminId,
        type,
        year: parseInt(year),
        awardForm,
        personnelId,
        unitId,
        unitType,
        rank,
        position,
        note,
        decisionNumber,
        attachedFiles,
      });

      return res.status(201).json({
        success: true,
        message: 'Tạo khen thưởng đột xuất thành công',
        data: result,
      });
    } catch (error) {
      console.error('Create ad-hoc award error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tạo khen thưởng đột xuất thất bại',
      });
    }
  }

  /**
   * GET /api/adhoc-awards
   * Get all ad-hoc awards with filters
   * Query: type?, year?, personnelId?, unitId?, ho_ten?
   * Manager only sees awards for their unit
   */
  async getAdhocAwards(req, res) {
    try {
      const { type, year, personnelId, unitId, ho_ten, page = 1, limit = 1000 } = req.query;
      const userRole = req.user?.role;
      const userQuanNhanId = req.user?.quan_nhan_id;

      // Build filter options
      const filterOptions = {
        type,
        year: year ? parseInt(year) : undefined,
        personnelId,
        unitId,
        ho_ten,
        page: parseInt(page),
        limit: parseInt(limit),
      };

      // For Manager, filter by their unit
      if (userRole === ROLES.MANAGER) {
        if (!userQuanNhanId) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin quân nhân',
          });
        }

        const managerPersonnel = await getManagerUnitInfo(userQuanNhanId);
        if (!managerPersonnel) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }

        if (managerPersonnel.co_quan_don_vi_id) {
          filterOptions.managerCoQuanId = managerPersonnel.co_quan_don_vi_id;
          filterOptions.managerDonViTrucThuocIds = await getSubordinateUnitIds(
            managerPersonnel.co_quan_don_vi_id
          );
        } else if (managerPersonnel.don_vi_truc_thuoc_id) {
          filterOptions.managerDonViTrucThuocId = managerPersonnel.don_vi_truc_thuoc_id;
        }
      }

      const result = await adhocAwardService.getAdhocAwards(filterOptions);

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error('Get ad-hoc awards error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách khen thưởng đột xuất thất bại',
      });
    }
  }

  /**
   * GET /api/adhoc-awards/:id
   * Get single ad-hoc award by ID
   */
  async getAdhocAwardById(req, res) {
    try {
      const { id } = req.params;

      const result = await adhocAwardService.getAdhocAwardById(id);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get ad-hoc award by ID error:', error);
      return res.status(error.message === 'Khen thưởng đột xuất không tồn tại' ? 404 : 500).json({
        success: false,
        message: error.message || 'Lấy thông tin khen thưởng đột xuất thất bại',
      });
    }
  }

  /**
   * PUT /api/adhoc-awards/:id
   * Update ad-hoc award
   * Body: { awardForm?, year?, rank?, position?, note?, decisionNumber?, files[]? }
   */
  async updateAdhocAward(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const { awardForm, year, rank, position, note, decisionNumber, removeAttachedFileIndexes } =
        req.body;

      // Handle uploaded files - chỉ xử lý attached files (file quyết định không lưu trong award)
      const attachedFiles = req.files?.attachedFiles || [];

      const result = await adhocAwardService.updateAdhocAward({
        id,
        adminId,
        awardForm,
        year: year ? parseInt(year) : undefined,
        rank,
        position,
        note,
        decisionNumber,
        attachedFiles,
        removeAttachedFileIndexes: removeAttachedFileIndexes
          ? JSON.parse(removeAttachedFileIndexes)
          : [],
      });

      return res.status(200).json({
        success: true,
        message: 'Cập nhật khen thưởng đột xuất thành công',
        data: result,
      });
    } catch (error) {
      console.error('Update ad-hoc award error:', error);
      return res.status(error.message === 'Khen thưởng đột xuất không tồn tại' ? 404 : 500).json({
        success: false,
        message: error.message || 'Cập nhật khen thưởng đột xuất thất bại',
      });
    }
  }

  /**
   * DELETE /api/adhoc-awards/:id
   * Delete ad-hoc award
   */
  async deleteAdhocAward(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      await adhocAwardService.deleteAdhocAward(id, adminId);

      return res.status(200).json({
        success: true,
        message: 'Xóa khen thưởng đột xuất thành công',
      });
    } catch (error) {
      console.error('Delete ad-hoc award error:', error);
      return res.status(error.message === 'Khen thưởng đột xuất không tồn tại' ? 404 : 500).json({
        success: false,
        message: error.message || 'Xóa khen thưởng đột xuất thất bại',
      });
    }
  }

  /**
   * GET /api/adhoc-awards/personnel/:personnelId
   * Get all ad-hoc awards for a specific personnel
   */
  async getAdhocAwardsByPersonnel(req, res) {
    try {
      const { personnelId } = req.params;
      const userPersonnelId = req.user.quan_nhan_id;
      const userRole = req.user.role;

      // Allow if user is viewing their own awards or is admin/manager
      if (
        personnelId !== userPersonnelId &&
        !['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(userRole)
      ) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ có thể xem khen thưởng của chính mình.',
        });
      }

      const result = await adhocAwardService.getAdhocAwardsByPersonnel(personnelId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get ad-hoc awards by personnel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách khen thưởng đột xuất của quân nhân thất bại',
      });
    }
  }

  /**
   * GET /api/adhoc-awards/unit/:unitId
   * Get all ad-hoc awards for a specific unit
   * Query: unitType=CO_QUAN_DON_VI|DON_VI_TRUC_THUOC
   */
  async getAdhocAwardsByUnit(req, res) {
    try {
      const { unitId } = req.params;
      const { unitType } = req.query;

      if (!unitType || !['CO_QUAN_DON_VI', 'DON_VI_TRUC_THUOC'].includes(unitType)) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu hoặc sai loại đơn vị (unitType)',
        });
      }

      const result = await adhocAwardService.getAdhocAwardsByUnit(unitId, unitType);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Get ad-hoc awards by unit error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách khen thưởng đột xuất của đơn vị thất bại',
      });
    }
  }
}

module.exports = new AdhocAwardController();
