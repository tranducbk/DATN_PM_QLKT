import { Request, Response } from 'express';
import proposalService from '../services/proposal';
import hccsvvService from '../services/tenureMedal.service';
import contributionAwardService from '../services/contributionMedal.service';
import commemorativeMedalService from '../services/commemorativeMedal.service';
import militaryFlagService from '../services/militaryFlag.service';
import * as notificationHelper from '../helpers/notification';
import { ROLES } from '../constants/roles.constants';
import { PROPOSAL_TYPES, type ProposalType } from '../constants/proposalTypes.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { parsePagination } from '../helpers/paginationHelper';
import { setFileSendHeaders } from '../helpers/fileResponseHeaders';

// DVTT takes priority over CQDV — CQDV is the parent unit, filtering by it would include all sub-units
function managerUnitFilterId(qn: {
  co_quan_don_vi_id?: string | null;
  don_vi_truc_thuoc_id?: string | null;
}): string | undefined {
  return qn.don_vi_truc_thuoc_id ?? qn.co_quan_don_vi_id ?? undefined;
}

function parseYearQuery(value: unknown): number | null {
  const yearValue = Array.isArray(value) ? value[0] : value;
  if (typeof yearValue !== 'string' && typeof yearValue !== 'number') {
    return null;
  }

  const year = Number(yearValue);
  return Number.isFinite(year) ? year : null;
}

const ALL_PROPOSAL_TYPES = Object.values(PROPOSAL_TYPES);

interface ExportTemplateQuery {
  type?: ProposalType;
}

interface SubmitProposalBody {
  so_quyet_dinh?: string;
  type?: ProposalType;
  title_data?: unknown;
  selected_personnel?: string[];
  nam?: number | string;
  ghi_chu?: string;
}

interface GetProposalsQuery {
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

interface ProposalIdParams {
  id?: string | string[];
}

interface ApproveProposalBody {
  data_danh_hieu?: string;
  data_thanh_tich?: string;
  data_nien_han?: string;
  data_cong_hien?: string;
  so_quyet_dinh_ca_nhan_hang_nam?: string;
  so_quyet_dinh_don_vi_hang_nam?: string;
  so_quyet_dinh_nien_han?: string;
  so_quyet_dinh_cong_hien?: string;
  so_quyet_dinh_dot_xuat?: string;
  so_quyet_dinh_nckh?: string;
  ghi_chu?: string;
}

interface GetPdfFileParams {
  filename?: string | string[];
}

interface RejectProposalBody {
  ghi_chu?: string;
  ly_do?: string;
}

interface AwardsFilterQuery {
  don_vi_id?: string;
  nam?: number;
  danh_hieu?: string;
  [key: string]: unknown;
}

interface UnitYearFilterQuery {
  don_vi_id?: string;
  nam?: number;
  [key: string]: unknown;
}

interface CheckDuplicateAwardQuery {
  personnel_id?: string;
  nam?: string | number | (string | number)[];
  danh_hieu?: string;
  proposal_type?: string;
}

interface CheckDuplicateUnitAwardQuery {
  don_vi_id?: string;
  nam?: string | number | (string | number)[];
  danh_hieu?: string;
  proposal_type?: string;
}

interface CheckDuplicatePersonnelBatchItem {
  personnel_id: string;
  nam: number;
  danh_hieu: string;
  proposal_type: string;
}

interface CheckDuplicateUnitBatchItem {
  don_vi_id: string;
  nam: number;
  danh_hieu: string;
  proposal_type: string;
}

interface CheckDuplicatePersonnelBatchBody {
  items?: CheckDuplicatePersonnelBatchItem[];
}

interface CheckDuplicateUnitBatchBody {
  items?: CheckDuplicateUnitBatchItem[];
}

class ProposalController {
  exportTemplate = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as ExportTemplateQuery;
    const userId = user.id;
    const { type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM } = query;
    if (!ALL_PROPOSAL_TYPES.includes(type as ProposalType)) {
      return ResponseHelper.badRequest(
        res,
        'Loại đề xuất không hợp lệ. Chỉ chấp nhận: ' + ALL_PROPOSAL_TYPES.join(', ')
      );
    }
    const buffer = await proposalService.exportTemplate(userId, type as string);
    const typeName = (type as string).toLowerCase();
    const fileName = `mau_de_xuat_${typeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(buffer);
  });

  submitProposal = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as SubmitProposalBody;
    const userId = user.id;
    const userRole = user.role;
    const {
      so_quyet_dinh,
      type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      title_data,
      selected_personnel,
      nam,
      ghi_chu,
    } = body;
    if (!ALL_PROPOSAL_TYPES.includes(type as ProposalType)) {
      return ResponseHelper.badRequest(
        res,
        'Loại đề xuất không hợp lệ. Chỉ chấp nhận: ' + ALL_PROPOSAL_TYPES.join(', ')
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
      await notificationHelper.notifyAdminsOnProposalSubmission(result.proposal, user);
    } catch (notifError) {
      await writeSystemLog({
        userId: user.id,
        userRole: user.role,
        action: 'ERROR',
        resource: 'proposals',
        description: 'Lỗi gửi thông báo cho Admin khi nộp đề xuất',
        payload: { error: String(notifError) },
      });
    }
    return ResponseHelper.created(res, { message: result.message, data: result.proposal });
  });

  getProposals = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as GetProposalsQuery;
    const { page, limit } = parsePagination(query);
    const result = await proposalService.getProposals(
      user.id,
      user.role,
      page,
      limit
    );
    return ResponseHelper.paginated(res, {
      message: 'Lấy danh sách đề xuất thành công',
      data: result.proposals,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
    });
  });

  getProposalById = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const params = req.params as ProposalIdParams;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const result = await proposalService.getProposalById(String(id), user.id, user.role);
    return ResponseHelper.success(res, {
      message: 'Lấy chi tiết đề xuất thành công',
      data: result,
    });
  });

  approveProposal = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const params = req.params as ProposalIdParams;
    const body = req.body as ApproveProposalBody;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const adminId = user.id;
    let editedData;
    try {
      editedData = {
        data_danh_hieu: JSON.parse(body.data_danh_hieu || '[]'),
        data_thanh_tich: JSON.parse(body.data_thanh_tich || '[]'),
        data_nien_han: JSON.parse(body.data_nien_han || '[]'),
        data_cong_hien: JSON.parse(body.data_cong_hien || '[]'),
      };
    } catch {
      return ResponseHelper.badRequest(res, 'Dữ liệu không hợp lệ');
    }
    const decisions = {
      so_quyet_dinh_ca_nhan_hang_nam: body.so_quyet_dinh_ca_nhan_hang_nam,
      so_quyet_dinh_don_vi_hang_nam: body.so_quyet_dinh_don_vi_hang_nam,
      so_quyet_dinh_nien_han: body.so_quyet_dinh_nien_han,
      so_quyet_dinh_cong_hien: body.so_quyet_dinh_cong_hien,
      so_quyet_dinh_dot_xuat: body.so_quyet_dinh_dot_xuat,
      so_quyet_dinh_nckh: body.so_quyet_dinh_nckh,
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
      body.ghi_chu || null
    );
    try {
      await notificationHelper.notifyManagerOnProposalApproval(result.proposal, user);
    } catch (notifError) {
      await writeSystemLog({
        userId: user.id,
        userRole: user.role,
        action: 'ERROR',
        resource: 'proposals',
        description: 'Lỗi gửi thông báo cho Manager khi duyệt đề xuất',
        payload: { error: String(notifError) },
      });
    }
    try {
      if (result.affectedPersonnelIds?.length > 0) {
        await notificationHelper.notifyUsersOnAwardApproved(
          result.affectedPersonnelIds as string[],
          result.proposal,
          user.username
        );
      }
    } catch (notifError) {
      await writeSystemLog({
        userId: user.id,
        userRole: user.role,
        action: 'ERROR',
        resource: 'proposals',
        description: 'Lỗi gửi thông báo cho quân nhân khi duyệt khen thưởng',
        payload: { error: String(notifError) },
      });
    }
    return ResponseHelper.success(res, {
      message: result.message,
      data: { ...result.result, proposal: result.proposal },
    });
  });

  getPdfFile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as GetPdfFileParams;
    const filename = decodeURIComponent(
      Array.isArray(params.filename) ? params.filename[0] : String(params.filename ?? '')
    );
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return ResponseHelper.badRequest(res, 'Tên file không hợp lệ');
    }
    const result = await proposalService.getPdfFile(filename);
    setFileSendHeaders(res, result.filename, 'inline');
    return res.sendFile(result.filePath);
  });

  rejectProposal = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const params = req.params as ProposalIdParams;
    const body = req.body as RejectProposalBody;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { ghi_chu, ly_do } = body;
    const rejectReason = ghi_chu || ly_do;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    if (!rejectReason || rejectReason.trim() === '') {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập lý do từ chối');
    }
    const result = await proposalService.rejectProposal(String(id), rejectReason, user.id);
    try {
      await notificationHelper.notifyManagerOnProposalRejection(
        result.proposal,
        user,
        rejectReason
      );
    } catch (notifError) {
      await writeSystemLog({
        userId: user.id,
        userRole: user.role,
        action: 'ERROR',
        resource: 'proposals',
        description: 'Lỗi gửi thông báo cho Manager khi từ chối đề xuất',
        payload: { error: String(notifError) },
      });
    }
    return ResponseHelper.success(res, {
      message: result.message,
      data: { ...result.result, proposal: result.proposal },
    });
  });

  downloadProposalExcel = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as ProposalIdParams;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
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
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { don_vi_id, nam, danh_hieu } = query;
    const { page, limit } = parsePagination(query);
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      const uid = managerUnitFilterId(userWithUnit.QuanNhan);
      if (uid) filters.don_vi_id = uid;
    }
    const result = await proposalService.getAllAwards(filters, page, limit);
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách khen thưởng thành công',
      data: result,
    });
  });


  exportAllAwardsExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { don_vi_id, nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
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
    const user = req.user!;
    const params = req.params as ProposalIdParams;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const result = await proposalService.deleteProposal(id, user.id, user.role);
    await writeSystemLog({
      userId: user.id,
      userRole: user.role,
      action: AUDIT_ACTIONS.DELETE,
      resource: 'proposals',
      resourceId: id,
      description: `Xóa đề xuất khen thưởng ID ${id} - Đơn vị: ${(result.proposal as { don_vi?: string }).don_vi}`,
      payload: {
        proposal_id: id,
        don_vi: (result.proposal as { don_vi?: string }).don_vi,
        status: result.proposal.status,
      },
    });
    return ResponseHelper.success(res, { message: result.message, data: result.proposal });
  });

  getAwardsStatistics = catchAsync(async (req: Request, res: Response) => {
    return ResponseHelper.success(res, {
      message: 'Lấy thống kê khen thưởng thành công',
      data: await proposalService.getAwardsStatistics(),
    });
  });

  checkDuplicateAward = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as CheckDuplicateAwardQuery;
    const { personnel_id, nam, danh_hieu, proposal_type } = query;
    if (!personnel_id || !nam || !danh_hieu || !proposal_type) {
      return ResponseHelper.badRequest(
        res,
        'Thiếu thông tin: quân nhân, năm, danh hiệu và loại đề xuất'
      );
    }
    const namNumber = parseYearQuery(nam);
    if (namNumber === null) {
      return ResponseHelper.badRequest(res, 'Năm không hợp lệ');
    }
    return ResponseHelper.success(res, {
      data: await proposalService.checkDuplicateAward(
        personnel_id as string,
        namNumber,
        danh_hieu as string,
        proposal_type as string
      ),
    });
  });

  checkDuplicateUnitAward = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as CheckDuplicateUnitAwardQuery;
    const { don_vi_id, nam, danh_hieu, proposal_type } = query;
    if (!don_vi_id || !nam || !danh_hieu || !proposal_type) {
      return ResponseHelper.badRequest(
        res,
        'Thiếu thông tin: đơn vị, năm, danh hiệu và loại đề xuất'
      );
    }
    const namNumber = parseYearQuery(nam);
    if (namNumber === null) {
      return ResponseHelper.badRequest(res, 'Năm không hợp lệ');
    }
    return ResponseHelper.success(res, {
      data: await proposalService.checkDuplicateUnitAward(
        don_vi_id as string,
        namNumber,
        danh_hieu as string,
        proposal_type as string
      ),
    });
  });

  checkDuplicateBatch = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CheckDuplicatePersonnelBatchBody;
    const { items } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Danh sách kiểm tra không hợp lệ');
    }
    return ResponseHelper.success(res, {
      data: await proposalService.checkDuplicateBatch(items),
    });
  });

  checkDuplicateUnitBatch = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CheckDuplicateUnitBatchBody;
    const { items } = body;
    if (!Array.isArray(items) || items.length === 0) {
      return ResponseHelper.badRequest(res, 'Danh sách kiểm tra không hợp lệ');
    }
    return ResponseHelper.success(res, {
      data: await proposalService.checkDuplicateUnitBatch(items),
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
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Huy chương Chiến sĩ Vẻ vang thành công',
      data: await hccsvvService.importFromExcel(file.buffer, user.id),
    });
  });

  getAllHCCSVV = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { don_vi_id, nam, danh_hieu } = query;
    const { page, limit } = parsePagination(query);
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách HCCSVV thành công',
      data: await hccsvvService.getAll(filters, page, limit),
    });
  });

  exportHCCSVVExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { don_vi_id, nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
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
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Huân chương Bảo vệ Tổ quốc thành công',
      data: await (async () => {
        const preview = await contributionAwardService.previewImport(file.buffer);
        return contributionAwardService.confirmImport(preview.valid, user.id);
      })(),
    });
  });

  getAllContributionAwards = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { don_vi_id, nam, danh_hieu } = query;
    const { page, limit } = parsePagination(query);
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách HCBVTQ thành công',
      data: await contributionAwardService.getAll(filters, page, limit),
    });
  });

  exportContributionAwardsExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { don_vi_id, nam, danh_hieu } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (danh_hieu) filters.danh_hieu = danh_hieu;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
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
      `attachment; filename="mau_import_knc_vsnxd_qdndvn_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  });

  importCommemorativeMedals = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const file = req.file;
    if (!file) {
      return ResponseHelper.badRequest(res, 'Vui lòng gửi file Excel');
    }
    return ResponseHelper.success(res, {
      message: 'Import Kỷ niệm chương thành công',
      data: await commemorativeMedalService.importFromExcel(file.buffer, user.id),
    });
  });

  getAllCommemorativeMedals = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as UnitYearFilterQuery;
    const { don_vi_id, nam } = query;
    const { page, limit } = parsePagination(query);
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách Kỷ niệm chương thành công',
      data: await commemorativeMedalService.getAll(filters, page, limit),
    });
  });

  exportCommemorativeMedalsExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as UnitYearFilterQuery;
    const { don_vi_id, nam } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
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

  getAllMilitaryFlag = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as UnitYearFilterQuery;
    const { don_vi_id, nam } = query;
    const { page, limit } = parsePagination(query);
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
    }
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách HCQKQT thành công',
      data: await militaryFlagService.getAll(filters, page, limit),
    });
  });

  exportMilitaryFlagExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as UnitYearFilterQuery;
    const { don_vi_id, nam } = query;
    const filters: Record<string, unknown> = {};
    if (don_vi_id) filters.don_vi_id = don_vi_id;
    if (nam) filters.nam = nam;
    if (user.role === ROLES.MANAGER) {
      const userWithUnit = await proposalService.getUserWithUnit(user.id);
      if (!userWithUnit?.QuanNhan) {
        return ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
      }
      filters.don_vi_id = managerUnitFilterId(userWithUnit.QuanNhan);
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
