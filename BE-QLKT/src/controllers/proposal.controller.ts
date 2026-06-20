import { Request, Response } from 'express';
import proposalService from '../services/proposal';
import * as notificationHelper from '../helpers/notification';
import { ROLES } from '../constants/roles.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import {
  PROPOSAL_TYPES,
  requiresProposalMonth,
  type ProposalType,
} from '../constants/proposalTypes.constants';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { parsePagination } from '../helpers/paginationHelper';
import { setFileSendHeaders } from '../helpers/file/fileResponseHeaders';
import { resolveIdParam } from '../helpers/controllerHelper';
import {
  applyManagerUnitFilter,
  buildAwardFilters,
  parseApproveBody,
  parseYearQuery,
  safeNotify,
  sendExcelResponse,
} from './proposal/helpers';
import type {
  ApproveProposalBody,
  AwardFilterInput,
  AwardsFilterQuery,
  CheckDuplicateAwardQuery,
  CheckDuplicatePersonnelBatchBody,
  CheckDuplicateUnitAwardQuery,
  CheckDuplicateUnitBatchBody,
  GetPdfFileParams,
  GetProposalsQuery,
  ParsedApproveBody,
  ProposalIdParams,
  RejectProposalBody,
  SubmitProposalBody,
} from './proposal/types';

const ALL_PROPOSAL_TYPES = Object.values(PROPOSAL_TYPES);

/**
 * Builds the award filter map and applies MANAGER unit scoping. Sends a 403 and
 * returns null when the manager's unit cannot be resolved — callers `return` on null.
 * @param user - Authenticated user
 * @param query - Award filter query
 * @param res - Response (used only to emit the 403)
 * @returns Filter map, or null when forbidden
 */
async function resolveAwardFilters(
  user: { role: string; id: string },
  query: AwardFilterInput,
  res: Response
): Promise<Record<string, unknown> | null> {
  const filters = buildAwardFilters(query);
  const unitResult = await applyManagerUnitFilter(user, filters, id =>
    proposalService.getUserWithUnit(id)
  );
  if (unitResult === 'forbidden') {
    ResponseHelper.forbidden(res, 'Không tìm thấy thông tin đơn vị');
    return null;
  }
  return filters;
}

class ProposalController {
  submitProposal = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const body = req.body as SubmitProposalBody;
    const userId = user.id;
    const userRole = user.role;
    const { type = PROPOSAL_TYPES.CA_NHAN_HANG_NAM, title_data, nam, thang, ghi_chu } = body;
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
    } catch {
      return ResponseHelper.badRequest(res, 'Dữ liệu title_data không hợp lệ');
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const attachedFiles = files?.attached_files || [];
    const parsedMonthRaw = typeof thang === 'string' ? parseInt(thang, 10) : Number(thang);
    const parsedMonth = Number.isInteger(parsedMonthRaw) ? parsedMonthRaw : null;
    if (
      requiresProposalMonth(type as ProposalType) &&
      (parsedMonth === null || parsedMonth < 1 || parsedMonth > 12)
    ) {
      return ResponseHelper.badRequest(
        res,
        'Tháng là bắt buộc cho đề xuất HCCSVV/HCQKQT/KNC và phải nằm trong khoảng 1-12'
      );
    }

    const result = await proposalService.submitProposal(
      titleDataParsed,
      attachedFiles,
      userId,
      type,
      typeof nam === 'string' ? parseInt(nam, 10) : Number(nam),
      ghi_chu,
      parsedMonth
    );
    void safeNotify(
      {
        userId: user.id,
        userRole: user.role,
        resource: RESOURCE_SLUGS.PROPOSALS,
        description: 'Lỗi gửi thông báo cho Admin khi nộp đề xuất',
      },
      () => notificationHelper.notifyAdminsOnProposalSubmission(result.proposal, user)
    );
    return ResponseHelper.created(res, { message: result.message, data: result.proposal });
  });

  getProposals = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as GetProposalsQuery;
    const { page, limit } = parsePagination(query);
    const result = await proposalService.getProposals(user.id, user.role, page, limit);
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
    const id = resolveIdParam(params.id);
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
    const id = resolveIdParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    let parsed: ParsedApproveBody;
    try {
      parsed = parseApproveBody(body, files);
    } catch (error) {
      console.error('Failed to parse approveProposal payload JSON:', error);
      return ResponseHelper.badRequest(res, 'Dữ liệu không hợp lệ');
    }
    const result = await proposalService.approveProposal(
      String(id),
      parsed.editedData,
      user.id,
      parsed.decisions,
      parsed.pdfFiles,
      body.ghi_chu || null,
      parsed.adminAttachedFiles
    );
    void safeNotify(
      {
        userId: user.id,
        userRole: user.role,
        resource: RESOURCE_SLUGS.PROPOSALS,
        description: 'Lỗi gửi thông báo cho Manager khi duyệt đề xuất',
      },
      () => notificationHelper.notifyManagerOnProposalApproval(result.proposal, user)
    );
    if (result.affectedPersonnelIds?.length > 0) {
      void safeNotify(
        {
          userId: user.id,
          userRole: user.role,
          resource: RESOURCE_SLUGS.PROPOSALS,
          description: 'Lỗi gửi thông báo cho quân nhân khi duyệt khen thưởng',
        },
        () =>
          notificationHelper.notifyUsersOnAwardApproved(
            result.affectedPersonnelIds as string[],
            result.proposal,
            user.username
          )
      );
    }
    return ResponseHelper.success(res, {
      message: result.message,
      data: result.result,
    });
  });

  getPdfFile = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as GetPdfFileParams;
    const filename = decodeURIComponent(resolveIdParam(params.filename || ''));
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
    const id = resolveIdParam(params.id);
    const { ghi_chu, ly_do } = body;
    const rejectReason = ghi_chu || ly_do;
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    if (!rejectReason || rejectReason.trim() === '') {
      return ResponseHelper.badRequest(res, 'Vui lòng nhập lý do từ chối');
    }
    const result = await proposalService.rejectProposal(String(id), rejectReason, user.id);
    void safeNotify(
      {
        userId: user.id,
        userRole: user.role,
        resource: RESOURCE_SLUGS.PROPOSALS,
        description: 'Lỗi gửi thông báo cho Manager khi từ chối đề xuất',
      },
      () => notificationHelper.notifyManagerOnProposalRejection(result.proposal, user, rejectReason)
    );
    return ResponseHelper.success(res, {
      message: result.message,
      data: result.result,
    });
  });

  getAllAwards = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const { page, limit } = parsePagination(query);
    const filters = await resolveAwardFilters(user, query, res);
    if (!filters) return;
    const result = await proposalService.getAllAwards(filters, page, limit);
    return ResponseHelper.success(res, {
      message: 'Lấy danh sách khen thưởng thành công',
      data: result,
    });
  });

  exportAllAwardsExcel = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const query = req.query as AwardsFilterQuery;
    const filters = await resolveAwardFilters(user, query, res);
    if (!filters) return;
    const buffer = await proposalService.exportAllAwardsExcel(filters);
    sendExcelResponse(res, buffer, 'danh_sach_khen_thuong');
  });

  deleteProposal = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const params = req.params as ProposalIdParams;
    const id = resolveIdParam(params.id);
    if (!id) {
      return ResponseHelper.badRequest(res, 'ID đề xuất không hợp lệ');
    }
    const result = await proposalService.deleteProposal(id, user.id, user.role);
    void safeNotify(
      {
        userId: user.id,
        userRole: user.role,
        resource: RESOURCE_SLUGS.PROPOSALS,
        description: 'Lỗi gửi thông báo khi xóa đề xuất',
      },
      () =>
        notificationHelper.notifyOnProposalDeletion(
          {
            id: result.proposal.id,
            loai_de_xuat: result.proposal.loai_de_xuat,
            nguoi_de_xuat_id: result.proposal.nguoi_de_xuat_id ?? undefined,
          },
          user
        )
    );
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
}

export default new ProposalController();
