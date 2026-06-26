import { danhHieuHangNamRepository } from '../../../repositories/danhHieu.repository';
import { Request, Response } from 'express';
import { FALLBACK, getFileName } from '../constants';
import { getDanhHieuName, resolveDanhHieuFromRecord } from '../../../constants/danhHieu.constants';
import { routeParamId, DanhHieuHangNamWithHoTen } from './shared';
import { quanNhanRepository } from '../../../repositories/quanNhan.repository';

// Sinh mô tả audit log cho danh hiệu cá nhân hằng năm theo từng hành động.

/**
 * Map hành động (CREATE/UPDATE/DELETE/BULK/IMPORT) sang hàm tạo mô tả audit log
 * cho danh hiệu cá nhân hằng năm.
 * @param req - Request chứa body/params của thao tác
 * @param res - Response của thao tác
 * @param responseData - Dữ liệu trả về để trích tên quân nhân, danh hiệu, năm
 * @returns Chuỗi mô tả tiếng Việt ghi vào nhật ký hệ thống
 */
export const annualRewards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const personnelId = req.body?.personnel_id || req.body?.quan_nhan_id || null;

    const danhHieuName = getDanhHieuName(danhHieu);

    let hoTen = '';
    if (personnelId) {
      try {
        const personnel = await quanNhanRepository.findUniqueRaw({
          where: { id: personnelId },
          select: { ho_ten: true },
        });
        hoTen = personnel?.ho_ten || '';
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // Best-effort — mô tả audit log không được phép throw
      }
    }

    // Ưu tiên tên quân nhân từ dữ liệu trả về nếu có
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // Best-effort — mô tả audit log không được phép throw
    }

    const xepLoai = req.body?.xep_loai || '';
    const namDisplay = nam || FALLBACK.UNKNOWN;
    let description = `Tạo danh hiệu hằng năm: ${danhHieuName}${
      hoTen ? ` cho quân nhân ${hoTen}` : ''
    } - Năm ${namDisplay}`;
    if (xepLoai) {
      description += `\n- Xếp loại: ${xepLoai}`;
    }
    return description;
  },
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const rewardId = routeParamId(req.params?.id);

    const danhHieuName = getDanhHieuName(danhHieu);

    let hoTen = '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      } else if (rewardId) {
        // Dữ liệu trả về thiếu tên thì tra ngược theo id bản ghi
        const rewardRecord = (await danhHieuHangNamRepository.findUnique({
          where: { id: rewardId },
          include: { QuanNhan: { select: { ho_ten: true } } },
        })) as DanhHieuHangNamWithHoTen | null;
        hoTen = rewardRecord?.QuanNhan?.ho_ten || '';
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // Best-effort — mô tả audit log không được phép throw
    }

    const xepLoai = req.body?.xep_loai || '';
    const namDisplay = nam || FALLBACK.UNKNOWN;
    let description = `Cập nhật danh hiệu hằng năm: ${danhHieuName}${
      hoTen ? ` cho quân nhân ${hoTen}` : ''
    } - Năm ${namDisplay}`;
    if (xepLoai) {
      description += `\n- Xếp loại: ${xepLoai}`;
    }
    return description;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    let hoTen = '';
    let danhHieu = '';
    let nam = '';

    // Lấy thông tin từ dữ liệu trả về, không truy vấn lại vì bản ghi đã bị xóa
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      }
      danhHieu = resolveDanhHieuFromRecord(reward) || danhHieu;
      if (reward?.nam) {
        nam = reward.nam;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // Best-effort — mô tả audit log không được phép throw
    }

    const danhHieuName = getDanhHieuName(danhHieu);

    if (hoTen && danhHieu) {
      return `Xóa danh hiệu hằng năm: ${danhHieuName} của quân nhân ${hoTen}${
        nam ? ` (năm ${nam})` : ''
      }`;
    }

    return `Xóa danh hiệu hằng năm (không xác định được thông tin)`;
  },
  BULK: (req: Request, res: Response, responseData: unknown): string => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    let personnelCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Đếm số quân nhân được chọn để thêm đồng loạt
    try {
      const personnelIds =
        typeof req.body?.personnel_ids === 'string'
          ? JSON.parse(req.body.personnel_ids)
          : req.body?.personnel_ids;
      personnelCount = Array.isArray(personnelIds) ? personnelIds.length : 0;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // Best-effort — mô tả audit log không được phép throw
    }

    // Đếm kết quả thực tế từ dữ liệu trả về
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data || data;
      successCount = result?.success || result?.successCount || 0;
      skippedCount = result?.skipped || 0;
      errorCount = result?.errors || 0;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // Best-effort — mô tả audit log không được phép throw
    }

    const danhHieuName = getDanhHieuName(danhHieu);
    const namDisplay = nam || FALLBACK.UNKNOWN;

    let description = `Thêm đồng loạt danh hiệu hằng năm: ${danhHieuName} - Năm ${namDisplay}`;

    if (successCount > 0 || personnelCount > 0) {
      const parts: string[] = [];
      if (successCount > 0) {
        parts.push(`${successCount} thành công`);
      }
      if (skippedCount > 0) {
        parts.push(`${skippedCount} bỏ qua`);
      }
      if (errorCount > 0) {
        parts.push(`${errorCount} lỗi`);
      }
      if (parts.length > 0) {
        description += ` (${parts.join(', ')}`;
        if (personnelCount > 0) {
          description += ` / ${personnelCount} quân nhân`;
        }
        description += ')';
      } else if (personnelCount > 0) {
        description += ` (${personnelCount} quân nhân)`;
      }
    }

    return description;
  },
  IMPORT: (req: Request, res: Response, responseData: unknown): string => {
    const fileName = getFileName(req);
    let successCount = 0;
    let failCount = 0;

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data || data;
      successCount = result?.success || result?.successCount || result?.total || 0;
      failCount = result?.failed || result?.failCount || 0;

      if (successCount > 0 || failCount > 0) {
        return `Nhập dữ liệu danh hiệu hằng năm từ file: ${fileName} (${successCount} thành công${
          failCount > 0 ? `, ${failCount} thất bại` : ''
        })`;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // Best-effort — mô tả audit log không được phép throw
    }

    return `Nhập dữ liệu danh hiệu hằng năm từ file: ${fileName}`;
  },
};
