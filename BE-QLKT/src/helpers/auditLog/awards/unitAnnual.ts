import { prisma } from '../../../models';
import { danhHieuDonViHangNamRepository } from '../../../repositories/danhHieu.repository';
import { Request, Response } from 'express';
import { FALLBACK, getUnitNameFromUnitId, getFileName } from '../constants';
import { getDanhHieuName } from '../../../constants/danhHieu.constants';
import { routeParamId } from './shared';

type DanhHieuDonViWithUnit = {
  danh_hieu: string | null;
  nam: number | null;
  CoQuanDonVi?: { ten_don_vi: string | null } | null;
  DonViTrucThuoc?: { ten_don_vi: string | null } | null;
} | null;

const UNIT_AWARD_LABEL = 'danh hiệu đơn vị hằng năm';

/** Extract unit name from response data that includes CoQuanDonVi / DonViTrucThuoc */
const getUnitNameFromResponse = (responseData: unknown): string => {
  try {
    const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    const record = data?.data || data;
    if (record?.CoQuanDonVi?.ten_don_vi) return record.CoQuanDonVi.ten_don_vi;
    if (record?.DonViTrucThuoc?.ten_don_vi) return record.DonViTrucThuoc.ten_don_vi;
  } catch (error) {
    console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
    // best-effort — audit description must not throw
  }
  return '';
};

export const unitAnnualAwards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> = {
  IMPORT: (req: Request, res: Response, responseData: unknown): string => {
    const fileName = getFileName(req);
    let successCount = 0;
    let failCount = 0;

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data || data;
      successCount =
        result?.imported || result?.success || result?.successCount || result?.total || 0;
      failCount = result?.failed || result?.failCount || 0;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    if (successCount > 0 || failCount > 0) {
      return `Import ${UNIT_AWARD_LABEL} từ file: ${fileName} (${successCount} thành công${
        failCount > 0 ? `, ${failCount} thất bại` : ''
      })`;
    }

    return `Import ${UNIT_AWARD_LABEL} từ file: ${fileName}`;
  },

  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const danhHieuName = getDanhHieuName(danhHieu);

    let tenDonVi = getUnitNameFromResponse(responseData);
    if (!tenDonVi && req.body?.don_vi_id) {
      tenDonVi = (await getUnitNameFromUnitId(req.body.don_vi_id, prisma)) || '';
    }

    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;

    return `Tạo ${UNIT_AWARD_LABEL}: ${danhHieuDisplay}${
      tenDonVi ? ` cho đơn vị ${tenDonVi}` : ''
    } - Năm ${namDisplay}`;
  },

  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const danhHieuName = getDanhHieuName(danhHieu);

    let tenDonVi = getUnitNameFromResponse(responseData);
    if (!tenDonVi && req.body?.don_vi_id) {
      tenDonVi = (await getUnitNameFromUnitId(req.body.don_vi_id, prisma)) || '';
    }

    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;

    return `Cập nhật ${UNIT_AWARD_LABEL}: ${danhHieuDisplay}${
      tenDonVi ? ` cho đơn vị ${tenDonVi}` : ''
    } - Năm ${namDisplay}`;
  },

  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const rewardId = routeParamId(req.params?.id);
    let tenDonVi = '';
    let danhHieu = '';
    let nam = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const record = data?.data || data;
      if (record?.CoQuanDonVi?.ten_don_vi) tenDonVi = record.CoQuanDonVi.ten_don_vi;
      else if (record?.DonViTrucThuoc?.ten_don_vi) tenDonVi = record.DonViTrucThuoc.ten_don_vi;
      if (record?.danh_hieu) danhHieu = record.danh_hieu;
      if (record?.nam) nam = String(record.nam);
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    if ((!tenDonVi || !danhHieu) && rewardId) {
      try {
        const record = (await danhHieuDonViHangNamRepository.findUnique({
          where: { id: rewardId },
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        })) as DanhHieuDonViWithUnit;
        if (record) {
          tenDonVi =
            tenDonVi || record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.ten_don_vi || '';
          danhHieu = danhHieu || record.danh_hieu || '';
          nam = nam || String(record.nam ?? '');
        }
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
      }
    }

    const danhHieuName = getDanhHieuName(danhHieu);

    if (tenDonVi && danhHieu) {
      return `Xóa ${UNIT_AWARD_LABEL}: ${danhHieuName} của đơn vị ${tenDonVi}${
        nam ? ` (năm ${nam})` : ''
      }`;
    }

    return `Xóa ${UNIT_AWARD_LABEL} (không xác định được thông tin)`;
  },

  PROPOSE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const danhHieuName = getDanhHieuName(danhHieu);

    let tenDonVi = getUnitNameFromResponse(responseData);
    if (!tenDonVi && req.body?.don_vi_id) {
      tenDonVi = (await getUnitNameFromUnitId(req.body.don_vi_id, prisma)) || '';
    }

    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;

    return `Đề xuất ${UNIT_AWARD_LABEL}: ${danhHieuDisplay}${
      tenDonVi ? ` cho đơn vị ${tenDonVi}` : ''
    } - Năm ${namDisplay}`;
  },

  APPROVE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    let tenDonVi = getUnitNameFromResponse(responseData);
    let danhHieu = '';
    let nam = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const record = data?.data || data;
      danhHieu = record?.danh_hieu || '';
      nam = record?.nam ? String(record.nam) : '';
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    if (!tenDonVi || !danhHieu) {
      const rewardId = routeParamId(req.params?.id);
      if (rewardId) {
        try {
          const record = (await danhHieuDonViHangNamRepository.findUnique({
            where: { id: rewardId },
            include: {
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          })) as DanhHieuDonViWithUnit;
          if (record) {
            tenDonVi =
              tenDonVi || record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.ten_don_vi || '';
            danhHieu = danhHieu || record.danh_hieu || '';
            nam = nam || String(record.nam ?? '');
          }
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }
    }

    const danhHieuName = getDanhHieuName(danhHieu);
    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;

    return `Phê duyệt ${UNIT_AWARD_LABEL}: ${danhHieuDisplay}${
      tenDonVi ? ` cho đơn vị ${tenDonVi}` : ''
    } - Năm ${namDisplay}`;
  },

  REJECT: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    let tenDonVi = getUnitNameFromResponse(responseData);
    let danhHieu = '';
    let nam = '';
    const lyDo = req.body?.ghi_chu || '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const record = data?.data || data;
      danhHieu = record?.danh_hieu || '';
      nam = record?.nam ? String(record.nam) : '';
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    if (!tenDonVi || !danhHieu) {
      const rewardId = routeParamId(req.params?.id);
      if (rewardId) {
        try {
          const record = (await danhHieuDonViHangNamRepository.findUnique({
            where: { id: rewardId },
            include: {
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          })) as DanhHieuDonViWithUnit;
          if (record) {
            tenDonVi =
              tenDonVi || record.CoQuanDonVi?.ten_don_vi || record.DonViTrucThuoc?.ten_don_vi || '';
            danhHieu = danhHieu || record.danh_hieu || '';
            nam = nam || String(record.nam ?? '');
          }
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }
    }

    const danhHieuName = getDanhHieuName(danhHieu);
    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;

    let description = `Từ chối ${UNIT_AWARD_LABEL}: ${danhHieuDisplay}${
      tenDonVi ? ` cho đơn vị ${tenDonVi}` : ''
    } - Năm ${namDisplay}`;

    if (lyDo) {
      description += `\n- Lý do: ${lyDo}`;
    }

    return description;
  },

  RECALCULATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const donViId = req.body?.don_vi_id || '';
    const nam = req.body?.nam || '';

    let updatedCount = 0;
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data || data;
      updatedCount = result?.updated || 0;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    let tenDonVi = '';
    if (donViId) {
      tenDonVi = (await getUnitNameFromUnitId(donViId, prisma)) || '';
    }

    if (tenDonVi && nam) {
      return `Tính toán lại ${UNIT_AWARD_LABEL} cho đơn vị ${tenDonVi} - Năm ${nam} (${updatedCount} bản ghi)`;
    }
    if (tenDonVi) {
      return `Tính toán lại ${UNIT_AWARD_LABEL} cho đơn vị ${tenDonVi} (${updatedCount} bản ghi)`;
    }
    if (nam) {
      return `Tính toán lại ${UNIT_AWARD_LABEL} năm ${nam} (${updatedCount} bản ghi)`;
    }

    return `Tính toán lại toàn bộ ${UNIT_AWARD_LABEL} (${updatedCount} bản ghi)`;
  },
};
