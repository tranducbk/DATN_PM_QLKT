import type { Prisma } from '../../../generated/prisma';
import { prisma } from '../../../models';
import { Request, Response } from 'express';
import { queryPersonnelName, getFileName } from '../constants';
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
    CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
      const nam = req.body?.nam || '';
      const personnelId = req.body?.quan_nhan_id || null;
      const danhHieu = req.body?.danh_hieu || '';

      let hoTen = '';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        hoTen = (data?.data || data)?.QuanNhan?.ho_ten || '';
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      }
      if (!hoTen && personnelId) {
        hoTen = await queryPersonnelName(personnelId, prisma);
      }

      let description = `Tạo ${getAwardLabel(danhHieu)}`;
      if (hoTen) description += ` cho quân nhân ${hoTen}`;
      if (nam) description += ` năm ${nam}`;
      return description;
    },

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
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      }

      if (hoTen) {
        return `Xóa ${getAwardLabel(danhHieu)} của quân nhân ${hoTen}${nam ? ` năm ${nam}` : ''}`;
      }
      return `Xóa ${typeName} (không xác định được thông tin)`;
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
          return `Import ${typeName} từ file: ${fileName} (${successCount} thành công${
            failCount > 0 ? `, ${failCount} thất bại` : ''
          })`;
        }
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
      }

      return `Import ${typeName} từ file: ${fileName}`;
    },
  };
}
