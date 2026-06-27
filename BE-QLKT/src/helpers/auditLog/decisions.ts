// Dựng mô tả nhật ký kiểm toán cho quyết định khen thưởng (FileQuyetDinh, PDF).
import { Request, Response } from 'express';
import { FALLBACK, parseResponseData, formatDate, asRecord } from './constants';
import { LOAI_DE_XUAT_MAP } from '../../constants/danhHieu.constants';
import type { ProposalType } from '../../constants/proposalTypes.constants';

const getLoaiName = (loaiQuyetDinh: string): string => {
  if (!loaiQuyetDinh) return '';
  return LOAI_DE_XUAT_MAP[loaiQuyetDinh as ProposalType] || loaiQuyetDinh;
};

interface CascadeSummaryShape {
  proposalsScanned?: number;
  proposalsUpdated?: number;
}

const formatCascadeSummary = (cascade: CascadeSummaryShape): string => {
  const proposalsUpdated = cascade.proposalsUpdated ?? 0;
  // Bảng khen thưởng tự cập nhật qua ON UPDATE CASCADE; chỉ payload JSON của đề xuất mới cần đổi tay.
  if (proposalsUpdated === 0) {
    return '\n- Cascade: Bảng khen thưởng tự cập nhật qua FK; không có đề xuất chờ duyệt nào tham chiếu số cũ';
  }
  return `\n- Cascade cập nhật: ${proposalsUpdated} đề xuất đang chờ duyệt (bảng khen thưởng tự cập nhật qua FK)`;
};

/**
 * Map action (CREATE/UPDATE/DELETE) -> hàm dựng mô tả nhật ký cho quyết định khen thưởng.
 * @param req - Request chứa số quyết định, loại khen thưởng, năm, ngày ký trong body
 * @param res - Response (chưa dùng đến, giữ cho đúng chữ ký builder)
 * @param responseData - Dữ liệu trả về của controller, dùng lấy thông tin quyết định
 * @returns Chuỗi mô tả hành động để lưu vào nhật ký kiểm toán
 */
const decisions: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  CREATE: (req: Request, res: Response, responseData: unknown): string => {
    const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
    const loaiKhenThuong = req.body?.loai_khen_thuong || '';
    const nam = req.body?.nam;
    const ngayKy = req.body?.ngay_ky;
    const loaiName = getLoaiName(loaiKhenThuong);

    let description = `Tạo quyết định: ${soQuyetDinh}${loaiName ? ` (${loaiName})` : ''}`;
    if (nam) description += `\n- Năm: ${nam}`;
    if (ngayKy) description += `\n- Ngày ký: ${formatDate(ngayKy)}`;
    return description;
  },
  UPDATE: (req: Request, res: Response, responseData: unknown): string => {
    const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
    const loaiKhenThuong = req.body?.loai_khen_thuong || '';
    const nam = req.body?.nam;
    const parsed = parseResponseData(responseData);
    const decision = asRecord(parsed?.data) || parsed;

    const resolvedSoQD = (decision?.so_quyet_dinh as string) || soQuyetDinh;
    const resolvedLoai = loaiKhenThuong || (decision?.loai_khen_thuong as string) || '';
    const resolvedNam = nam || (decision?.nam as number) || '';
    const loaiName = getLoaiName(resolvedLoai);
    const cascade = asRecord(decision?.cascade) as CascadeSummaryShape | null;

    let description = `Cập nhật quyết định: ${resolvedSoQD}`;
    if (loaiName) description += ` (${loaiName})`;
    if (resolvedNam) description += `\n- Năm: ${resolvedNam}`;
    if (cascade) description += formatCascadeSummary(cascade);
    return description;
  },
  DELETE: (req: Request, res: Response, responseData: unknown): string => {
    // Đọc từ responseData (controller trả bản ghi vừa xóa) vì bản ghi đã bị xóa, không query lại được.
    const parsed = parseResponseData(responseData);
    const decision = asRecord(parsed?.data) || parsed;

    if (decision?.so_quyet_dinh) {
      const soQD = decision.so_quyet_dinh as string;
      const loaiKhenThuong = (decision.loai_khen_thuong as string) || '';
      const loaiName = getLoaiName(loaiKhenThuong);
      let description = `Xóa quyết định: ${soQD}`;
      if (loaiName) description += ` (${loaiName})`;
      return description;
    }
    return `Xóa quyết định (không xác định được thông tin)`;
  },
};

export { decisions };
