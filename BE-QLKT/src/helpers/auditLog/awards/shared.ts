// Helper dung chung cho cac builder log khen thuong: chuan hoa tham so route,
// xac dinh chu the (quan nhan/don vi) va sinh mo ta log xoa cho moi loai danh hieu.
import type { Prisma } from '../../../generated/prisma';
import { Request, Response } from 'express';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { AWARD_LABELS } from '../../../constants/awardLabels.constants';

/**
 * Chuan hoa gia tri ID tu route/query (Express co the tra string hoac string[]).
 * @param v - Gia tri ID tho tu req.params hoac req.query
 * @returns Chuoi ID hoac null neu khong co
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
 * Xac dinh ten quan nhan hoac ten don vi ma ban ghi khen thuong tro toi.
 * @param award - Ban ghi khen thuong kem quan he QuanNhan/CoQuanDonVi/DonViTrucThuoc
 * @returns Object gom hoTen va tenDonVi (mot trong hai co gia tri, con lai rong)
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
 * Tao map cac builder mo ta log theo tung action cho mot loai khen thuong.
 * @param resource - Slug loai khen thuong (vd: 'tenure-medals') de tra label
 * @returns Map action -> ham sinh mo ta log (hien chi co DELETE)
 */
export function buildAwardTypeHelpers(
  resource: string
): Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> {
  const typeName = AWARD_LABELS[resource as keyof typeof AWARD_LABELS] || resource;

  // Dung ten hang danh hieu cu the; neu khong co danh hieu thi dung label loai khen thuong.
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
        // Doc thong tin tu responseData (ban ghi vua xoa) thay vi query lai DB da bi xoa.
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
