import { prisma } from '../../models';
import { formatDate } from '../datetimeHelper';
import { PrismaClient } from '../../generated/prisma';
import { ROLES } from '../../constants/roles.constants';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../repositories/unit.repository';
import { positionRepository } from '../../repositories/position.repository';

const FALLBACK = {
  UNKNOWN: 'Chưa xác định',
  NO_NAME: 'Chưa có tên',
  NO_UNIT: 'Chưa có đơn vị',
  NO_POSITION: 'Chưa có chức vụ',
  NO_FILE: 'Không có file',
} as const;

const ROLE_NAMES: Record<string, string> = {
  [ROLES.USER]: 'Người dùng',
  [ROLES.MANAGER]: 'Quản lý',
  [ROLES.ADMIN]: 'Quản trị viên',
  [ROLES.SUPER_ADMIN]: 'Quản trị viên cấp cao',
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
  } catch (error) {
   console.error('Audit log helper fallback triggered (helpers/auditLog/constants.ts):', error);
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
    const [selectedCoQuan, selectedDonVi] = await Promise.all([
      coQuanDonViRepository.findUniqueRaw({
        where: { id: unitId },
        select: { ten_don_vi: true },
      }, prisma),
      donViTrucThuocRepository.findUniqueRaw({
        where: { id: unitId },
        include: {
          CoQuanDonVi: { select: { ten_don_vi: true } },
        },
      }, prisma),
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
   console.error('Audit log helper fallback triggered (helpers/auditLog/constants.ts):', error);
    return '';
  }
};

const queryPersonnelName = async (personnelId: string, prisma: PrismaClient): Promise<string> => {
  if (!personnelId) return '';
  try {
    const personnel = await quanNhanRepository.findUniqueRaw({
      where: { id: personnelId },
      select: { ho_ten: true },
    }, prisma);
    return personnel?.ho_ten || '';
  } catch (error) {
   console.error('Audit log helper fallback triggered (helpers/auditLog/constants.ts):', error);
    return '';
  }
};

const queryPositionInfo = async (
  chucVuId: string,
  prisma: PrismaClient
): Promise<{ tenChucVu: string; tenDonVi: string }> => {
  if (!chucVuId) return { tenChucVu: '', tenDonVi: '' };
  try {
    const chucVu = await positionRepository.findUniqueRaw({
      where: { id: chucVuId },
      include: {
        CoQuanDonVi: { select: { ten_don_vi: true } },
        DonViTrucThuoc: {
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
          },
        },
      },
    }, prisma);
    if (!chucVu) return { tenChucVu: '', tenDonVi: '' };
    return {
      tenChucVu: chucVu.ten_chuc_vu || '',
      tenDonVi: getUnitNameFromChucVu(chucVu),
    };
  } catch (error) {
   console.error('Audit log helper fallback triggered (helpers/auditLog/constants.ts):', error);
    return { tenChucVu: '', tenDonVi: '' };
  }
};

const withPrisma = async <T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T | null> => {
  try {
    return await callback(prisma);
  } catch (error) {
    console.error('AuditLog.withPrisma failed', { error });
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

/** Decodes multer filename from latin1 to utf8 for proper Vietnamese display. */
const getFileName = (req: { file?: { originalname?: string } }): string => {
  if (!req.file?.originalname) return FALLBACK.NO_FILE;
  try {
    return Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  } catch (error) {
   console.error('Audit log helper fallback triggered (helpers/auditLog/constants.ts):', error);
    return req.file.originalname;
  }
};

export {
  FALLBACK,
  getFileName,
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
