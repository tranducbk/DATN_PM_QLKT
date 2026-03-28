import { Request, Response } from 'express';
import { FALLBACK, parseResponseData, formatDate, asRecord } from './constants';

const LOAI_QUYET_DINH_NAMES: Record<string, string> = {
  DANH_HIEU_HANG_NAM: 'Danh hiệu hằng năm',
  DANH_HIEU_NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
  BKBQP: 'Bằng khen Bộ Quốc phòng',
  CSTDTQ: 'Chiến sĩ thi đua toàn quốc',
};

const getLoaiName = (loaiQuyetDinh: string): string => {
  return LOAI_QUYET_DINH_NAMES[loaiQuyetDinh] || loaiQuyetDinh || '';
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
    const resolvedNam = nam || (decision?.nam as string | number) || '';
    const loaiName = getLoaiName(resolvedLoai);

    let description = `Cập nhật quyết định: ${resolvedSoQD}`;
    if (loaiName) description += ` (${loaiName})`;
    if (resolvedNam) description += `\n- Năm: ${resolvedNam}`;
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
