// Builder mô tả log audit cho đơn vị (cơ quan đơn vị cha + đơn vị trực thuộc con)
// và chức vụ. Mỗi action sinh chuỗi mô tả tiếng Việt để ghi vào system log.
import { Request, Response } from 'express';
import {
  FALLBACK,
  parseResponseData,
  getUnitNameFromChucVu,
  getUnitNameFromUnitId,
  queryPositionInfo,
  withPrisma,
  asRecord,
} from './constants';
import type { ChucVuWithUnit } from './constants';

// Ghép chuỗi mô tả đơn vị; ưu tiên dữ liệu từ response, thiếu thì lấy từ req.body.
const buildUnitDescription = (
  action: string,
  unit: Record<string, unknown> | null,
  body: Record<string, unknown> | null
): string => {
  const tenDonVi = (unit?.ten_don_vi as string) || (body?.ten_don_vi as string) || '';
  const maDonVi = (unit?.ma_don_vi as string) || (body?.ma_don_vi as string) || '';
  const coQuanDonVi = unit?.CoQuanDonVi as Record<string, unknown> | null | undefined;
  // Có co_quan_don_vi_id nghĩa là đơn vị trực thuộc (con); không có là cơ quan đơn vị (cha)
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

/**
 * Map action -> builder mô tả log cho đơn vị (CREATE / UPDATE / DELETE).
 * @param req - Request HTTP (lấy req.body khi response thiếu trường)
 * @param res - Response HTTP
 * @param responseData - Dữ liệu trả về của controller, nguồn chính để lấy thông tin đơn vị
 * @returns Chuỗi mô tả tiếng Việt ghi vào audit log
 */
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
    // Lấy thông tin đơn vị từ responseData (service trả record về), không query lại sau khi xóa
    const parsedData = parseResponseData(responseData);
    const unit = asRecord(parsedData?.data) || parsedData;
    return buildUnitDescription('Xóa', unit, req.body);
  },
};

/**
 * Map action -> builder mô tả log cho chức vụ (CREATE / UPDATE / DELETE).
 * @param req - Request HTTP (lấy req.body / req.params khi response thiếu trường)
 * @param res - Response HTTP
 * @param responseData - Dữ liệu trả về của controller
 * @returns Promise chuỗi mô tả tiếng Việt ghi vào audit log
 */
const positions: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const tenChucVu = req.body?.ten_chuc_vu || FALLBACK.NO_POSITION;
    const unitId = req.body?.unit_id || null;

    const parsedData = parseResponseData(responseData);
    const position = asRecord(parsedData?.data) || parsedData;

    const finalTenChucVu = (position?.ten_chuc_vu as string) || tenChucVu;
    let tenDonVi = getUnitNameFromChucVu(position as ChucVuWithUnit | null);

    // Response không kèm tên đơn vị; truy vấn bù theo unit_id từ req.body
    if (!tenDonVi && unitId) {
      await withPrisma(async prisma => {
        tenDonVi = await getUnitNameFromUnitId(unitId, prisma);
      });
    }

    let description = `Tạo chức vụ: ${finalTenChucVu}`;
    if (tenDonVi) {
      description += `\n- Đơn vị: ${tenDonVi}`;
    }
    return description;
  },
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const positionId = req.params?.id;
    const tenChucVu = req.body?.ten_chuc_vu || null;

    const parsedData = parseResponseData(responseData);
    const position = asRecord(parsedData?.data) || parsedData;

    let finalTenChucVu = (position?.ten_chuc_vu as string) || tenChucVu;
    let tenDonVi = getUnitNameFromChucVu(position as ChucVuWithUnit | null);

    // UPDATE thường chỉ gửi field thay đổi; truy vấn bù theo id để có tên đầy đủ
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
      description += `\n- Đơn vị: ${tenDonVi}`;
    }
    return description;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    // Lấy thông tin chức vụ từ responseData (service trả record về), không query lại sau khi xóa
    const parsedData = parseResponseData(responseData);
    const position = asRecord(parsedData?.data) || parsedData;

    const tenChucVu = (position?.ten_chuc_vu as string) || '';
    const tenDonVi = getUnitNameFromChucVu(position as ChucVuWithUnit | null);

    let description = 'Xóa chức vụ';
    if (tenChucVu) {
      description += `: ${tenChucVu}`;
      if (tenDonVi) {
        description += `\n- Đơn vị: ${tenDonVi}`;
      }
    } else {
      description += ` (không xác định được thông tin)`;
    }

    return description;
  },
};

export { units, positions };
