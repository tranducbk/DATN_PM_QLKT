// Helper dùng chung cho các builder log khen thưởng: chuẩn hoá tham số route,
// xác định chủ thể (quân nhân/đơn vị) và sinh mô tả log xóa cho mọi loại danh hiệu.
import type { Prisma } from '../../../generated/prisma';
import { Request, Response } from 'express';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { AWARD_LABELS } from '../../../constants/awardLabels.constants';

/**
 * Chuẩn hoá giá trị ID từ route/query (Express có thể trả string hoặc string[]).
 * @param v - Giá trị ID thô từ req.params hoặc req.query
 * @returns Chuỗi ID hoặc null nếu không có
 */
export function routeParamId(v: string | string[] | undefined | null): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type DanhHieuHangNamWithHoTen = Prisma.DanhHieuHangNamGetPayload<{
  include: { QuanNhan: { select: { ho_ten: true } } };
}>;

export type KhenThuongDotXuatWithAuditRels = Prisma.KhenThuongDotXuatGetPayload<{
  include: {
    QuanNhan: { select: { ho_ten: true } };
    CoQuanDonVi: { select: { ten_don_vi: true } };
    DonViTrucThuoc: { select: { ten_don_vi: true } };
  };
}>;

type AwardSubjectRels =
  | {
      QuanNhan?: { ho_ten?: string | null } | null;
      CoQuanDonVi?: { ten_don_vi?: string | null; ten_co_quan_don_vi?: string | null } | null;
      DonViTrucThuoc?: { ten_don_vi?: string | null } | null;
    }
  | null
  | undefined;

/**
 * Xác định tên quân nhân hoặc tên đơn vị mà bản ghi khen thưởng trỏ tới.
 * @param award - Bản ghi khen thưởng kèm quan hệ QuanNhan/CoQuanDonVi/DonViTrucThuoc
 * @returns Object gồm hoTen và tenDonVi (một trong hai có giá trị, còn lại rỗng)
 */
export function resolveAwardSubject(award: AwardSubjectRels): { hoTen: string; tenDonVi: string } {
  if (award?.QuanNhan?.ho_ten) return { hoTen: award.QuanNhan.ho_ten, tenDonVi: '' };
  if (award?.CoQuanDonVi) {
    return {
      hoTen: '',
      tenDonVi: award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '',
    };
  }
  if (award?.DonViTrucThuoc?.ten_don_vi)
    return { hoTen: '', tenDonVi: award.DonViTrucThuoc.ten_don_vi };
  return { hoTen: '', tenDonVi: '' };
}

type AwardModelRecord = {
  QuanNhan?: { ho_ten?: string | null } | null;
  nam?: number | null;
  danh_hieu?: string | null;
};

/**
 * Tạo map các builder mô tả log theo từng action cho một loại khen thưởng.
 * @param resource - Slug loại khen thưởng (vd: 'tenure-medals') để tra label
 * @returns Map action -> hàm sinh mô tả log (hiện chỉ có DELETE)
 */
export function buildAwardTypeHelpers(
  resource: string
): Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> {
  const typeName = AWARD_LABELS[resource as keyof typeof AWARD_LABELS] || resource;

  // Dùng tên hạng danh hiệu cụ thể; nếu không có danh hiệu thì dùng label loại khen thưởng.
  const getAwardLabel = (danhHieu?: string) => {
    if (!danhHieu) return typeName;
    return getDanhHieuName(danhHieu);
  };

  return {
    DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
      let hoTen = '';
      let nam = '';
      let danhHieu = '';

      try {
        // Đọc thông tin từ responseData (bản ghi vừa xóa) thay vì query lại DB đã bị xóa.
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        const record = (data as { data?: AwardModelRecord } | null)?.data;
        if (record) {
          hoTen = record.QuanNhan?.ho_ten || '';
          nam = record.nam != null ? String(record.nam) : '';
          danhHieu = record.danh_hieu || '';
        }
      } catch (error) {
        console.error('[auditLog] best-effort fallback:', error);
      }

      if (hoTen) {
        return `Xóa ${getAwardLabel(danhHieu)} của quân nhân ${hoTen}${nam ? ` năm ${nam}` : ''}`;
      }
      return `Xóa ${typeName} (không xác định được thông tin)`;
    },
  };
}
