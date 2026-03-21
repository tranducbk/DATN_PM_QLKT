const annualRewardService = require('../services/annualReward.service');
const profileService = require('../services/profile.service');
const { prisma } = require('../models');
const { ROLES } = require('../constants/roles');
const { parsePagination } = require('../helpers/paginationHelper');
const { writeSystemLog } = require('../helpers/systemLogHelper');

class AnnualRewardController {
  async getAnnualRewards(req, res) {
    try {
      const { personnel_id, page, limit, nam, danh_hieu, ho_ten } = req.query;

      // Nếu có personnel_id, lấy danh hiệu của 1 người
      if (personnel_id) {
        const result = await annualRewardService.getAnnualRewards(personnel_id);
        return res.status(200).json({
          success: true,
          message: 'Lấy danh sách danh hiệu thành công',
          data: result,
        });
      }

      // Nếu không có personnel_id, lấy danh sách tất cả với phân trang
      const { page: pageNum, limit: limitNum } = parsePagination({ page, limit });
      const where = {};

      if (nam) where.nam = parseInt(nam);
      if (danh_hieu) where.danh_hieu = danh_hieu;

      // Filter theo họ tên
      const quanNhanFilter = {};
      if (ho_ten) {
        quanNhanFilter.ho_ten = { contains: ho_ten, mode: 'insensitive' };
      }

      // Phân quyền: Manager chỉ xem được dữ liệu đơn vị mình
      const userRole = req.user?.role;
      const userQuanNhanId = req.user?.quan_nhan_id;
      if (userRole === ROLES.MANAGER && userQuanNhanId) {
        const managerPersonnel = await prisma.quanNhan.findUnique({
          where: { id: userQuanNhanId },
          select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
        });
        if (managerPersonnel) {
          if (managerPersonnel.co_quan_don_vi_id) {
            // Manager thuộc cơ quan đơn vị - lấy tất cả quân nhân trong cơ quan đơn vị và các đơn vị trực thuộc
            const donViTrucThuocIds = await prisma.donViTrucThuoc.findMany({
              where: { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
              select: { id: true },
            });
            const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);
            where.QuanNhan = {
              ...quanNhanFilter,
              OR: [
                { co_quan_don_vi_id: managerPersonnel.co_quan_don_vi_id },
                { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
              ],
            };
          } else if (managerPersonnel.don_vi_truc_thuoc_id) {
            // Manager thuộc đơn vị trực thuộc - chỉ lấy quân nhân trong đơn vị đó
            where.QuanNhan = {
              ...quanNhanFilter,
              don_vi_truc_thuoc_id: managerPersonnel.don_vi_truc_thuoc_id,
            };
          }
        }
      } else if (Object.keys(quanNhanFilter).length > 0) {
        // Nếu không phải manager nhưng có filter ho_ten
        where.QuanNhan = quanNhanFilter;
      }

      const [awards, total] = await Promise.all([
        prisma.danhHieuHangNam.findMany({
          where,
          include: {
            QuanNhan: {
              include: {
                CoQuanDonVi: true,
                DonViTrucThuoc: true,
                ChucVu: true,
              },
            },
          },
          orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.danhHieuHangNam.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách danh hiệu thành công',
        data: {
          awards,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
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

  async createAnnualReward(req, res) {
    try {
      const {
        personnel_id,
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      } = req.body;

      if (!personnel_id || !nam || !danh_hieu) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin: personnel_id, nam, danh_hieu',
        });
      }

      const result = await annualRewardService.createAnnualReward({
        personnel_id,
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      });

      // Tự động cập nhật lại hồ sơ sau khi thêm danh hiệu
      try {
        await profileService.recalculateAnnualProfile(personnel_id);
      } catch (recalcError) {}

      return res.status(201).json({
        success: true,
        message: 'Thêm danh hiệu thành công',
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

  async updateAnnualReward(req, res) {
    try {
      const { id } = req.params;
      const {
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      } = req.body;

      const result = await annualRewardService.updateAnnualReward(id, {
        nam,
        danh_hieu,
        cap_bac,
        chuc_vu,
        ghi_chu,
        nhan_bkbqp,
        so_quyet_dinh_bkbqp,
        nhan_cstdtq,
        so_quyet_dinh_cstdtq,
        nhan_bkttcp,
        so_quyet_dinh_bkttcp,
      });

      // Tự động cập nhật lại hồ sơ sau khi cập nhật danh hiệu
      try {
        await profileService.recalculateAnnualProfile(result.quan_nhan_id);
      } catch (recalcError) {}

      return res.status(200).json({
        success: true,
        message: 'Cập nhật danh hiệu thành công',
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

  async deleteAnnualReward(req, res) {
    try {
      const { id } = req.params;
      const adminUsername = req.user?.username || 'Admin';

      const result = await annualRewardService.deleteAnnualReward(id, adminUsername);

      return res.status(200).json({
        success: true,
        message: result.message,
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
   * POST /api/annual-rewards/check
   * Kiểm tra quân nhân đã có khen thưởng hoặc đề xuất cho năm đó chưa
   * Body: { personnel_ids: [1,2,3], nam: 2024, danh_hieu: 'CSTDCS' }
   */
  async checkAnnualRewards(req, res) {
    try {
      let { personnel_ids, nam, danh_hieu } = req.body;

      // Lọc bỏ null/undefined (giữ nguyên string IDs vì Prisma dùng String cho ID)
      if (personnel_ids && Array.isArray(personnel_ids)) {
        personnel_ids = personnel_ids.filter(id => {
          const isValid = id !== null && id !== undefined && id !== '' && typeof id === 'string';
          return isValid;
        });
      }

      if (!personnel_ids || !Array.isArray(personnel_ids) || personnel_ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp danh sách quân nhân hợp lệ',
        });
      }

      if (!nam || !danh_hieu) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp năm và danh hiệu',
        });
      }

      const result = await annualRewardService.checkAnnualRewards(personnel_ids, nam, danh_hieu);

      return res.status(200).json({
        success: true,
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
   * POST /api/annual-rewards/bulk
   * Thêm danh hiệu hằng năm đồng loạt cho nhiều quân nhân
   * Body: { personnel_ids: [1,2,3], nam: 2024, danh_hieu: 'CSTDCS', so_quyet_dinh: '123/QĐ', cap_bac: 'Thiếu tá', chuc_vu: 'Trưởng phòng' }
   * File: file_dinh_kem (optional)
   */
  async bulkCreateAnnualRewards(req, res) {
    try {
      const {
        personnel_ids,
        personnel_rewards_data,
        nam,
        danh_hieu,
        ghi_chu,
        so_quyet_dinh,
        cap_bac,
        chuc_vu,
      } = req.body;

      // Parse personnel_ids nếu là string
      let parsedPersonnelIds = personnel_ids;
      if (typeof personnel_ids === 'string') {
        try {
          parsedPersonnelIds = JSON.parse(personnel_ids);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'personnel_ids phải là mảng hoặc chuỗi JSON hợp lệ',
          });
        }
      }

      if (
        !parsedPersonnelIds ||
        !Array.isArray(parsedPersonnelIds) ||
        parsedPersonnelIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn ít nhất một quân nhân (personnel_ids)',
        });
      }

      if (!nam || !danh_hieu) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ thông tin: nam, danh_hieu',
        });
      }

      // Parse personnel_rewards_data nếu có
      let parsedPersonnelRewardsData = personnel_rewards_data;
      if (typeof personnel_rewards_data === 'string') {
        try {
          parsedPersonnelRewardsData = JSON.parse(personnel_rewards_data);
        } catch (e) {
          // Nếu parse lỗi, để null
          parsedPersonnelRewardsData = null;
        }
      }

      const result = await annualRewardService.bulkCreateAnnualRewards({
        personnel_ids: parsedPersonnelIds,
        personnel_rewards_data: parsedPersonnelRewardsData,
        nam,
        danh_hieu,
        ghi_chu,
        so_quyet_dinh,
        cap_bac,
        chuc_vu,
      });

      return res.status(201).json({
        success: true,
        message: `Thêm danh hiệu thành công cho ${result.success} quân nhân`,
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
   * POST /api/annual-rewards/import
   * Import danh hiệu hằng năm từ file Excel
   * Cột bắt buộc: Họ tên, Năm, Danh hiệu (CSTDCS hoặc CSTT)
   */
  async previewImport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng upload file Excel' });
      }
      const result = await annualRewardService.previewImport(req.file.buffer);

      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT_PREVIEW',
        resource: 'annual-rewards',
        description: `Tải lên file ${req.file?.originalname || 'Excel'} để review danh hiệu cá nhân hằng năm: ${result.total || result.valid?.length || 0} dòng, ${result.errors?.length || 0} lỗi`,
        payload: { filename: req.file?.originalname, total: result.total, errors: result.errors?.length || 0 },
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  async confirmImport(req, res) {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Không có dữ liệu để import' });
      }
      const result = await annualRewardService.confirmImport(items);

      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT',
        resource: 'annual-rewards',
        description: `Nhập dữ liệu danh hiệu cá nhân hằng năm thành công: ${result.imported || items.length} bản ghi`,
        payload: { imported: result.imported || items.length },
      });

      return res.json({ success: true, data: result });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({ success: false, message: error.message });
    }
  }

  async importAnnualRewards(req, res) {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy file upload. Vui lòng gửi form-data field "file"',
        });
      }

      const result = await annualRewardService.importFromExcelBuffer(req.file.buffer);

      // Ghi system log
      await writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: 'IMPORT',
        resource: 'annual-rewards',
        description: `Nhập dữ liệu danh hiệu cá nhân hằng năm: ${result.imported}/${result.total} thành công, ${result.errors?.length || 0} lỗi`,
        payload: { imported: result.imported, total: result.total, errorCount: result.errors?.length || 0 },
      });

      return res.status(200).json({
        success: true,
        message: 'Import danh hiệu hằng năm hoàn tất',
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
   * Kiểm tra quân nhân đã nhận Huy chương Quân kỳ Quyết thắng chưa
   * hoặc đang trong đề xuất PENDING
   * GET /api/annual-reward/check-hcqkqt/:personnelId
   */
  async checkAlreadyReceivedHCQKQT(req, res) {
    try {
      const { personnelId } = req.params;

      // 1. Kiểm tra trong bảng HuanChuongQuanKyQuyetThang (đã nhận thực tế)
      const existingAward = await prisma.huanChuongQuanKyQuyetThang.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      if (existingAward) {
        return res.status(200).json({
          success: true,
          data: {
            alreadyReceived: true,
            reason: 'Đã nhận',
            award: existingAward,
          },
        });
      }

      // 2. Kiểm tra đang trong đề xuất PENDING
      const pendingProposal = await prisma.bangDeXuat.findFirst({
        where: {
          loai_de_xuat: 'HC_QKQT',
          status: 'PENDING',
          data_nien_han: {
            array_contains: [{ personnel_id: personnelId }],
          },
        },
      });

      if (pendingProposal) {
        return res.status(200).json({
          success: true,
          data: {
            alreadyReceived: true,
            reason: 'Đang chờ duyệt',
            proposal: pendingProposal,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          alreadyReceived: false,
          reason: null,
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

  /**
   * Kiểm tra quân nhân đã nhận Kỷ niệm chương VSNXD QĐNDVN chưa
   * hoặc đang trong đề xuất PENDING
   * GET /api/annual-reward/check-knc-vsnxd/:personnelId
   */
  async checkAlreadyReceivedKNCVSNXD(req, res) {
    try {
      const { personnelId } = req.params;

      // 1. Kiểm tra trong bảng KyNiemChuongVSNXDQDNDVN (đã nhận thực tế)
      const existingAward = await prisma.kyNiemChuongVSNXDQDNDVN.findUnique({
        where: { quan_nhan_id: personnelId },
      });

      if (existingAward) {
        return res.status(200).json({
          success: true,
          data: {
            alreadyReceived: true,
            reason: 'Đã nhận',
            award: existingAward,
          },
        });
      }

      // 2. Kiểm tra đang trong đề xuất PENDING
      const pendingProposal = await prisma.bangDeXuat.findFirst({
        where: {
          loai_de_xuat: 'KNC_VSNXD_QDNDVN',
          status: 'PENDING',
          data_nien_han: {
            array_contains: [{ personnel_id: personnelId }],
          },
        },
      });

      if (pendingProposal) {
        return res.status(200).json({
          success: true,
          data: {
            alreadyReceived: true,
            reason: 'Đang chờ duyệt',
            proposal: pendingProposal,
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          alreadyReceived: false,
          reason: null,
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

  async getTemplate(req, res) {
    try {
      const userRole = req.user.role; // Lấy role từ token

      // Parse personnel_ids from query string (comma-separated)
      let personnelIds = [];
      if (req.query.personnel_ids) {
        personnelIds = req.query.personnel_ids
          .split(',')
          .map(id => id.trim())
          .filter(id => id.length > 0);
      }

      const workbook = await annualRewardService.exportTemplate(personnelIds, userRole);

      // Chuyển workbook thành buffer
      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="mau_import_ca_nhan_hang_nam_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`
      );

      return res.send(buffer);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  async exportToExcel(req, res) {
    try {
      const { nam, danh_hieu, don_vi_id, personnel_ids } = req.query;
      const role = req.user?.role;
      const userUnitId = req.user?.co_quan_don_vi_id ?? req.user?.don_vi_truc_thuoc_id;

      const filters = {
        nam: nam ? parseInt(nam) : undefined,
        danh_hieu: danh_hieu ?? undefined,
        don_vi_id: don_vi_id ?? undefined,
      };

      // Parse personnel_ids nếu có
      if (personnel_ids) {
        filters.personnel_ids = personnel_ids
          .split(',')
          .map(id => id.trim())
          .filter(Boolean);
      }

      // Manager chỉ được xuất dữ liệu đơn vị mình
      if (role === ROLES.MANAGER && userUnitId) {
        filters.don_vi_id = userUnitId;
      }

      const workbook = await annualRewardService.exportToExcel(filters);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="danh_sach_ca_nhan_hang_nam_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`
      );

      const buffer = await workbook.xlsx.writeBuffer();
      return res.send(buffer);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || 'Lỗi hệ thống',
      });
    }
  }

  async getStatistics(req, res) {
    try {
      const { nam } = req.query;
      const role = req.user?.role;
      const userUnitId = req.user?.co_quan_don_vi_id || req.user?.don_vi_truc_thuoc_id;

      const filters = {
        nam: nam ? parseInt(nam) : undefined,
      };

      // Manager chỉ được xem thống kê đơn vị mình
      if (role === ROLES.MANAGER && userUnitId) {
        filters.don_vi_id = userUnitId;
      }

      const statistics = await annualRewardService.getStatistics(filters);

      return res.status(200).json({
        success: true,
        data: statistics,
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

module.exports = new AnnualRewardController();
