// Hằng số và hàm tiện ích dùng chung để dựng mô tả tiếng Việt cho audit-log.
import { prisma } from '../../models';
import { formatDate } from '../datetimeHelper';
import { PrismaClient } from '../../generated/prisma';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { positionRepository } from '../../repositories/position.repository';

/** Nhãn mặc định khi thiếu dữ liệu hiển thị (tên, đơn vị, chức vụ, file). */
const FALLBACK = {
  UNKNOWN: 'Chưa xác định',
  NO_NAME: 'Chưa có tên',
  NO_UNIT: 'Chưa có đơn vị',
  NO_POSITION: 'Chưa có chức vụ',
  NO_FILE: 'Không có file',
} as const;

/** Parse responseData (JSON string hoặc object) thành Record; null nếu không hợp lệ. */
const parseResponseData = (responseData: unknown): Record<string, unknown> | null => {
  try {
    const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch (error) {
    console.error('[auditLog] best-effort fallback:', error);
    return null;
  }
};

interface ChucVuWithUnit {
  CoQuanDonVi?: { ten_don_vi?: string | null } | null;
  DonViTrucThuoc?: {
    ten_don_vi?: string | null;
    CoQuanDonVi?: { ten_don_vi?: string | null } | null;
  } | null;
  [key: string]: unknown;
}

/** Lấy tên đơn vị từ chức vụ, ưu tiên CQDV rồi tới ĐVTT (kèm CQDV cha nếu có). */
const getUnitNameFromChucVu = (chucVu: ChucVuWithUnit | null | undefined): string => {
  if (!chucVu) return '';
  if (chucVu.CoQuanDonVi?.ten_don_vi) {
    return chucVu.CoQuanDonVi.ten_don_vi;
  }
  if (chucVu.DonViTrucThuoc?.ten_don_vi) {
    const tenDonVi = chucVu.DonViTrucThuoc.ten_don_vi;
    if (chucVu.DonViTrucThuoc.CoQuanDonVi?.ten_don_vi) {
      return `${tenDonVi} (${chucVu.DonViTrucThuoc.CoQuanDonVi.ten_don_vi})`;
    }
    return tenDonVi;
  }
  return '';
};

/** Tra tên đơn vị theo id (thử CQDV trước, ĐVTT sau); chuỗi rỗng nếu lỗi/không thấy. */
const getUnitNameFromUnitId = async (unitId: string, prisma: PrismaClient): Promise<string> => {
  if (!unitId) return '';
  try {
    const [selectedCoQuan, selectedDonVi] = await Promise.all([
      coQuanDonViRepository.findUniqueRaw(
        {
          where: { id: unitId },
          select: { ten_don_vi: true },
        },
        prisma
      ),
      donViTrucThuocRepository.findUniqueRaw(
        {
          where: { id: unitId },
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
          },
        },
        prisma
      ),
    ]);

    if (selectedCoQuan?.ten_don_vi) {
      return selectedCoQuan.ten_don_vi;
    }
    if (selectedDonVi?.ten_don_vi) {
      const tenDonVi = selectedDonVi.ten_don_vi;
      if (selectedDonVi.CoQuanDonVi?.ten_don_vi) {
        return `${tenDonVi} (${selectedDonVi.CoQuanDonVi.ten_don_vi})`;
      }
      return tenDonVi;
    }
    return '';
  } catch (error) {
    console.error('[auditLog] best-effort fallback:', error);
    return '';
  }
};

/** Tra họ tên quân nhân theo id; chuỗi rỗng nếu lỗi hoặc không tìm thấy. */
const queryPersonnelName = async (personnelId: string, prisma: PrismaClient): Promise<string> => {
  if (!personnelId) return '';
  try {
    const personnel = await quanNhanRepository.findUniqueRaw(
      {
        where: { id: personnelId },
        select: { ho_ten: true },
      },
      prisma
    );
    return personnel?.ho_ten || '';
  } catch (error) {
    console.error('[auditLog] best-effort fallback:', error);
    return '';
  }
};

/** Tra tên chức vụ kèm tên đơn vị theo id chức vụ; trả về cả hai chuỗi rỗng nếu lỗi. */
const queryPositionInfo = async (
  chucVuId: string,
  prisma: PrismaClient
): Promise<{ tenChucVu: string; tenDonVi: string }> => {
  if (!chucVuId) return { tenChucVu: '', tenDonVi: '' };
  try {
    const chucVu = await positionRepository.findUniqueRaw(
      {
        where: { id: chucVuId },
        include: {
          CoQuanDonVi: { select: { ten_don_vi: true } },
          DonViTrucThuoc: {
            include: {
              CoQuanDonVi: { select: { ten_don_vi: true } },
            },
          },
        },
      },
      prisma
    );
    if (!chucVu) return { tenChucVu: '', tenDonVi: '' };
    return {
      tenChucVu: chucVu.ten_chuc_vu || '',
      tenDonVi: getUnitNameFromChucVu(chucVu),
    };
  } catch (error) {
    console.error('[auditLog] best-effort fallback:', error);
    return { tenChucVu: '', tenDonVi: '' };
  }
};

/** Chạy callback với prisma client; trả về null nếu callback ném lỗi (best-effort). */
const withPrisma = async <T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T | null> => {
  try {
    return await callback(prisma);
  } catch (error) {
    console.error('[auditLog] withPrisma failed:', error);
    return null;
  }
};

/** Dựng chuỗi mô tả khoảng thời gian (từ/đến/chưa kết thúc) cho mô tả audit-log. */
const formatDateRange = (
  ngayBatDau: string | null | undefined,
  ngayKetThuc?: string | null | undefined
): string => {
  if (!ngayBatDau && ngayKetThuc === undefined) return '';
  if (ngayBatDau) {
    const formattedStart = formatDate(ngayBatDau);
    if (ngayKetThuc !== undefined) {
      if (ngayKetThuc) {
        const formattedEnd = formatDate(ngayKetThuc);
        return ` (Từ: ${formattedStart} đến: ${formattedEnd})`;
      }
      return ` (Từ: ${formattedStart} - Chưa kết thúc)`;
    }
    return ` (Từ: ${formattedStart})`;
  }
  if (ngayKetThuc !== undefined) {
    if (ngayKetThuc) {
      const formattedEnd = formatDate(ngayKetThuc);
      return ` (Đến: ${formattedEnd})`;
    }
    return ' (Chưa kết thúc)';
  }
  return '';
};

/** Ép kiểu an toàn unknown sang Record để truy cập thuộc tính; null nếu không phải object. */
const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

/** Giải mã tên file multer từ latin1 sang utf8 để hiển thị tiếng Việt đúng. */
const getFileName = (req: { file?: { originalname?: string } }): string => {
  if (!req.file?.originalname) return FALLBACK.NO_FILE;
  try {
    return Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  } catch (error) {
    console.error('[auditLog] best-effort fallback:', error);
    return req.file.originalname;
  }
};

export {
  FALLBACK,
  getFileName,
  parseResponseData,
  getUnitNameFromChucVu,
  getUnitNameFromUnitId,
  queryPersonnelName,
  queryPositionInfo,
  withPrisma,
  formatDateRange,
  formatDate,
  asRecord,
};

export type { ChucVuWithUnit };
