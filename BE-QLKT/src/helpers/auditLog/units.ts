import { Request, Response } from 'express';
import {
  FALLBACK,
  parseResponseData,
  getUnitNameFromChucVu,
  getUnitNameFromUnitId,
  queryPositionInfo,
  withPrisma,
  formatDate,
  asRecord,
} from './constants';
import type { ChucVuWithUnit } from './constants';

const buildUnitDescription = (
  action: string,
  unit: Record<string, unknown> | null,
  body: Record<string, unknown> | null
): string => {
  const tenDonVi = (unit?.ten_don_vi as string) || (body?.ten_don_vi as string) || '';
  const maDonVi = (unit?.ma_don_vi as string) || (body?.ma_don_vi as string) || '';
  const coQuanDonVi = unit?.CoQuanDonVi as Record<string, unknown> | null | undefined;
  const isSubUnit = !!(unit?.co_quan_don_vi_id || body?.co_quan_don_vi_id);
  const tenCoQuanDonVi = (coQuanDonVi?.ten_don_vi as string) || '';

  if (!tenDonVi) {
    return `${action} đơn vị: ${FALLBACK.UNKNOWN}`;
  }

  const loaiDonVi = isSubUnit ? 'đơn vị trực thuộc' : 'cơ quan đơn vị';
  let description = `${action} ${loaiDonVi}: ${tenDonVi}`;

  if (maDonVi) {
    description += `\n- Mã đơn vị: ${maDonVi}`;
  }
  if (tenCoQuanDonVi && isSubUnit) {
    description += `\n- Thuộc cơ quan: ${tenCoQuanDonVi}`;
  }

  return description;
};

const units: Record<string, (req: Request, res: Response, responseData: unknown) => string> = {
  CREATE: (req: Request, res: Response, responseData: unknown): string => {
    const parsedData = parseResponseData(responseData);
    const unit = asRecord(parsedData?.data) || parsedData;
    return buildUnitDescription('Tạo', unit, req.body);
  },
  UPDATE: (req: Request, res: Response, responseData: unknown): string => {
    const parsedData = parseResponseData(responseData);
    const unit = asRecord(parsedData?.data) || parsedData;
    return buildUnitDescription('Cập nhật', unit, req.body);
  },
  DELETE: (req: Request, res: Response, responseData: unknown): string => {
    const parsedData = parseResponseData(responseData);
    const unit = asRecord(parsedData?.data) || parsedData;
    return buildUnitDescription('Xóa', unit, req.body);
  },
};

const positions: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const tenChucVu = req.body?.ten_chuc_vu || FALLBACK.NO_POSITION;
    const unitId = req.body?.unit_id || null;
    const ngayHienTai = formatDate(new Date());

    const parsedData = parseResponseData(responseData);
    const position = asRecord(parsedData?.data) || parsedData;

    let finalTenChucVu = (position?.ten_chuc_vu as string) || tenChucVu;
    let tenDonVi = getUnitNameFromChucVu(position as ChucVuWithUnit | null);

    if (!tenDonVi && unitId) {
      await withPrisma(async prisma => {
        tenDonVi = await getUnitNameFromUnitId(unitId, prisma);
      });
    }

    let description = `Tạo chức vụ: ${finalTenChucVu}`;
    if (tenDonVi) {
      description += ` (${tenDonVi})`;
    }
    if (ngayHienTai) {
      description += ` - Ngày: ${ngayHienTai}`;
    }
    return description;
  },
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const positionId = req.params?.id;
    const tenChucVu = req.body?.ten_chuc_vu || null;
    const ngayHienTai = formatDate(new Date());

    const parsedData = parseResponseData(responseData);
    const position = asRecord(parsedData?.data) || parsedData;

    let finalTenChucVu = (position?.ten_chuc_vu as string) || tenChucVu;
    let tenDonVi = getUnitNameFromChucVu(position as ChucVuWithUnit | null);

    if ((!finalTenChucVu || !tenDonVi) && positionId) {
      await withPrisma(async prisma => {
        const positionInfo = await queryPositionInfo(positionId as string, prisma);
        if (!finalTenChucVu) {
          finalTenChucVu = positionInfo.tenChucVu || FALLBACK.NO_POSITION;
        }
        if (!tenDonVi) {
          tenDonVi = positionInfo.tenDonVi;
        }
      });
    }

    let description = `Cập nhật chức vụ: ${finalTenChucVu || FALLBACK.NO_POSITION}`;
    if (tenDonVi) {
      description += ` (${tenDonVi})`;
    }
    if (ngayHienTai) {
      description += ` - Ngày: ${ngayHienTai}`;
    }
    return description;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const positionId = req.params?.id;
    const ngayHienTai = formatDate(new Date());

    const parsedData = parseResponseData(responseData);
    const position = asRecord(parsedData?.data) || parsedData;

    let tenChucVu = (position?.ten_chuc_vu as string) || '';
    let tenDonVi = getUnitNameFromChucVu(position as ChucVuWithUnit | null);

    if ((!tenChucVu || !tenDonVi) && positionId) {
      await withPrisma(async prisma => {
        const positionInfo = await queryPositionInfo(positionId as string, prisma);
        if (!tenChucVu) {
          tenChucVu = positionInfo.tenChucVu;
        }
        if (!tenDonVi) {
          tenDonVi = positionInfo.tenDonVi;
        }
      });
    }

    let description = 'Xóa chức vụ';
    if (tenChucVu) {
      description += `: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    } else {
      description += ` (không xác định được thông tin)`;
    }
    if (ngayHienTai) {
      description += ` - Ngày: ${ngayHienTai}`;
    }

    return description;
  },
};

export { units, positions };
