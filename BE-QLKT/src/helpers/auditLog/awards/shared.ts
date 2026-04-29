import type { Prisma } from '../../../generated/prisma';
import { prisma } from '../../../models';
import { Request, Response } from 'express';
import { queryPersonnelName, getFileName } from '../constants';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { tenureMedalRepository } from '../../../repositories/tenureMedal.repository';
import { commemorativeMedalRepository } from '../../../repositories/commemorativeMedal.repository';
import { militaryFlagRepository } from '../../../repositories/militaryFlag.repository';
import { contributionMedalRepository } from '../../../repositories/contributionMedal.repository';

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

export const AWARD_TYPE_NAMES: Record<string, string> = {
  'tenure-medals': 'Huy chương Chiến sĩ vẻ vang',
  'commemorative-medals': 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  'military-flag': 'Huy chương Quân kỳ quyết thắng',
  'contribution-medals': 'Huân chương Bảo vệ Tổ quốc',
};

export type AwardModelAccessor = {
  findUnique: (args: {
    where: { id: string };
    include: { QuanNhan: { select: { ho_ten: true } } };
  }) => Promise<{
    quan_nhan_id: string;
    nam: number;
    danh_hieu?: string;
    QuanNhan?: { ho_ten: string } | null;
  } | null>;
};

/** Prisma model accessor keyed by resource slug */
export const AWARD_PRISMA_MODEL: Record<string, AwardModelAccessor> = {
  'tenure-medals': { findUnique: args => tenureMedalRepository.findUniqueRaw(args) },
  'commemorative-medals': { findUnique: args => commemorativeMedalRepository.findUniqueRaw(args) },
  'military-flag': { findUnique: args => militaryFlagRepository.findUniqueRaw(args) },
  'contribution-medals': { findUnique: args => contributionMedalRepository.findUniqueRaw(args) },
};

export function buildAwardTypeHelpers(
  resource: string
): Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> {
  const typeName = AWARD_TYPE_NAMES[resource] || resource;
  const model = AWARD_PRISMA_MODEL[resource];

  /** Uses specific rank names when available, otherwise falls back to type label. */
  const getAwardLabel = (danhHieu?: string) => {
    if (!danhHieu) return typeName;
    const name = getDanhHieuName(danhHieu);
    return name !== 'Chưa có dữ liệu' ? name : typeName;
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
      const awardId = routeParamId(req.params?.id);

      let hoTen = '';
      let nam = '';
      let danhHieu = '';

      if (awardId && model) {
        try {
          const record = await model.findUnique({
            where: { id: awardId },
            include: { QuanNhan: { select: { ho_ten: true } } },
          });
          if (record) {
            hoTen = record.QuanNhan?.ho_ten || '';
            nam = String(record.nam ?? '');
            danhHieu = record.danh_hieu || '';
          }
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        }
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
