import { Request, Response } from 'express';
import { FALLBACK } from '../constants';
import { ADHOC_TYPE } from '../../../constants/adhocType.constants';
import { routeParamId, KhenThuongDotXuatWithAuditRels } from './shared';
import { adhocAwardRepository } from '../../../repositories/adhocAward.repository';
import { quanNhanRepository } from '../../../repositories/quanNhan.repository';
import { coQuanDonViRepository, donViTrucThuocRepository } from '../../../repositories/unit.repository';

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
      const award = data?.data || data;

      if (award?.QuanNhan?.ho_ten) {
        hoTen = award.QuanNhan.ho_ten;
      } else if (award?.CoQuanDonVi) {
        tenDonVi = award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '';
      } else if (award?.DonViTrucThuoc?.ten_don_vi) {
        tenDonVi = award.DonViTrucThuoc.ten_don_vi;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    if (!hoTen && !tenDonVi) {
      try {
        if (type === 'cá nhân' && personnelId) {
          const personnel = await quanNhanRepository.findUniqueRaw({
            where: { id: personnelId },
            select: { ho_ten: true },
          });
          hoTen = personnel?.ho_ten || '';
        } else if (type === 'tập thể' && unitId && unitType) {
          if (unitType === 'CO_QUAN_DON_VI') {
            const unit = await coQuanDonViRepository.findLightById(unitId);
            tenDonVi = unit?.ten_don_vi || '';
          } else if (unitType === 'DON_VI_TRUC_THUOC') {
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

      if (award?.QuanNhan?.ho_ten) {
        hoTen = award.QuanNhan.ho_ten;
      } else if (award?.CoQuanDonVi) {
        tenDonVi = award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '';
      } else if (award?.DonViTrucThuoc?.ten_don_vi) {
        tenDonVi = award.DonViTrucThuoc.ten_don_vi;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

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

        if (award) {
          if (award.QuanNhan?.ho_ten) {
            hoTen = award.QuanNhan.ho_ten;
          } else if (award.CoQuanDonVi?.ten_don_vi) {
            tenDonVi = award.CoQuanDonVi.ten_don_vi;
          } else if (award.DonViTrucThuoc?.ten_don_vi) {
            tenDonVi = award.DonViTrucThuoc.ten_don_vi;
          }
        }
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
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
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const awardId = routeParamId(req.params?.id);
    let awardForm: string = FALLBACK.UNKNOWN;
    let hoTen = '';
    let tenDonVi = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const award = data?.data || data;

      if (award?.hinh_thuc_khen_thuong) {
        awardForm = award.hinh_thuc_khen_thuong;
      }

      if (award?.QuanNhan?.ho_ten) {
        hoTen = award.QuanNhan.ho_ten;
      } else if (award?.CoQuanDonVi) {
        tenDonVi = award.CoQuanDonVi.ten_don_vi || award.CoQuanDonVi.ten_co_quan_don_vi || '';
      } else if (award?.DonViTrucThuoc?.ten_don_vi) {
        tenDonVi = award.DonViTrucThuoc.ten_don_vi;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

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

        if (award) {
          awardForm = award.hinh_thuc_khen_thuong || awardForm;
          if (award.QuanNhan?.ho_ten) {
            hoTen = award.QuanNhan.ho_ten;
          } else if (award.CoQuanDonVi?.ten_don_vi) {
            tenDonVi = award.CoQuanDonVi.ten_don_vi;
          } else if (award.DonViTrucThuoc?.ten_don_vi) {
            tenDonVi = award.DonViTrucThuoc.ten_don_vi;
          }
        }
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
      }
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
