import { Request, Response } from 'express';
import proposalService from '../services/proposal';
import hccsvvService from '../services/hccsvv.service';
import contributionAwardService from '../services/contributionAward.service';
import commemorativeMedalService from '../services/commemorativeMedal.service';
import militaryFlagService from '../services/militaryFlag.service';
import { prisma } from '../models';
import * as notificationHelper from '../helpers/notification';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { setFileSendHeaders } from '../helpers/fileResponseHeaders';

/** Lọc đơn vị cho Manager — `QuanNhan` có `co_quan_don_vi_id` / `don_vi_truc_thuoc_id` (schema) */
function managerUnitFilterId(qn: {
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}): string | undefined {
  return qn.co_quan_don_vi_id ?? qn.don_vi_truc_thuoc_id ?? undefined;
}

class ProposalController {
  exportTemplate = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM } = req.query;
    const validTypes = [
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      PROPOSAL_TYPES.DON_VI_HANG_NAM,
      PROPOSAL_TYPES.NIEN_HAN,
      PROPOSAL_TYPES.HC_QKQT,
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      PROPOSAL_TYPES.CONG_HIEN,
      PROPOSAL_TYPES.DOT_XUAT,
      PROPOSAL_TYPES.NCKH,
    ];
    if (!validTypes.includes(type as ProposalType)) {
      return ResponseHelper.badRequest(
        res,
        'Loại đề xuất không hợp lệ. Chỉ chấp nhận: ' + validTypes.join(', ')
      );
    }
    const buffer = await proposalService.exportTemplate(userId, type as string);
    const typeNames: Record<string, string> = {
      CA_NHAN_HANG_NAM: 'ca_nhan_hang_nam',
      DON_VI_HANG_NAM: 'don_vi_hang_nam',
      NIEN_HAN: 'nien_han',
      HC_QKQT: 'hc_qkqt',
      KNC_VSNXD_QDNDVN: 'knc_vsnxd_qdndvn',
      CONG_HIEN: 'cong_hien',
      DOT_XUAT: 'dot_xuat',
      NCKH: 'nckh',
    };
    const typeName = typeNames[type as string] || 'default';
    const fileName = `mau_de_xuat_${typeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  submitProposal = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const {
      so_quyet_dinh,
      type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      title_data,
      selected_personnel,
      nam,
      ghi_chu,
    } = req.body;
    const validTypes = [
      PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      PROPOSAL_TYPES.DON_VI_HANG_NAM,
      PROPOSAL_TYPES.NIEN_HAN,
      PROPOSAL_TYPES.HC_QKQT,
      PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
      PROPOSAL_TYPES.CONG_HIEN,
      PROPOSAL_TYPES.DOT_XUAT,
      PROPOSAL_TYPES.NCKH,
    ];
    if (!validTypes.includes(type as ProposalType)) {
      return ResponseHelper.badRequest(
        res,
        'Loại đề xuất không hợp lệ. Chỉ chấp nhận: ' + validTypes.join(', ')
      );
    }
    if (userRole === ROLES.MANAGER && type === PROPOSAL_TYPES.DOT_XUAT) {
      return ResponseHelper.forbidden(
        res,
        'Manager không có quyền đề xuất khen thưởng đột xuất. Loại này chỉ do Admin quản lý.'
      );
    }
    if (!title_data) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi dữ liệu đề xuất');
    }
    let titleDataParsed;
    try {
      titleDataParsed = typeof title_data === 'string' ? JSON.parse(title_data) : title_data;
    } catch (e) {
      return ResponseHelper.badRequest(res, 'Dữ liệu title_data không hợp lệ');
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const attachedFiles = files?.attached_files || [];
    const result = await proposalService.submitProposal(
      titleDataParsed,
      attachedFiles,
      so_quyet_dinh,
      userId,
      type,
      typeof nam === 'string' ? parseInt(nam, 10) : Number(nam),
      ghi_chu
    );
    try {
      await notificationHelper.notifyAdminsOnProposalSubmission(result.proposal, req.user);
    } catch (notifError) {}
    return ResponseHelper.created(res, { message: result.message, data: result.proposal });
  });

  getProposals = catchAsync(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    const result = await proposalService.getProposals(
      req.user!.id,
      req.user!.role,
      page as string | number,
      limit as string | number
    );
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách đề xuất thành công',
      data: result,
    });
  });

  getProposalById = catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const result = await proposalService.getProposalById(String(id), req.user!.id, req.user!.role);
    return ResponseHelper.success(res, {
      message: 'Lấy chi tiết đề xuất thành công',
      data: result,
    });
  });

  approveProposal = catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminId = req.user!.id;
    const editedData = {
      data_danh_hieu: JSON.parse(req.body.data_danh_hieu || '[]'),
      data_thanh_tich: JSON.parse(req.body.data_thanh_tich || '[]'),
      data_nien_han: JSON.parse(req.body.data_nien_han || '[]'),
      data_cong_hien: JSON.parse(req.body.data_cong_hien || '[]'),
    };
    const decisions = {
      so_quyet_dinh_ca_nhan_hang_nam: req.body.so_quyet_dinh_ca_nhan_hang_nam,
      so_quyet_dinh_don_vi_hang_nam: req.body.so_quyet_dinh_don_vi_hang_nam,
      so_quyet_dinh_nien_han: req.body.so_quyet_dinh_nien_han,
      so_quyet_dinh_cong_hien: req.body.so_quyet_dinh_cong_hien,
      so_quyet_dinh_dot_xuat: req.body.so_quyet_dinh_dot_xuat,
      so_quyet_dinh_nckh: req.body.so_quyet_dinh_nckh,
    };
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const pdfFiles = {
      file_pdf_ca_nhan_hang_nam: files?.file_pdf_ca_nhan_hang_nam?.[0],
      file_pdf_don_vi_hang_nam: files?.file_pdf_don_vi_hang_nam?.[0],
      file_pdf_nien_han: files?.file_pdf_nien_han?.[0],
      file_pdf_cong_hien: files?.file_pdf_cong_hien?.[0],
      file_pdf_dot_xuat: files?.file_pdf_dot_xuat?.[0],
      file_pdf_nckh: files?.file_pdf_nckh?.[0],
    };
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const result = await proposalService.approveProposal(
      String(id),
      editedData,
      adminId,
      decisions,
      pdfFiles,
      req.body.ghi_chu || null
    );
    try {
      await notificationHelper.notifyManagerOnProposalApproval(result.proposal, req.user);
    } catch (notifError) {}
    try {
      if (result.affectedPersonnelIds?.length > 0) {
        await notificationHelper.notifyUsersOnAwardApproved(
          result.affectedPersonnelIds as string[],
          result.proposal,
          req.user!.username
        );
      }
    } catch (notifError) {}
    return ResponseHelper.success(res, {
      message: result.message,
      data: { ...result.result, proposal: result.proposal },
    });
  });

  getPdfFile = catchAsync(async (req: Request, res: Response) => {
    const filename = decodeURIComponent(
      Array.isArray(req.params.filename)
        ? req.params.filename[0]
        : String(req.params.filename ?? '')
    );
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return ResponseHelper.badRequest(res, 'Tên file không hợp lệ');
    }
    const result = await proposalService.getPdfFile(filename);
    setFileSendHeaders(res, result.filename, 'inline');
    return res.sendFile(result.filePath);
  });

  rejectProposal = catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { ghi_chu, ly_do } = req.body;
    const rejectReason = ghi_chu || ly_do;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    if (!rejectReason || rejectReason.trim() === '') {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập lý do từ chối');
    }
    const result = await proposalService.rejectProposal(String(id), rejectReason, req.user!.id);
    try {
      await notificationHelper.notifyManagerOnProposalRejection(
        result.proposal,
        req.user,
        rejectReason
      );
    } catch (notifError) {}
    return ResponseHelper.success(res, {
      message: result.message,
      data: { ...result.result, proposal: result.proposal },
    });
  });

  downloadProposalExcel = catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const buffer = await proposalService.downloadProposalExcel(String(id));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="de_xuat_${id}_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  getAllAwards = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu, page = 1, limit = 50 } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      const uid = managerUnitFilterId(user.QuanNhan);
      if (uid) filters.don_vi_id = uid;
    }
    const result = await proposalService.getAllAwards(
      filters,
      page as string | number,
      limit as string | number
    );
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách khen thưởng thành công',
      data: result,
    });
  });

  getAwardsTemplate = catchAsync(async (req: Request, res: Response) => {
    const buffer = await proposalService.exportAwardsTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_khen_thuong_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  importAwards = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    const result = await proposalService.importAwards(req.file.buffer, req.user!.id);
    try {
      if (result.importedUnits?.length > 0) {
        for (const u of result.importedUnits) {
          await notificationHelper.notifyManagersOnAwardAdded(
            u.don_vi_id,
            u.don_vi_name,
            u.nam,
            u.award_type,
            req.user!.username
          );
        }
      }
    } catch (notifError) {}
    return ResponseHelper.success(res, { message: result.message, data: result.result });
  });

  exportAllAwardsExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    const buffer = await proposalService.exportAllAwardsExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_khen_thuong_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  deleteProposal = catchAsync(async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const result = await proposalService.deleteProposal(id, req.user!.id, req.user!.role);
    try {
      await prisma.systemLog.create({
        data: {
          nguoi_thuc_hien_id: req.user!.id,
          actor_role: req.user!.role,
          action: AUDIT_ACTIONS.DELETE,
          resource: 'proposals',
          tai_nguyen_id: id,
          description: `Xóa đề xuất khen thưởng ID ${id} - Đơn vị: ${(result.proposal as { don_vi?: string }).don_vi}`,
          payload: {
            proposal_id: id,
            don_vi: (result.proposal as { don_vi?: string }).don_vi,
            status: result.proposal.status,
          },
          ip_address: req.ip || req.socket.remoteAddress,
          user_agent: req.get('User-Agent'),
        },
      });
    } catch (logError) {}
    return ResponseHelper.success(res, { message: result.message, data: result.proposal });
  });

  getAwardsStatistics = catchAsync(async (req: Request, res: Response) => {
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê khen thưởng thành công',
      data: await proposalService.getAwardsStatistics(),
    });
  });

  checkDuplicateAward = catchAsync(async (req: Request, res: Response) => {
    const { personnel_id, nam, danh_hieu, proposal_type } = req.query;
    if (!personnel_id || !nam || !danh_hieu || !proposal_type) {
      return ResponseHelper.badRequest(
        res,
        'Thiếu thông tin: personnel_id, nam, danh_hieu, proposal_type'
      );
    }
    return ResponseHelper.success(res, {
      data: await proposalService.checkDuplicateAward(
        personnel_id as string,
        parseInt(nam as string),
        danh_hieu as string,
        proposal_type as string
      ),
    });
  });

  checkDuplicateUnitAward = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu, proposal_type } = req.query;
    if (!don_vi_id || !nam || !danh_hieu || !proposal_type) {
      return ResponseHelper.badRequest(
        res,
        'Thiếu thông tin: don_vi_id, nam, danh_hieu, proposal_type'
      );
    }
    return ResponseHelper.success(res, {
      data: await proposalService.checkDuplicateUnitAward(
        don_vi_id as string,
        parseInt(nam as string),
        danh_hieu as string,
        proposal_type as string
      ),
    });
  });

  getHCCSVVTemplate = catchAsync(async (req: Request, res: Response) => {
    const buffer = await hccsvvService.exportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  importHCCSVV = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Huy chương Chiến sĩ Vẻ vang thành công',
      data: await hccsvvService.importFromExcel(req.file.buffer, req.user!.id),
    });
  });

  getAllHCCSVV = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu, page = 1, limit = 50 } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách HCCSVV thành công',
      data: await hccsvvService.getAll(
        filters,
        page as string | number,
        limit as string | number
      ),
    });
  });

  exportHCCSVVExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    const buffer = await hccsvvService.exportToExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_hccsvv_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  getHCCSVVStatistics = catchAsync(async (req: Request, res: Response) => {
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê HCCSVV thành công',
      data: await hccsvvService.getStatistics(),
    });
  });

  getContributionAwardsTemplate = catchAsync(async (req: Request, res: Response) => {
    const buffer = await contributionAwardService.exportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  importContributionAwards = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Huân chương Bảo vệ Tổ quốc thành công',
      data: await (async () => {
        const preview = await contributionAwardService.previewImport(req.file!.buffer);
        return contributionAwardService.confirmImport(preview.valid, req.user!.id);
      })(),
    });
  });

  getAllContributionAwards = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu, page = 1, limit = 50 } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách HCBVTQ thành công',
      data: await contributionAwardService.getAll(
        filters,
        page as string | number,
        limit as string | number
      ),
    });
  });

  exportContributionAwardsExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, danh_hieu } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    const buffer = await contributionAwardService.exportToExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_hcbvtq_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  getContributionAwardsStatistics = catchAsync(async (req: Request, res: Response) => {
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê HCBVTQ thành công',
      data: await contributionAwardService.getStatistics(),
    });
  });

  getCommemorativeMedalsTemplate = catchAsync(async (req: Request, res: Response) => {
    const buffer = await commemorativeMedalService.exportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_knc_vsnxd_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  importCommemorativeMedals = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Kỷ niệm chương thành công',
      data: await commemorativeMedalService.importFromExcel(req.file.buffer, req.user!.id),
    });
  });

  getAllCommemorativeMedals = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, page = 1, limit = 50 } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách Kỷ niệm chương thành công',
      data: await commemorativeMedalService.getAll(
        filters,
        page as string | number,
        limit as string | number
      ),
    });
  });

  exportCommemorativeMedalsExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    const buffer = await commemorativeMedalService.exportToExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_knc_vsnxd_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  getCommemorativeMedalsStatistics = catchAsync(async (req: Request, res: Response) => {
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê Kỷ niệm chương thành công',
      data: await commemorativeMedalService.getStatistics(),
    });
  });

  getMilitaryFlagTemplate = catchAsync(async (req: Request, res: Response) => {
    const buffer = await militaryFlagService.exportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="mau_import_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  importMilitaryFlag = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Huy chương quân kỳ Quyết thắng thành công',
      data: await militaryFlagService.importFromExcel(req.file.buffer, req.user!.id),
    });
  });

  getAllMilitaryFlag = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam, page = 1, limit = 50 } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách HCQKQT thành công',
      data: await militaryFlagService.getAll(
        filters,
        page as string | number,
        limit as string | number
      ),
    });
  });

  exportMilitaryFlagExcel = catchAsync(async (req: Request, res: Response) => {
    const { don_vi_id, nam } = req.query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (req.user!.role === ROLES.MANAGER) {
      const user = await proposalService.getUserWithUnit(req.user!.id);
      if (!user?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(user.QuanNhan);
    }
    const buffer = await militaryFlagService.exportToExcel(filters);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="danh_sach_hcqkqt_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  getMilitaryFlagStatistics = catchAsync(async (req: Request, res: Response) => {
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê HCQKQT thành công',
      data: await militaryFlagService.getStatistics(),
    });
  });
}

export default new ProposalController();
