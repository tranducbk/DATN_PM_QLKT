import { prisma } from '../../../models';
import { Request, Response } from 'express';
import { FALLBACK, getUnitNameFromUnitId } from '../constants';
import { getDanhHieuName, resolveDanhHieuFromRecord } from '../../../constants/danhHieu.constants';

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
    // The deleted award type comes from ?awardType (chain awards BKBQP/BKTTCP store
    // danh_hieu = null, so reading record.danh_hieu alone loses them).
    const awardType =
      (typeof req.query?.awardType === 'string' && req.query.awardType.trim()) || '';
    let tenDonVi = '';
    let danhHieu = awardType;
    let nam = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const record = data?.data || data;
      if (record?.CoQuanDonVi?.ten_don_vi) tenDonVi = record.CoQuanDonVi.ten_don_vi;
      else if (record?.DonViTrucThuoc?.ten_don_vi) tenDonVi = record.DonViTrucThuoc.ten_don_vi;
      if (!danhHieu) danhHieu = resolveDanhHieuFromRecord(record || {}) || '';
      if (record?.nam) nam = String(record.nam);
    } catch (error) {
      console.error('[auditLog/unitAnnual:DELETE] failed to parse response data:', error);
    }

    const danhHieuName = getDanhHieuName(danhHieu);
    const namText = nam ? ` (năm ${nam})` : '';

    if (tenDonVi) {
      if (danhHieuName) {
        return `Xóa ${UNIT_AWARD_LABEL}: ${danhHieuName} của đơn vị ${tenDonVi}${namText}`;
      }
      return `Xóa ${UNIT_AWARD_LABEL} của đơn vị ${tenDonVi}${namText}`;
    }

    return `Xóa ${UNIT_AWARD_LABEL} (không xác định được thông tin)`;
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
