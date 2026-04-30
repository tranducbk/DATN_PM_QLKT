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
  // Award tables auto-update via Postgres ON UPDATE CASCADE; only JSON proposal payloads need app-level rename.
  if (proposalsUpdated === 0) {
    return '\n- Cascade: Bảng khen thưởng tự cập nhật qua FK; không có đề xuất chờ duyệt nào tham chiếu số cũ';
  }
  return `\n- Cascade cập nhật: ${proposalsUpdated} đề xuất đang chờ duyệt (bảng khen thưởng tự cập nhật qua FK)`;
};

const decisions: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  CREATE: (req: Request, res: Response, responseData: unknown): string => {
    const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
    const loaiQuyetDinh = req.body?.loai_quyet_dinh || '';
    const nam = req.body?.nam;
    const ngayKy = req.body?.ngay_ky;
    const coQuanBanHanh = req.body?.co_quan_ban_hanh;
    const loaiName = getLoaiName(loaiQuyetDinh);

    let description = `Tạo quyết định: ${soQuyetDinh}${loaiName ? ` (${loaiName})` : ''}`;
    if (nam) description += `\n- Năm: ${nam}`;
    if (ngayKy) description += `\n- Ngày ký: ${formatDate(ngayKy)}`;
    if (coQuanBanHanh) description += `\n- Cơ quan ban hành: ${coQuanBanHanh}`;
    return description;
  },
  UPDATE: (req: Request, res: Response, responseData: unknown): string => {
    const soQuyetDinh = req.body?.so_quyet_dinh || FALLBACK.UNKNOWN;
    const loaiQuyetDinh = req.body?.loai_quyet_dinh || '';
    const nam = req.body?.nam;
    const parsed = parseResponseData(responseData);
    const decision = asRecord(parsed?.data) || parsed;

    const resolvedSoQD = (decision?.so_quyet_dinh as string) || soQuyetDinh;
    const resolvedLoai = loaiQuyetDinh || (decision?.loai_quyet_dinh as string) || '';
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
    const parsed = parseResponseData(responseData);
    const decision = asRecord(parsed?.data) || parsed;

    if (decision?.so_quyet_dinh) {
      const soQD = decision.so_quyet_dinh as string;
      const loaiQuyetDinh = (decision.loai_quyet_dinh as string) || '';
      const loaiName = getLoaiName(loaiQuyetDinh);
      let description = `Xóa quyết định: ${soQD}`;
      if (loaiName) description += ` (${loaiName})`;
      return description;
    }
    return `Xóa quyết định (không xác định được thông tin)`;
  },
};

export { decisions };
