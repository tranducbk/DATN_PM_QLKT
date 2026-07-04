import { Request, Response } from 'express';
import decisionService from '../services/decision.service';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { buildSignedFileUrl } from '../helpers/file/signedFileUrl';
import { persistDecisionFile, deleteStoredFile } from '../helpers/file/fileStorage';
import { PROPOSAL_TYPES } from '../constants/proposalTypes.constants';

interface GetAllDecisionsQuery {
  nam?: number;
  loai_khen_thuong?: string;
  search?: string;
  [key: string]: unknown;
}

interface AutocompleteQuery {
  q?: string;
  limit?: number;
  loai_khen_thuong?: string;
}

interface IdParams {
  id?: string;
}

interface SoQuyetDinhParams {
  soQuyetDinh?: string;
}

interface CreateDecisionBody {
  so_quyet_dinh?: string;
  nam?: number;
  ngay_ky?: string;
  nguoi_ky?: string;
  loai_khen_thuong?: string;
  ghi_chu?: string;
}

interface UpdateDecisionBody {
  so_quyet_dinh?: string;
  nam?: number;
  ngay_ky?: string;
  nguoi_ky?: string;
  loai_khen_thuong?: string;
  ghi_chu?: string;
  file_path?: string | null;
}

interface GetFilePathsBody {
  soQuyetDinhs?: string[];
}

class DecisionController {
  getAllDecisions = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as GetAllDecisionsQuery;
    const { page, limit } = parsePagination(query);
    const { nam, loai_khen_thuong, search } = query;

    const filters: Record<string, unknown> = {};
    if (nam) filters.nam = nam;
    if (loai_khen_thuong) filters.loai_khen_thuong = loai_khen_thuong;
    if (search) filters.search = search;

    const result = await decisionService.getAllDecisions(filters, page, limit);
    return ResponseHelper.paginated(res, {
      data: result.decisions,
      total: result.pagination.total,
      page,
      limit,
      message: 'Lấy danh sách quyết định thành công',
    });
  });

  autocomplete = catchAsync(async (req: Request, res: Response) => {
    const query = req.query as AutocompleteQuery;
    const { q, limit = 10, loai_khen_thuong } = query;
    if (!q) return ResponseHelper.badRequest(res, 'Vui lòng nhập từ khóa tìm kiếm (q)');

    const decisions = await decisionService.autocomplete(q, Number(limit), loai_khen_thuong);
    return ResponseHelper.success(res, {
      data: decisions,
      message: 'Tìm kiếm quyết định thành công',
    });
  });

  getDecisionById = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const decision = await decisionService.getDecisionById(id);
    return ResponseHelper.success(res, {
      data: decision,
      message: 'Lấy thông tin quyết định thành công',
    });
  });

  getDecisionBySoQuyetDinh = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as SoQuyetDinhParams;
    const soQuyetDinh = normalizeParam(params.soQuyetDinh);
    if (!soQuyetDinh) return ResponseHelper.badRequest(res, 'Thiếu soQuyetDinh');

    const decision = await decisionService.getDecisionBySoQuyetDinh(soQuyetDinh);
    if (!decision) return ResponseHelper.notFound(res, 'Không tìm thấy quyết định');

    return ResponseHelper.success(res, {
      data: decision,
      message: 'Lấy thông tin quyết định thành công',
    });
  });

  createDecision = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as CreateDecisionBody;
    const file = req.file;
    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, loai_khen_thuong, ghi_chu } = body;
    if (!so_quyet_dinh || !nam || !ngay_ky || !nguoi_ky) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin bắt buộc: số quyết định, năm, ngày ký, người ký'
      );
    }

    if (loai_khen_thuong && !Object.values(PROPOSAL_TYPES).includes(loai_khen_thuong as any)) {
      return ResponseHelper.badRequest(res, 'Loại khen thưởng không hợp lệ');
    }

    const ngayKyDate = typeof ngay_ky === 'string' ? new Date(ngay_ky) : ngay_ky;
    const file_path = file?.buffer ? await persistDecisionFile(file) : null;
    try {
      const decision = await decisionService.createDecision({
        so_quyet_dinh,
        nam,
        ngay_ky: ngayKyDate,
        nguoi_ky,
        file_path,
        loai_khen_thuong,
        ghi_chu,
      });
      return ResponseHelper.created(res, { data: decision, message: 'Tạo quyết định thành công' });
    } catch (e) {
      if (file_path) await deleteStoredFile(file_path);
      throw e;
    }
  });

  updateDecision = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const body = req.body as UpdateDecisionBody;
    const file = req.file;
    const id = normalizeParam(params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, loai_khen_thuong, ghi_chu } = body;
    if (loai_khen_thuong && !Object.values(PROPOSAL_TYPES).includes(loai_khen_thuong as any)) {
      return ResponseHelper.badRequest(res, 'Loại khen thưởng không hợp lệ');
    }

    let file_path = body.file_path;
    let newlyPersisted: string | null = null;
    if (file?.buffer) {
      newlyPersisted = await persistDecisionFile(file);
      file_path = newlyPersisted;
    }

    if (
      !so_quyet_dinh &&
      !nam &&
      !ngay_ky &&
      !nguoi_ky &&
      file_path === undefined &&
      loai_khen_thuong === undefined &&
      ghi_chu === undefined
    ) {
      return ResponseHelper.badRequest(res, 'Vui lòng cung cấp thông tin cần cập nhật');
    }

    try {
      const decision = await decisionService.updateDecision(id, {
        so_quyet_dinh,
        nam,
        ngay_ky: ngay_ky ? new Date(ngay_ky) : undefined,
        nguoi_ky,
        file_path,
        loai_khen_thuong,
        ghi_chu,
      });
      return ResponseHelper.success(res, {
        data: decision,
        message: 'Cập nhật quyết định thành công',
      });
    } catch (e) {
      if (newlyPersisted) await deleteStoredFile(newlyPersisted);
      throw e;
    }
  });

  deleteDecision = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as IdParams;
    const id = normalizeParam(params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const result = await decisionService.deleteDecision(id);
    return ResponseHelper.success(res, { message: result.message, data: result.decision });
  });

  getAvailableYears = catchAsync(async (req: Request, res: Response) => {
    const years = await decisionService.getAvailableYears();
    return ResponseHelper.success(res, { data: years, message: 'Lấy danh sách năm thành công' });
  });

  getAwardTypes = catchAsync(async (req: Request, res: Response) => {
    const types = await decisionService.getAwardTypes();
    return ResponseHelper.success(res, {
      data: types,
      message: 'Lấy danh sách loại khen thưởng thành công',
    });
  });

  getFilePath = catchAsync(async (req: Request, res: Response) => {
    const params = req.params as SoQuyetDinhParams;
    const raw = normalizeParam(params.soQuyetDinh);
    if (!raw) return ResponseHelper.badRequest(res, 'Thiếu soQuyetDinh');

    const result = await decisionService.getFilePathBySoQuyetDinh(decodeURIComponent(raw));
    if (!result.success) {
      return res
        .status(result.decision ? 200 : 404)
        .json({ success: false, message: result.error, data: result.decision });
    }
    return ResponseHelper.success(res, {
      data: {
        file_path: result.file_path,
        view_url: result.file_path ? buildSignedFileUrl(result.file_path) : null,
        decision: result.decision,
      },
      message: 'Lấy file path thành công',
    });
  });

  getFilePaths = catchAsync(async (req: Request, res: Response) => {
    const body = req.body as GetFilePathsBody;
    const { soQuyetDinhs } = body;
    if (!Array.isArray(soQuyetDinhs)) {
      return ResponseHelper.badRequest(res, 'soQuyetDinhs phải là một mảng');
    }
    const result = await decisionService.getFilePathsBySoQuyetDinhs(soQuyetDinhs);
    return ResponseHelper.success(res, { data: result, message: 'Lấy file paths thành công' });
  });
}

export default new DecisionController();
