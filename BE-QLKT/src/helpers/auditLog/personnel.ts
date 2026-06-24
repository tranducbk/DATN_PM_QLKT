import { Request, Response } from 'express';
import { normalizeParam } from '../paginationHelper';
import { getDanhHieuName } from '../../constants/danhHieu.constants';
import {
  FALLBACK,
  parseResponseData,
  getUnitNameFromChucVu,
  getUnitNameFromUnitId,
  queryPersonnelName,
  queryPositionInfo,
  withPrisma,
  formatDateRange,
  asRecord,
  getFileName,
} from './constants';
import type { ChucVuWithUnit } from './constants';
import { positionHistoryRepository } from '../../repositories/positionHistory.repository';
import { formatPersonnelChanges, PersonnelFieldChange } from '../profileFieldDiff';

const personnel: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const parsedData = parseResponseData(responseData);
    const result = asRecord(parsedData?.data) || parsedData;

    // New personnel are created with a login username only (plus unit + position); the
    // real profile (name, CCCD, ...) is filled in later via update — so log the username.
    const username = (asRecord(result?.TaiKhoan)?.username as string) || FALLBACK.UNKNOWN;

    let tenChucVu = '';
    let tenDonVi = '';
    const chucVuId = req.body?.chuc_vu_id || (result?.chuc_vu_id as string) || null;
    const coQuanDonViId =
      req.body?.co_quan_don_vi_id || (result?.co_quan_don_vi_id as string) || null;
    const donViTrucThuocId =
      req.body?.don_vi_truc_thuoc_id || (result?.don_vi_truc_thuoc_id as string) || null;

    const chucVu = asRecord(result?.ChucVu) as ChucVuWithUnit | null;
    if (chucVu) {
      tenChucVu = (chucVu.ten_chuc_vu as string) || '';
      tenDonVi = getUnitNameFromChucVu(chucVu);
    }

    if ((!tenChucVu && chucVuId) || (!tenDonVi && (coQuanDonViId || donViTrucThuocId))) {
      await withPrisma(async prisma => {
        if (!tenChucVu && chucVuId) {
          const positionInfo = await queryPositionInfo(chucVuId, prisma);
          tenChucVu = positionInfo.tenChucVu;
          if (!tenDonVi) tenDonVi = positionInfo.tenDonVi;
        }
        if (!tenDonVi) {
          const unitId = donViTrucThuocId || coQuanDonViId;
          if (unitId) tenDonVi = await getUnitNameFromUnitId(unitId, prisma);
        }
      });
    }

    let description = `Tạo quân nhân mới (tên đăng nhập: ${username})`;
    if (tenDonVi) description += `\n- Đơn vị: ${tenDonVi}`;
    if (tenChucVu) description += `\n- Chức vụ: ${tenChucVu}`;
    return description;
  },
  UPDATE: (req: Request, res: Response, responseData: unknown): string => {
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const personnelData = data?.data || data;
      const hoTen = personnelData?.ho_ten || req.body?.ho_ten || FALLBACK.NO_NAME;
      const changes = (personnelData?.changes as PersonnelFieldChange[] | undefined) || [];
      const changeDetail = changes.length > 0 ? ` - Đổi: ${formatPersonnelChanges(changes)}` : '';

      if (personnelData?.unitTransferInfo) {
        const { oldUnit, newUnit } = personnelData.unitTransferInfo;
        const oldUnitName = oldUnit?.ten_don_vi || FALLBACK.NO_UNIT;
        const newUnitName = newUnit?.ten_don_vi || FALLBACK.NO_UNIT;
        return `Chuyển đơn vị quân nhân: ${hoTen} từ "${oldUnitName}" sang "${newUnitName}"${changeDetail}`;
      }

      return `Cập nhật thông tin quân nhân: ${hoTen}${changeDetail}`;
    } catch (e) {
      console.error('AuditLogPersonnel.buildUpdateDescription failed', { error: e });
      const hoTen = req.body?.ho_ten || FALLBACK.NO_NAME;
      return `Cập nhật thông tin quân nhân: ${hoTen}`;
    }
  },
  DELETE: (req: Request, res: Response, responseData: unknown): string => {
    let hoTen = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      hoTen = data?.data?.ho_ten || '';
    } catch {}

    if (hoTen) {
      return `Xóa quân nhân: ${hoTen}`;
    }
    return `Xóa quân nhân (không xác định được thông tin)`;
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
        return `Nhập dữ liệu quân nhân từ file: ${fileName} (${successCount} thành công${
          failCount > 0 ? `, ${failCount} thất bại` : ''
        })`;
      }
    } catch {}

    return `Nhập dữ liệu quân nhân từ file: ${fileName}`;
  },
  EXPORT: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const filters: string[] = [];

    const search = req.query?.search || req.query?.keyword || req.query?.q;
    if (search) {
      filters.push(`Tìm kiếm: "${search}"`);
    }

    const unitId = (req.query?.co_quan_don_vi_id || req.query?.unitId) as string | undefined;
    if (unitId) {
      const unitName = await withPrisma(async p => getUnitNameFromUnitId(unitId, p));
      filters.push(`Đơn vị: ${unitName || '(có lọc)'}`);
    }

    const subUnitId = (req.query?.don_vi_truc_thuoc_id || req.query?.subUnitId) as
      | string
      | undefined;
    if (subUnitId) {
      const subUnitName = await withPrisma(async p => getUnitNameFromUnitId(subUnitId, p));
      filters.push(`Đơn vị trực thuộc: ${subUnitName || '(có lọc)'}`);
    }

    const status = req.query?.trang_thai || req.query?.status;
    if (status) {
      filters.push(`Trạng thái: ${status}`);
    }

    let description = 'Xuất dữ liệu quân nhân ra Excel';
    if (filters.length > 0) {
      description += ` (Lọc: ${filters.join(', ')})`;
    }

    return description;
  },
};

const positionHistory: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const personnelId = req.params?.personnelId || req.body?.personnel_id || null;
    const chucVuId = req.body?.chuc_vu_id || null;

    const parsedData = parseResponseData(responseData);
    const history = asRecord(parsedData?.data) || parsedData;

    const quanNhan = asRecord(history?.QuanNhan);
    const chucVu = asRecord(history?.ChucVu) as ChucVuWithUnit | null;

    let hoTen = (quanNhan?.ho_ten as string) || '';
    let tenChucVu = (chucVu?.ten_chuc_vu as string) || '';
    let tenDonVi = getUnitNameFromChucVu(chucVu);
    let ngayBatDau = (history?.ngay_bat_dau as string) || req.body?.ngay_bat_dau || '';
    let ngayKetThuc = (history?.ngay_ket_thuc as string) || req.body?.ngay_ket_thuc || '';

    if ((!hoTen && personnelId) || (!tenChucVu && chucVuId)) {
      await withPrisma(async prisma => {
        if (!hoTen && personnelId) {
          hoTen = await queryPersonnelName(personnelId, prisma);
        }
        if (!tenChucVu && chucVuId) {
          const positionInfo = await queryPositionInfo(chucVuId, prisma);
          tenChucVu = positionInfo.tenChucVu;
          if (!tenDonVi) {
            tenDonVi = positionInfo.tenDonVi;
          }
        }
      });
    }

    let description = 'Tạo lịch sử chức vụ';
    if (hoTen) {
      description += ` cho quân nhân: ${hoTen}`;
    }

    if (tenChucVu) {
      description += ` - Chức vụ: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    }

    description += formatDateRange(ngayBatDau, ngayKetThuc);

    return description;
  },
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const historyId = req.params?.id || null;
    const chucVuId = req.body?.chuc_vu_id || null;

    const parsedData = parseResponseData(responseData);
    const history = asRecord(parsedData?.data) || parsedData;

    const quanNhanU = asRecord(history?.QuanNhan);
    const chucVuU = asRecord(history?.ChucVu) as ChucVuWithUnit | null;

    let hoTen = (quanNhanU?.ho_ten as string) || '';
    let personnelId = (history?.quan_nhan_id as string) || null;
    let tenChucVu = (chucVuU?.ten_chuc_vu as string) || '';
    let tenDonVi = getUnitNameFromChucVu(chucVuU);
    let ngayBatDau = (history?.ngay_bat_dau as string) || req.body?.ngay_bat_dau || '';
    let ngayKetThuc =
      history?.ngay_ket_thuc !== undefined
        ? history.ngay_ket_thuc
        : req.body?.ngay_ket_thuc !== undefined
          ? req.body.ngay_ket_thuc
          : undefined;

    if ((!hoTen || !tenChucVu) && historyId) {
      await withPrisma(async prisma => {
        const historyRecord = await positionHistoryRepository.findUniqueRaw(
          {
            where: { id: historyId as string },
            select: {
              quan_nhan_id: true,
              chuc_vu_id: true,
            },
          },
          prisma
        );

        if (historyRecord) {
          if (!personnelId) {
            personnelId = historyRecord.quan_nhan_id;
          }
          const finalChucVuId = chucVuId || historyRecord.chuc_vu_id;

          if (!hoTen && personnelId) {
            hoTen = await queryPersonnelName(personnelId, prisma);
          }

          if (!tenChucVu && finalChucVuId) {
            const positionInfo = await queryPositionInfo(finalChucVuId, prisma);
            tenChucVu = positionInfo.tenChucVu;
            if (!tenDonVi) {
              tenDonVi = positionInfo.tenDonVi;
            }
          }
        }
      });
    }

    let description = 'Cập nhật lịch sử chức vụ';
    if (hoTen) {
      description += ` cho quân nhân: ${hoTen}`;
    }

    if (tenChucVu) {
      description += ` - Chức vụ: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    }

    description += formatDateRange(ngayBatDau, ngayKetThuc);

    return description;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const parsedData = parseResponseData(responseData);
    const result = asRecord(parsedData?.data) || parsedData;

    const quanNhanD = asRecord(result?.QuanNhan);
    const chucVuD = asRecord(result?.ChucVu) as ChucVuWithUnit | null;

    const hoTen = (quanNhanD?.ho_ten as string) || '';
    const tenChucVu = (chucVuD?.ten_chuc_vu as string) || '';
    const tenDonVi = getUnitNameFromChucVu(chucVuD);

    let description = 'Xóa lịch sử chức vụ';
    if (hoTen) {
      description += ` của quân nhân: ${hoTen}`;
    }

    if (tenChucVu) {
      description += ` - Chức vụ: ${tenChucVu}`;
      if (tenDonVi) {
        description += ` (${tenDonVi})`;
      }
    }

    if (!hoTen && !tenChucVu) {
      description += ` (không xác định được thông tin)`;
    }

    return description;
  },
};

const scientificAchievements: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    let hoTen = '';
    let loai = '';
    let moTa = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const achievement = data?.data || data;
      if (achievement?.QuanNhan?.ho_ten) {
        hoTen = achievement.QuanNhan.ho_ten;
      }
      if (achievement?.loai) {
        loai = achievement.loai;
      }
      if (achievement?.mo_ta) {
        moTa = achievement.mo_ta;
      }
    } catch {}

    const loaiName = getDanhHieuName(loai);

    if (hoTen && loai) {
      return `Xóa thành tích khoa học: ${loaiName}${
        moTa ? ` - ${moTa}` : ''
      } của quân nhân ${hoTen}`;
    }

    return `Xóa thành tích khoa học (không xác định được thông tin)`;
  },
};

export { personnel, positionHistory, scientificAchievements };
