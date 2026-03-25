import { Request, Response } from 'express';
import decisionService from '../services/decision.service';
import { parsePagination, normalizeParam } from '../helpers/paginationHelper';
import ResponseHelper from '../helpers/responseHelper';
import catchAsync from '../helpers/catchAsync';
import { setFileSendHeaders } from '../helpers/fileResponseHeaders';

class DecisionController {
  getAllDecisions = catchAsync(async (req: Request, res: Response) => {
    const { page, limit } = parsePagination(req.query);
    const { nam, loai_khen_thuong, search } = req.query;

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
    const { q, limit = 10 } = req.query;
    if (!q) return ResponseHelper.badRequest(res, 'Vui lòng nhập từ khóa tìm kiếm (q)');

    const decisions = await decisionService.autocomplete(q as string, parseInt(limit as string));
    return ResponseHelper.success(res, {
      data: decisions,
      message: 'Tìm kiếm quyết định thành công',
    });
  });

  getDecisionById = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const decision = await decisionService.getDecisionById(id);
    return ResponseHelper.success(res, {
      data: decision,
      message: 'Lấy thông tin quyết định thành công',
    });
  });

  getDecisionBySoQuyetDinh = catchAsync(async (req: Request, res: Response) => {
    const soQuyetDinh = normalizeParam(req.params.soQuyetDinh);
    if (!soQuyetDinh) return ResponseHelper.badRequest(res, 'Thiếu soQuyetDinh');

    const decision = await decisionService.getDecisionBySoQuyetDinh(soQuyetDinh);
    if (!decision) return ResponseHelper.notFound(res, 'Không tìm thấy quyết định');

    return ResponseHelper.success(res, {
      data: decision,
      message: 'Lấy thông tin quyết định thành công',
    });
  });

  createDecision = catchAsync(async (req: Request, res: Response) => {
    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, loai_khen_thuong, ghi_chu } = req.body;
    if (!so_quyet_dinh || !nam || !ngay_ky || !nguoi_ky) {
      return ResponseHelper.badRequest(
        res,
        'Vui lòng nhập đầy đủ thông tin bắt buộc: số quyết định, năm, ngày ký, người ký'
      );
    }

    const file_path = req.file ? `uploads/decisions/${req.file.filename}` : null;
    const decision = await decisionService.createDecision({
      so_quyet_dinh,
      nam,
      ngay_ky,
      nguoi_ky,
      file_path,
      loai_khen_thuong,
      ghi_chu,
    });
    return ResponseHelper.created(res, { data: decision, message: 'Tạo quyết định thành công' });
  });

  updateDecision = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const { so_quyet_dinh, nam, ngay_ky, nguoi_ky, loai_khen_thuong, ghi_chu } = req.body;
    let file_path = req.body.file_path;
    if (req.file) file_path = `uploads/decisions/${req.file.filename}`;

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

    const decision = await decisionService.updateDecision(id, {
      so_quyet_dinh,
      nam,
      ngay_ky,
      nguoi_ky,
      file_path,
      loai_khen_thuong,
      ghi_chu,
    });
    return ResponseHelper.success(res, {
      data: decision,
      message: 'Cập nhật quyết định thành công',
    });
  });

  deleteDecision = catchAsync(async (req: Request, res: Response) => {
    const id = normalizeParam(req.params.id);
    if (!id) return ResponseHelper.badRequest(res, 'Thiếu id');

    const result = await decisionService.deleteDecision(id);
    return ResponseHelper.success(res, { message: result.message });
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
    const raw = normalizeParam(req.params.soQuyetDinh);
    if (!raw) return ResponseHelper.badRequest(res, 'Thiếu soQuyetDinh');

    const result = await decisionService.getFilePathBySoQuyetDinh(decodeURIComponent(raw));
    if (!result.success) {
      return res
        .status(result.decision ? 200 : 404)
        .json({ success: false, message: result.error, data: result.decision });
    }
    return ResponseHelper.success(res, {
      data: { file_path: result.file_path, decision: result.decision },
      message: 'Lấy file path thành công',
    });
  });

  getFilePaths = catchAsync(async (req: Request, res: Response) => {
    const { soQuyetDinhs } = req.body;
    if (!Array.isArray(soQuyetDinhs)) {
      return ResponseHelper.badRequest(res, 'soQuyetDinhs phải là một mảng');
    }
    const result = await decisionService.getFilePathsBySoQuyetDinhs(soQuyetDinhs);
    return ResponseHelper.success(res, { data: result, message: 'Lấy file paths thành công' });
  });

  downloadDecisionFile = catchAsync(async (req: Request, res: Response) => {
    const raw = normalizeParam(req.params.soQuyetDinh);
    if (!raw) return ResponseHelper.badRequest(res, 'Thiếu soQuyetDinh');

    const decodedSoQuyetDinh = decodeURIComponent(raw);
    if (
      decodedSoQuyetDinh.includes('..') ||
      decodedSoQuyetDinh.includes('/') ||
      decodedSoQuyetDinh.includes('\\')
    ) {
      return ResponseHelper.badRequest(res, 'Tên file không hợp lệ');
    }

    const result = await decisionService.getDecisionFileForDownload(decodedSoQuyetDinh);
    if (!result.success) {
      return ResponseHelper.notFound(res, result.error ?? 'Không tìm thấy file quyết định');
    }

    setFileSendHeaders(res, result.filename, 'attachment');
    return res.sendFile(result.filePath);
  });
}

export default new DecisionController();
