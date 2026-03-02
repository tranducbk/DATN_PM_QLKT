const proposalService = require('../services/proposal.service');
const notificationHelper = require('../helpers/notificationHelper');

class ProposalController {
  /**
   * GET /api/proposals/template?type=CA_NHAN_HANG_NAM|DON_VI_HANG_NAM|NIEN_HAN|HC_QKQT|KNC_VSNXD_QDNDVN|CONG_HIEN|DOT_XUAT|NCKH
   * Xuất file mẫu Excel để Manager điền đề xuất
   */
  async exportTemplate(req, res) {
    try {
      const userId = req.user.id;
      const { type = 'CA_NHAN_HANG_NAM' } = req.query;

      // Validate type
      const validTypes = [
        'CA_NHAN_HANG_NAM',
        'DON_VI_HANG_NAM',
        'NIEN_HAN',
        'HC_QKQT',
        'KNC_VSNXD_QDNDVN',
        'CONG_HIEN',
        'DOT_XUAT',
        'NCKH',
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Loại đề xuất không hợp lệ. Chỉ chấp nhận: ' + validTypes.join(', '),
        });
      }

      const buffer = await proposalService.exportTemplate(userId, type);

      const typeNames = {
        CA_NHAN_HANG_NAM: 'ca_nhan_hang_nam',
        DON_VI_HANG_NAM: 'don_vi_hang_nam',
        NIEN_HAN: 'nien_han',
        HC_QKQT: 'hc_qkqt',
        KNC_VSNXD_QDNDVN: 'knc_vsnxd_qdndvn',
        CONG_HIEN: 'cong_hien',
        DOT_XUAT: 'dot_xuat',
        NCKH: 'nckh',
      };
      const typeName = typeNames[type] || 'default';
      const fileName = `mau_de_xuat_${typeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file mẫu thất bại',
      });
    }
  }

  /**
   * POST /api/proposals
   * Nộp file đề xuất khen thưởng (Excel + nhiều file đính kèm không giới hạn)
   * Body: type=CA_NHAN_HANG_NAM|DON_VI_HANG_NAM|NIEN_HAN|HC_QKQT|KNC_VSNXD_QDNDVN|CONG_HIEN|DOT_XUAT|NCKH, so_quyet_dinh (optional)
   * Files: file_excel (required), attached_files[] (optional - không giới hạn số lượng)
   */
  async submitProposal(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { so_quyet_dinh, type = 'CA_NHAN_HANG_NAM' } = req.body;

      // Validate type
      const validTypes = [
        'CA_NHAN_HANG_NAM',
        'DON_VI_HANG_NAM',
        'NIEN_HAN',
        'HC_QKQT',
        'KNC_VSNXD_QDNDVN',
        'CONG_HIEN',
        'DOT_XUAT',
        'NCKH',
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Loại đề xuất không hợp lệ. Chỉ chấp nhận: ' + validTypes.join(', '),
        });
      }

      // Manager không được đề xuất loại ĐỘT XUẤT (chỉ Admin mới thêm được)
      if (userRole === 'MANAGER' && type === 'DOT_XUAT') {
        return res.status(403).json({
          success: false,
          message:
            'Manager không có quyền đề xuất khen thưởng đột xuất. Loại này chỉ do Admin quản lý.',
        });
      }

      // Lấy title_data từ body
      const { title_data, selected_personnel, nam, ghi_chu } = req.body;

      if (!title_data) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi dữ liệu đề xuất',
        });
      }

      // Parse title_data nếu là string
      let titleDataParsed;
      try {
        titleDataParsed = typeof title_data === 'string' ? JSON.parse(title_data) : title_data;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu title_data không hợp lệ',
        });
      }

      // Lấy tất cả các file đính kèm (có thể nhiều file)
      const attachedFiles = req.files?.attached_files || [];

      const result = await proposalService.submitProposal(
        titleDataParsed,
        attachedFiles,
        so_quyet_dinh,
        userId,
        type,
        nam,
        ghi_chu
      );

      // Gửi thông báo cho tất cả ADMIN
      try {
        await notificationHelper.notifyAdminsOnProposalSubmission(result.proposal, req.user);
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      return res.status(201).json({
        success: true,
        message: result.message,
        data: result.proposal,
      });
    } catch (error) {
      console.error('Submit proposal error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Nộp đề xuất khen thưởng thất bại',
      });
    }
  }

  /**
   * GET /api/proposals
   * Lấy danh sách đề xuất
   */
  async getProposals(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { page = 1, limit = 10 } = req.query;

      const result = await proposalService.getProposals(userId, userRole, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách đề xuất thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get proposals error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách đề xuất thất bại',
      });
    }
  }

  /**
   * GET /api/proposals/:id
   * Lấy chi tiết 1 đề xuất
   */
  async getProposalById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Validate id
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID đề xuất không hợp lệ',
        });
      }

      const result = await proposalService.getProposalById(id, userId, userRole);

      return res.status(200).json({
        success: true,
        message: 'Lấy chi tiết đề xuất thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get proposal by id error:', error);
      return res.status(403).json({
        success: false,
        message: error.message || 'Lấy chi tiết đề xuất thất bại',
      });
    }
  }

  /**
   * POST /api/proposals/:id/approve
   * Phê duyệt đề xuất và import vào CSDL
   */
  async approveProposal(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      // Parse JSON data từ FormData
      const editedData = {
        data_danh_hieu: JSON.parse(req.body.data_danh_hieu || '[]'),
        data_thanh_tich: JSON.parse(req.body.data_thanh_tich || '[]'),
        data_nien_han: JSON.parse(req.body.data_nien_han || '[]'),
        data_cong_hien: JSON.parse(req.body.data_cong_hien || '[]'),
      };

      // Lấy số quyết định cho từng loại đề xuất
      const decisions = {
        so_quyet_dinh_ca_nhan_hang_nam: req.body.so_quyet_dinh_ca_nhan_hang_nam,
        so_quyet_dinh_don_vi_hang_nam: req.body.so_quyet_dinh_don_vi_hang_nam,
        so_quyet_dinh_nien_han: req.body.so_quyet_dinh_nien_han,
        so_quyet_dinh_cong_hien: req.body.so_quyet_dinh_cong_hien,
        so_quyet_dinh_dot_xuat: req.body.so_quyet_dinh_dot_xuat,
        so_quyet_dinh_nckh: req.body.so_quyet_dinh_nckh,
      };

      // Lấy file PDF cho từng loại đề xuất
      const pdfFiles = {
        file_pdf_ca_nhan_hang_nam: req.files?.file_pdf_ca_nhan_hang_nam?.[0], // CA_NHAN_HANG_NAM
        file_pdf_don_vi_hang_nam: req.files?.file_pdf_don_vi_hang_nam?.[0], // DON_VI_HANG_NAM
        file_pdf_nien_han: req.files?.file_pdf_nien_han?.[0], // NIEN_HAN
        file_pdf_cong_hien: req.files?.file_pdf_cong_hien?.[0], // CONG_HIEN
        file_pdf_dot_xuat: req.files?.file_pdf_dot_xuat?.[0], // DOT_XUAT
        file_pdf_nckh: req.files?.file_pdf_nckh?.[0], // NCKH
      };

      // Lấy ghi chú (optional)
      const ghiChu = req.body.ghi_chu || null;

      // Validate id
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID đề xuất không hợp lệ',
        });
      }

      const result = await proposalService.approveProposal(
        id,
        editedData,
        adminId,
        decisions,
        pdfFiles,
        ghiChu
      );

      // Gửi thông báo cho người gửi đề xuất
      try {
        await notificationHelper.notifyManagerOnProposalApproval(result.proposal, req.user);
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      // Gửi thông báo cho user nhận khen thưởng (nếu có)
      try {
        if (result.affectedPersonnelIds && result.affectedPersonnelIds.length > 0) {
          await notificationHelper.notifyUsersOnAwardApproved(
            result.affectedPersonnelIds,
            result.proposal,
            req.user.username
          );
        }
      } catch (notifError) {
        console.error('Failed to send notifications to award recipients:', notifError);
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          ...result.result,
          proposal: result.proposal,
        },
      });
    } catch (error) {
      console.error('Approve proposal error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Phê duyệt đề xuất thất bại',
      });
    }
  }

  /**
   * GET /api/proposals/uploads/:filename
   * Lấy file PDF đã upload
   */
  async getPdfFile(req, res) {
    try {
      // Decode filename để xử lý ký tự đặc biệt (tiếng Việt)
      const filename = decodeURIComponent(req.params.filename);

      const result = await proposalService.getPdfFile(filename);

      // Trả về file
      return res.sendFile(result.filePath);
    } catch (error) {
      console.error('Get PDF file error:', error);
      return res.status(404).json({
        success: false,
        message: error.message || 'Không tìm thấy file PDF',
      });
    }
  }

  /**
   * POST /api/proposals/:id/reject
   * Từ chối đề xuất với lý do
   */
  async rejectProposal(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const { ghi_chu, ly_do } = req.body;

      // Accept both ghi_chu and ly_do for backward compatibility
      const rejectReason = ghi_chu || ly_do;

      // Validate
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID đề xuất không hợp lệ',
        });
      }

      if (!rejectReason || rejectReason.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập lý do từ chối',
        });
      }

      const result = await proposalService.rejectProposal(id, rejectReason, adminId);

      // Gửi thông báo cho người gửi đề xuất
      try {
        await notificationHelper.notifyManagerOnProposalRejection(
          result.proposal,
          req.user,
          rejectReason
        );
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          ...result.result,
          proposal: result.proposal,
        },
      });
    } catch (error) {
      console.error('Reject proposal error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Từ chối đề xuất thất bại',
      });
    }
  }

  /**
   * GET /api/proposals/:id/download-excel
   * Tải file Excel của đề xuất
   */
  async downloadProposalExcel(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID đề xuất không hợp lệ',
        });
      }

      const buffer = await proposalService.downloadProposalExcel(id);

      const fileName = `de_xuat_${id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Download proposal Excel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tải file Excel thất bại',
      });
    }
  }

  /**
   * GET /api/awards
   * Lấy danh sách tất cả khen thưởng (Admin hoặc Manager)
   */
  async getAllAwards(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;

      // Nếu là Manager, chỉ xem khen thưởng đơn vị mình
      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const result = await proposalService.getAllAwards(filters, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách khen thưởng thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get all awards error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách khen thưởng thất bại',
      });
    }
  }

  /**
   * GET /api/awards/template
   * Tải file mẫu Excel để import khen thưởng
   */
  async getAwardsTemplate(req, res) {
    try {
      const buffer = await proposalService.exportAwardsTemplate();

      const fileName = `mau_import_khen_thuong_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Get awards template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tải file mẫu thất bại',
      });
    }
  }

  /**
   * POST /api/awards/import
   * Import khen thưởng từ file Excel
   */
  async importAwards(req, res) {
    try {
      // Kiểm tra file upload
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await proposalService.importAwards(req.file.buffer, req.user.id);

      // Gửi thông báo cho tất cả MANAGER của đơn vị được thêm khen thưởng
      try {
        if (result.importedUnits && result.importedUnits.length > 0) {
          for (const unitInfo of result.importedUnits) {
            await notificationHelper.notifyManagersOnAwardAdded(
              unitInfo.don_vi_id,
              unitInfo.don_vi_name,
              unitInfo.nam,
              unitInfo.award_type,
              req.user.username
            );
          }
        }
      } catch (notifError) {
        console.error('Failed to send notifications:', notifError);
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.result,
      });
    } catch (error) {
      console.error('Import awards error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Import khen thưởng thất bại',
      });
    }
  }

  /**
   * GET /api/awards/export
   * Xuất file Excel tổng hợp khen thưởng
   */
  async exportAllAwardsExcel(req, res) {
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
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const buffer = await proposalService.exportAllAwardsExcel(filters);

      const fileName = `danh_sach_khen_thuong_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export all awards Excel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file Excel thất bại',
      });
    }
  }

  /**
   * DELETE /api/proposals/:id
   * Xóa đề xuất (Manager chỉ có thể xóa đề xuất của chính mình, status = PENDING)
   * @access  MANAGER, ADMIN
   */
  async deleteProposal(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Validate id
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID đề xuất không hợp lệ',
        });
      }

      const result = await proposalService.deleteProposal(id, userId, userRole);

      // Ghi log hệ thống
      try {
        const { prisma } = require('../models');
        const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const userAgent = req.get('User-Agent');

        await prisma.systemLog.create({
          data: {
            nguoi_thuc_hien_id: userId,
            actor_role: userRole,
            action: 'DELETE',
            resource: 'proposals',
            tai_nguyen_id: id,
            description: `Xóa đề xuất khen thưởng ID ${id} - Đơn vị: ${result.proposal.don_vi}`,
            payload: {
              proposal_id: id,
              don_vi: result.proposal.don_vi,
              status: result.proposal.status,
            },
            ip_address: ipAddress,
            user_agent: userAgent,
          },
        });
      } catch (logError) {
        console.error('[deleteProposal] Lỗi khi ghi system log:', logError);
        // Không throw error, tiếp tục trả về response
      }

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.proposal,
      });
    } catch (error) {
      console.error('Delete proposal error:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Xóa đề xuất thất bại',
      });
    }
  }

  /**
   * GET /api/awards/statistics
   * Thống kê khen thưởng theo loại
   */
  async getAwardsStatistics(req, res) {
    try {
      const statistics = await proposalService.getAwardsStatistics();

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê khen thưởng thành công',
        data: statistics,
      });
    } catch (error) {
      console.error('Get awards statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy thống kê khen thưởng thất bại',
      });
    }
  }

  /**
   * GET /api/proposals/check-duplicate
   * Kiểm tra xem quân nhân đã có đề xuất cùng năm và cùng danh hiệu chưa
   */
  async checkDuplicateAward(req, res) {
    try {
      const { personnel_id, nam, danh_hieu, proposal_type } = req.query;

      if (!personnel_id || !nam || !danh_hieu || !proposal_type) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin: personnel_id, nam, danh_hieu, proposal_type',
        });
      }

      const result = await proposalService.checkDuplicateAward(
        personnel_id,
        parseInt(nam),
        danh_hieu,
        proposal_type
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Check duplicate award error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm tra đề xuất trùng',
      });
    }
  }

  /**
   * GET /api/proposals/check-duplicate-unit
   * Kiểm tra xem đơn vị đã có đề xuất cùng năm và cùng danh hiệu chưa
   */
  async checkDuplicateUnitAward(req, res) {
    try {
      const { don_vi_id, nam, danh_hieu, proposal_type } = req.query;

      if (!don_vi_id || !nam || !danh_hieu || !proposal_type) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin: don_vi_id, nam, danh_hieu, proposal_type',
        });
      }

      const result = await proposalService.checkDuplicateUnitAward(
        don_vi_id,
        parseInt(nam),
        danh_hieu,
        proposal_type
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Check duplicate unit award error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lỗi khi kiểm tra đề xuất trùng',
      });
    }
  }

  // ============================================
  // HCCSVV - Huy chương Chiến sĩ VẺ VANG
  // ============================================

  /**
   * GET /api/hccsvv/template
   * Tải file mẫu Excel để import HCCSVV
   */
  async getHCCSVVTemplate(req, res) {
    try {
      const buffer = await proposalService.exportHCCSVVTemplate();

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
  async importHCCSVV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await proposalService.importHCCSVV(req.file.buffer, req.user.id);

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
  async getAllHCCSVV(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const result = await proposalService.getAllHCCSVV(filters, page, limit);

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
  async exportHCCSVVExcel(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const buffer = await proposalService.exportHCCSVVExcel(filters);

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
  async getHCCSVVStatistics(req, res) {
    try {
      const statistics = await proposalService.getHCCSVVStatistics();

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

  // ============================================
  // CONTRIBUTION AWARDS - HUÂN CHƯƠNG BẢO VỆ TỔ QUỐC (CỐNG HIẾN)
  // ============================================

  async getContributionAwardsTemplate(req, res) {
    try {
      const buffer = await proposalService.exportContributionAwardsTemplate();

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

  async importContributionAwards(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await proposalService.importContributionAwards(req.file.buffer, req.user.id);

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

  async getAllContributionAwards(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const result = await proposalService.getAllContributionAwards(filters, page, limit);

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

  async exportContributionAwardsExcel(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, danh_hieu } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;
      if (danh_hieu) filters.danh_hieu = danh_hieu;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const buffer = await proposalService.exportContributionAwardsExcel(filters);

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

  async getContributionAwardsStatistics(req, res) {
    try {
      const statistics = await proposalService.getContributionAwardsStatistics();

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

  // ============================================
  // COMMEMORATIVE MEDALS - KỶ NIỆM CHƯƠNG VSNXD QĐNDVN
  // ============================================

  async getCommemorativeMedalsTemplate(req, res) {
    try {
      const buffer = await proposalService.exportCommemorativeMedalsTemplate();

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

  async importCommemorativeMedals(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await proposalService.importCommemorativeMedals(req.file.buffer, req.user.id);

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

  async getAllCommemorativeMedals(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const result = await proposalService.getAllCommemorativeMedals(filters, page, limit);

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

  async exportCommemorativeMedalsExcel(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const buffer = await proposalService.exportCommemorativeMedalsExcel(filters);

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

  async getCommemorativeMedalsStatistics(req, res) {
    try {
      const statistics = await proposalService.getCommemorativeMedalsStatistics();

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

  // ============================================
  // MILITARY FLAG - Huy chương quân kỳ QUYẾT THẮNG
  // ============================================

  async getMilitaryFlagTemplate(req, res) {
    try {
      const buffer = await proposalService.exportMilitaryFlagTemplate();

      const fileName = `mau_import_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Get military flag template error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Tải file mẫu thất bại',
      });
    }
  }

  async importMilitaryFlag(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng gửi file Excel',
        });
      }

      const result = await proposalService.importMilitaryFlag(req.file.buffer, req.user.id);

      return res.status(200).json({
        success: true,
        message: 'Import Huy chương quân kỳ Quyết thắng thành công',
        data: result,
      });
    } catch (error) {
      console.error('Import military flag error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Import thất bại',
      });
    }
  }

  async getAllMilitaryFlag(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam, page = 1, limit = 50 } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const result = await proposalService.getAllMilitaryFlag(filters, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách HCQKQT thành công',
        data: result,
      });
    } catch (error) {
      console.error('Get all military flag error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy danh sách thất bại',
      });
    }
  }

  async exportMilitaryFlagExcel(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { don_vi_id, nam } = req.query;

      const filters = {};
      if (don_vi_id) filters.don_vi_id = don_vi_id;
      if (nam) filters.nam = nam;

      if (userRole === 'MANAGER') {
        const user = await proposalService.getUserWithUnit(userId);
        if (!user || !user.QuanNhan) {
          return res.status(403).json({
            success: false,
            message: 'Không tìm thấy thông tin đơn vị',
          });
        }
        filters.don_vi_id = user.QuanNhan.don_vi_id;
      }

      const buffer = await proposalService.exportMilitaryFlagExcel(filters);

      const fileName = `danh_sach_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      return res.status(200).send(buffer);
    } catch (error) {
      console.error('Export military flag Excel error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Xuất file Excel thất bại',
      });
    }
  }

  async getMilitaryFlagStatistics(req, res) {
    try {
      const statistics = await proposalService.getMilitaryFlagStatistics();

      return res.status(200).json({
        success: true,
        message: 'Lấy thống kê HCQKQT thành công',
        data: statistics,
      });
    } catch (error) {
      console.error('Get military flag statistics error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Lấy thống kê thất bại',
      });
    }
  }
}

module.exports = new ProposalController();
