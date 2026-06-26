import { Request, Response } from 'express';
import { FALLBACK } from '../constants';
import { ADHOC_TYPE } from '../../../constants/adhocType.constants';
import { UNIT_TYPE } from '../../../constants/unitType.constants';
import { routeParamId, resolveAwardSubject, KhenThuongDotXuatWithAuditRels } from './shared';
import { adhocAwardRepository } from '../../../repositories/adhocAward.repository';
import { quanNhanRepository } from '../../../repositories/quanNhan.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../../repositories/unit.repository';

/**
 * Builder mô tả audit log cho khen thưởng đột xuất (DOT_XUAT).
 * Mỗi action (CREATE/UPDATE/DELETE) sinh câu mô tả tiếng Việt cho nhật ký hệ thống.
 */

/**
 * Sinh mô tả cho hành động tạo khen thưởng đột xuất.
 * @param req - Request chứa thông tin loại, hình thức, năm và đối tượng được khen
 * @param res - Response (không dùng trực tiếp, giữ cho đồng nhất chữ ký builder)
 * @param responseData - Dữ liệu trả về để lấy tên quân nhân/đơn vị
 * @returns Câu mô tả audit log
 */
export const adhocAwards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const type = req.body?.type === ADHOC_TYPE.CA_NHAN ? 'cá nhân' : 'tập thể';
    const awardForm = req.body?.awardForm || FALLBACK.UNKNOWN;
    const year = req.body?.year || '';
    const personnelId = req.body?.personnelId || null;
    const unitId = req.body?.unitId || null;
    const unitType = req.body?.unitType || null;

    let hoTen = '';
    let tenDonVi = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      ({ hoTen, tenDonVi } = resolveAwardSubject(data?.data || data));
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — mô tả audit không được phép throw
    }

    // Khi responseData không có tên, truy ngược tên quân nhân/đơn vị từ ID trong request
    if (!hoTen && !tenDonVi) {
      try {
        if (type === 'cá nhân' && personnelId) {
          const personnel = await quanNhanRepository.findUniqueRaw({
            where: { id: personnelId },
            select: { ho_ten: true },
          });
          hoTen = personnel?.ho_ten || '';
        } else if (type === 'tập thể' && unitId && unitType) {
          if (unitType === UNIT_TYPE.CO_QUAN_DON_VI) {
            const unit = await coQuanDonViRepository.findLightById(unitId);
            tenDonVi = unit?.ten_don_vi || '';
          } else if (unitType === UNIT_TYPE.DON_VI_TRUC_THUOC) {
            const unit = await donViTrucThuocRepository.findNameById(unitId);
            tenDonVi = unit?.ten_don_vi || '';
          }
        }
      } catch (error) {
        console.error('Failed to resolve unit name for adhoc-award audit log:', error);
      }
    }

    let description = `Tạo khen thưởng đột xuất ${type}: ${awardForm}`;

    if (hoTen) {
      description += ` cho quân nhân ${hoTen}`;
    } else if (tenDonVi) {
      description += ` cho đơn vị ${tenDonVi}`;
    }

    if (year) {
      description += ` (năm ${year})`;
    }

    return description;
  },
  /**
   * Sinh mô tả cho hành động cập nhật khen thưởng đột xuất.
   * @param req - Request chứa ID bản ghi và hình thức khen thưởng mới
   * @param res - Response (không dùng trực tiếp, giữ cho đồng nhất chữ ký builder)
   * @param responseData - Dữ liệu trả về để lấy hình thức và tên đối tượng được khen
   * @returns Câu mô tả audit log
   */
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const awardId = routeParamId(req.params?.id);
    let awardForm: string = req.body?.awardForm || FALLBACK.UNKNOWN;
    let hoTen = '';
    let tenDonVi = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const award = data?.data || data;

      if (award?.hinh_thuc_khen_thuong) {
        awardForm = award.hinh_thuc_khen_thuong;
      }
      ({ hoTen, tenDonVi } = resolveAwardSubject(award));
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — mô tả audit không được phép throw
    }

    // Khi responseData không có tên, truy ngược từ bản ghi qua các quan hệ trong DB
    if (!hoTen && !tenDonVi && awardId) {
      try {
        const award = (await adhocAwardRepository.findUniqueRaw({
          where: { id: awardId },
          include: {
            QuanNhan: { select: { ho_ten: true } },
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        })) as KhenThuongDotXuatWithAuditRels | null;

        ({ hoTen, tenDonVi } = resolveAwardSubject(award));
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — mô tả audit không được phép throw
      }
    }

    let description = `Cập nhật khen thưởng đột xuất: ${awardForm}`;

    if (hoTen) {
      description += ` cho quân nhân ${hoTen}`;
    } else if (tenDonVi) {
      description += ` cho đơn vị ${tenDonVi}`;
    }

    return description;
  },
  /**
   * Sinh mô tả cho hành động xóa khen thưởng đột xuất.
   * @param req - Request (không dùng trực tiếp, giữ cho đồng nhất chữ ký builder)
   * @param res - Response (không dùng trực tiếp, giữ cho đồng nhất chữ ký builder)
   * @param responseData - Bản ghi đã xóa để lấy hình thức và tên đối tượng được khen
   * @returns Câu mô tả audit log
   */
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    let awardForm: string = FALLBACK.UNKNOWN;
    let hoTen = '';
    let tenDonVi = '';

    // Đọc từ responseData (bản ghi controller trả về), không query lại DB vì đã bị xóa
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const award = data?.data || data;

      if (award?.hinh_thuc_khen_thuong) {
        awardForm = award.hinh_thuc_khen_thuong;
      }
      ({ hoTen, tenDonVi } = resolveAwardSubject(award));
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — mô tả audit không được phép throw
    }

    let description = `Xóa khen thưởng đột xuất: ${awardForm}`;

    if (hoTen) {
      description += ` của quân nhân ${hoTen}`;
    } else if (tenDonVi) {
      description += ` của đơn vị ${tenDonVi}`;
    }

    return description;
  },
};
