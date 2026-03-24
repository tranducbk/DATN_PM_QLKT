import { prisma } from '../../models';
import { formatDate } from '../datetimeHelper';
import { PrismaClient } from '../../generated/prisma';

const FALLBACK = {
  UNKNOWN: 'Chưa xác định',
  NO_NAME: 'Chưa có tên',
  NO_UNIT: 'Chưa có đơn vị',
  NO_POSITION: 'Chưa có chức vụ',
  NO_FILE: 'Không có file',
} as const;

const ROLE_NAMES: Record<string, string> = {
  USER: 'Người dùng',
  MANAGER: 'Quản lý',
  ADMIN: 'Quản trị viên',
  SUPER_ADMIN: 'Quản trị viên cấp cao',
};

const ACHIEVEMENT_TYPE_NAMES: Record<string, string> = {
  DTKH: 'Đề tài khoa học',
  SKKH: 'Sáng kiến khoa học',
  NCKH: 'Nghiên cứu khoa học',
};

const parseResponseData = (responseData: unknown): Record<string, unknown> | null => {
  try {
    const parsed = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
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

const getUnitNameFromUnitId = async (unitId: string, prisma: PrismaClient): Promise<string> => {
  if (!unitId) return '';
  try {
    const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
      prisma.coQuanDonVi.findUnique({
        where: { id: unitId },
        select: { ten_don_vi: true },
      }),
      prisma.donViTrucThuoc.findUnique({
        where: { id: unitId },
        include: {
          CoQuanDonVi: { select: { ten_don_vi: true } },
        },
      }),
    ]);

    if (coQuanDonVi?.ten_don_vi) {
      return coQuanDonVi.ten_don_vi;
    }
    if (donViTrucThuoc?.ten_don_vi) {
      const tenDonVi = donViTrucThuoc.ten_don_vi;
      if (donViTrucThuoc.CoQuanDonVi?.ten_don_vi) {
        return `${tenDonVi} (${donViTrucThuoc.CoQuanDonVi.ten_don_vi})`;
      }
      return tenDonVi;
    }
    return '';
  } catch {
    return '';
  }
};

const queryPersonnelName = async (personnelId: string, prisma: PrismaClient): Promise<string> => {
  if (!personnelId) return '';
  try {
    const personnel = await prisma.quanNhan.findUnique({
      where: { id: personnelId },
      select: { ho_ten: true },
    });
    return personnel?.ho_ten || '';
  } catch {
    return '';
  }
};

const queryPositionInfo = async (
  chucVuId: string,
  prisma: PrismaClient
): Promise<{ tenChucVu: string; tenDonVi: string }> => {
  if (!chucVuId) return { tenChucVu: '', tenDonVi: '' };
  try {
    const chucVu = await prisma.chucVu.findUnique({
      where: { id: chucVuId },
      include: {
        CoQuanDonVi: { select: { ten_don_vi: true } },
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
          },
        },
      },
    });
    if (!chucVu) return { tenChucVu: '', tenDonVi: '' };
    return {
      tenChucVu: chucVu.ten_chuc_vu || '',
      tenDonVi: getUnitNameFromChucVu(chucVu),
    };
  } catch {
    return { tenChucVu: '', tenDonVi: '' };
  }
};

const withPrisma = async <T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T | null> => {
  try {
    return await callback(prisma);
  } catch (error) {
    return null;
  }
};

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

/** Safely cast unknown to Record for property access; returns null if not an object */
const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

export {
  FALLBACK,
  ROLE_NAMES,
  ACHIEVEMENT_TYPE_NAMES,
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
