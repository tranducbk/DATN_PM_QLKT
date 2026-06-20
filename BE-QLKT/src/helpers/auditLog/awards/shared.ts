import type { Prisma } from '../../../generated/prisma';
import { Request, Response } from 'express';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { AWARD_LABELS } from '../../../constants/awardLabels.constants';

/** Normalizes route/query ID values (Express can pass string or string[]). */
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

/** Resolves the personnel name or unit name an award record points to. */
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

export function buildAwardTypeHelpers(
  resource: string
): Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> {
  const typeName = AWARD_LABELS[resource as keyof typeof AWARD_LABELS] || resource;

  /** Uses the specific rank label, or the award type label when no danh hieu is given. */
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
