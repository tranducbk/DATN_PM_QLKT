import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import { Request, Response } from 'express';
import {
  FALLBACK,
  parseResponseData,
  asRecord,
  queryPersonnelName,
  getUnitNameFromUnitId,
  getFileName,
} from './constants';
import { getDanhHieuName, resolveDanhHieuFromRecord } from '../../constants/danhHieu.constants';
import { ADHOC_TYPE } from '../../constants/adhocType.constants';
import { PROPOSAL_TYPES } from '../../constants/proposalTypes.constants';

/** Normalizes route/query ID values (Express can pass string or string[]). */
function routeParamId(v: string | string[] | undefined | null): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type DanhHieuHangNamWithHoTen = Prisma.DanhHieuHangNamGetPayload<{
  include: { QuanNhan: { select: { ho_ten: true } } };
}>;

type KhenThuongDotXuatWithAuditRels = Prisma.KhenThuongDotXuatGetPayload<{
  include: {
    QuanNhan: { select: { ho_ten: true } };
    CoQuanDonVi: { select: { ten_don_vi: true } };
    DonViTrucThuoc: { select: { ten_don_vi: true } };
  };
}>;

const annualRewards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> = {
  CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const personnelId = req.body?.personnel_id || req.body?.quan_nhan_id || null;

    const danhHieuName = getDanhHieuName(danhHieu);

    let hoTen = '';
    if (personnelId) {
      try {
        const personnel = await prisma.quanNhan.findUnique({
          where: { id: personnelId },
          select: { ho_ten: true },
        });
        hoTen = personnel?.ho_ten || '';
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
      }
    }

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    const xepLoai = req.body?.xep_loai || '';
    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;
    let description = `Tạo danh hiệu hằng năm: ${danhHieuDisplay}${
      hoTen ? ` cho quân nhân ${hoTen}` : ''
    } - Năm ${namDisplay}`;
    if (xepLoai) {
      description += `\n- Xếp loại: ${xepLoai}`;
    }
    return description;
  },
  UPDATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    const rewardId = routeParamId(req.params?.id);

    const danhHieuName = getDanhHieuName(danhHieu);

    let hoTen = '';
    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      } else if (rewardId) {
        const rewardRecord = (await prisma.danhHieuHangNam.findUnique({
          where: { id: rewardId },
          include: { QuanNhan: { select: { ho_ten: true } } },
        })) as DanhHieuHangNamWithHoTen | null;
        hoTen = rewardRecord?.QuanNhan?.ho_ten || '';
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    const xepLoai = req.body?.xep_loai || '';
    const danhHieuDisplay = danhHieuName || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;
    let description = `Cập nhật danh hiệu hằng năm: ${danhHieuDisplay}${
      hoTen ? ` cho quân nhân ${hoTen}` : ''
    } - Năm ${namDisplay}`;
    if (xepLoai) {
      description += `\n- Xếp loại: ${xepLoai}`;
    }
    return description;
  },
  DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    const rewardId = routeParamId(req.params?.id);

    let hoTen = '';
    let danhHieu = '';
    let nam = '';

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const reward = data?.data || data;
      if (reward?.QuanNhan?.ho_ten) {
        hoTen = reward.QuanNhan.ho_ten;
      }
      danhHieu = resolveDanhHieuFromRecord(reward) || danhHieu;
      if (reward?.nam) {
        nam = reward.nam;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    if ((!hoTen || !danhHieu) && rewardId) {
      try {
        const rewardRecord = (await prisma.danhHieuHangNam.findUnique({
          where: { id: rewardId },
          include: { QuanNhan: { select: { ho_ten: true } } },
        })) as DanhHieuHangNamWithHoTen | null;
        if (rewardRecord) {
          hoTen = rewardRecord.QuanNhan?.ho_ten || hoTen;
          danhHieu = resolveDanhHieuFromRecord(rewardRecord) || danhHieu;
          nam = String(rewardRecord.nam ?? nam);
        }
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
      }
    }

    const danhHieuName = getDanhHieuName(danhHieu);

    if (hoTen && danhHieu) {
      return `Xóa danh hiệu hằng năm: ${danhHieuName} của quân nhân ${hoTen}${
        nam ? ` (năm ${nam})` : ''
      }`;
    }

    return `Xóa danh hiệu hằng năm (không xác định được thông tin)`;
  },
  BULK: (req: Request, res: Response, responseData: unknown): string => {
    const danhHieu = req.body?.danh_hieu || '';
    const nam = req.body?.nam || '';
    let personnelCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      const personnelIds =
        typeof req.body?.personnel_ids === 'string'
          ? JSON.parse(req.body.personnel_ids)
          : req.body?.personnel_ids;
      personnelCount = Array.isArray(personnelIds) ? personnelIds.length : 0;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    try {
      const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
      const result = data?.data || data;
      successCount = result?.success || result?.successCount || 0;
      skippedCount = result?.skipped || 0;
      errorCount = result?.errors || 0;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    const danhHieuName = getDanhHieuName(danhHieu) || FALLBACK.UNKNOWN;
    const namDisplay = nam || FALLBACK.UNKNOWN;

    let description = `Thêm đồng loạt danh hiệu hằng năm: ${danhHieuName} - Năm ${namDisplay}`;

    if (successCount > 0 || personnelCount > 0) {
      const parts: string[] = [];
      if (successCount > 0) {
        parts.push(`${successCount} thành công`);
      }
      if (skippedCount > 0) {
        parts.push(`${skippedCount} bỏ qua`);
      }
      if (errorCount > 0) {
        parts.push(`${errorCount} lỗi`);
      }
      if (parts.length > 0) {
        description += ` (${parts.join(', ')}`;
        if (personnelCount > 0) {
          description += ` / ${personnelCount} quân nhân`;
        }
        description += ')';
      } else if (personnelCount > 0) {
        description += ` (${personnelCount} quân nhân)`;
      }
    }

    return description;
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
        return `Import danh hiệu hằng năm từ file: ${fileName} (${successCount} thành công${
          failCount > 0 ? `, ${failCount} thất bại` : ''
        })`;
      }
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      // best-effort — audit description must not throw
    }

    return `Import danh hiệu hằng năm từ file: ${fileName}`;
  },
};

const adhocAwards: Record<
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
          const personnel = await prisma.quanNhan.findUnique({
            where: { id: personnelId },
            select: { ho_ten: true },
          });
          hoTen = personnel?.ho_ten || '';
        } else if (type === 'tập thể' && unitId && unitType) {
          if (unitType === 'CO_QUAN_DON_VI') {
            const unit = await prisma.coQuanDonVi.findUnique({
              where: { id: unitId },
              select: { ten_don_vi: true },
            });
            tenDonVi = unit?.ten_don_vi || '';
          } else if (unitType === 'DON_VI_TRUC_THUOC') {
            const unit = await prisma.donViTrucThuoc.findUnique({
              where: { id: unitId },
              select: { ten_don_vi: true },
            });
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
        const award = (await prisma.khenThuongDotXuat.findUnique({
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
        const award = (await prisma.khenThuongDotXuat.findUnique({
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

/** Bulk create body `type` → wording in audit description. */
const BULK_AUDIT_TYPE: Record<string, string> = {
  CA_NHAN_HANG_NAM: 'Danh hiệu cá nhân hằng năm',
  DON_VI_HANG_NAM: 'Danh hiệu đơn vị hằng năm',
  NCKH: 'Thành tích Nghiên cứu khoa học',
  NIEN_HAN: 'Huy chương Chiến sĩ vẻ vang',
  HC_QKQT: 'Huy chương Quân kỳ quyết thắng',
  KNC_VSNXD_QDNDVN: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  CONG_HIEN: 'Huân chương Bảo vệ Tổ quốc',
};

const awards: Record<
  string,
  (req: Request, res: Response, responseData: unknown) => Promise<string>
> = {
  BULK: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
    try {
      const data = parseResponseData(responseData);
      const result = asRecord(data?.data) || data || {};

      const type = req.body?.type || '';
      const nam = req.body?.nam || '';
      const selectedPersonnel = req.body?.selected_personnel || [];
      const selectedUnits = req.body?.selected_units || [];
      const titleData = req.body?.title_data || [];

      let parsedSelectedPersonnel = selectedPersonnel;
      let parsedSelectedUnits = selectedUnits;
      let parsedTitleData = titleData;

      if (typeof selectedPersonnel === 'string') {
        try {
          parsedSelectedPersonnel = JSON.parse(selectedPersonnel);
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }

      if (typeof selectedUnits === 'string') {
        try {
          parsedSelectedUnits = JSON.parse(selectedUnits);
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }

      if (typeof titleData === 'string') {
        try {
          parsedTitleData = JSON.parse(titleData);
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
          // best-effort — audit description must not throw
        }
      }

      const typeName = BULK_AUDIT_TYPE[type] || type || 'Khen thưởng';

      const importedCount = (result?.importedCount as number) || 0;
      const errorCount = (result?.errorCount as number) || 0;
      const affectedPersonnelIds = (result?.affectedPersonnelIds as string[]) || [];

      let soLuong = 0;
      let donViText = '';
      let danhHieuText = '';

      if (type === PROPOSAL_TYPES.DON_VI_HANG_NAM) {
        soLuong = Array.isArray(parsedSelectedUnits) ? parsedSelectedUnits.length : 0;
        donViText = soLuong > 0 ? `${soLuong} đơn vị` : '';

        if (Array.isArray(parsedTitleData) && parsedTitleData.length > 0) {
          const danhHieus = new Set<string>();
          parsedTitleData.forEach((item: Record<string, unknown>) => {
            if (item.danh_hieu) {
              danhHieus.add(getDanhHieuName(item.danh_hieu as string));
            }
          });
          if (danhHieus.size > 0) {
            danhHieuText = Array.from(danhHieus).join(', ');
          }
        }
      } else {
        soLuong = Array.isArray(parsedSelectedPersonnel)
          ? parsedSelectedPersonnel.length
          : Array.isArray(affectedPersonnelIds)
            ? affectedPersonnelIds.length
            : importedCount || 0;
        donViText = soLuong > 0 ? `${soLuong} quân nhân` : '';

        if (Array.isArray(parsedTitleData) && parsedTitleData.length > 0) {
          if (type === PROPOSAL_TYPES.NCKH) {
            const loais = new Set<string>();
            parsedTitleData.forEach((item: Record<string, unknown>) => {
              if (item.loai) {
                loais.add(getDanhHieuName(item.loai as string));
              }
            });
            if (loais.size > 0) {
              danhHieuText = Array.from(loais).join(', ');
            }
          } else if (type === PROPOSAL_TYPES.HC_QKQT || type === PROPOSAL_TYPES.KNC_VSNXD_QDNDVN) {
            danhHieuText = '';
          } else {
            const danhHieus = new Set<string>();
            parsedTitleData.forEach((item: Record<string, unknown>) => {
              if (item.danh_hieu) {
                danhHieus.add(getDanhHieuName(item.danh_hieu as string));
              }
            });
            if (danhHieus.size > 0) {
              danhHieuText = Array.from(danhHieus).join(', ');
            }
          }
        }
      }

      let description = `Thêm khen thưởng đồng loạt: ${typeName}`;

      if (nam) {
        description += ` năm ${nam}`;
      }

      if (danhHieuText) {
        description += ` - ${danhHieuText}`;
      }

      if (donViText) {
        description += ` (${donViText})`;
      }

      if (importedCount > 0) {
        description += ` - Thành công: ${importedCount}`;
      }

      if (errorCount > 0) {
        description += `, Lỗi: ${errorCount}`;
      }

      return description;
    } catch (error) {
      console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      return 'Thêm khen thưởng đồng loạt';
    }
  },
};

const AWARD_TYPE_NAMES: Record<string, string> = {
  'tenure-medals': 'Huy chương Chiến sĩ vẻ vang',
  'commemorative-medals': 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  'military-flag': 'Huy chương Quân kỳ quyết thắng',
  'contribution-medals': 'Huân chương Bảo vệ Tổ quốc',
};

type AwardModelAccessor = {
  findUnique: (args: {
    where: { id: string };
    include: { QuanNhan: { select: { ho_ten: true } } };
  }) => Promise<{
    quan_nhan_id: string;
    nam: number;
    danh_hieu?: string;
    QuanNhan?: { ho_ten: string } | null;
  } | null>;
};

/** Prisma model accessor keyed by resource slug */
const AWARD_PRISMA_MODEL: Record<string, AwardModelAccessor> = {
  'tenure-medals': prisma.khenThuongHCCSVV as unknown as AwardModelAccessor,
  'commemorative-medals': prisma.kyNiemChuongVSNXDQDNDVN as unknown as AwardModelAccessor,
  'military-flag': prisma.huanChuongQuanKyQuyetThang as unknown as AwardModelAccessor,
  'contribution-medals': prisma.khenThuongHCBVTQ as unknown as AwardModelAccessor,
};

function buildAwardTypeHelpers(
  resource: string
): Record<
  string,
  (req: Request, res: Response, responseData: unknown) => string | Promise<string>
> {
  const typeName = AWARD_TYPE_NAMES[resource] || resource;
  const model = AWARD_PRISMA_MODEL[resource];

  /** Uses specific rank names when available, otherwise falls back to type label. */
  const getAwardLabel = (danhHieu?: string) => {
    if (!danhHieu) return typeName;
    const name = getDanhHieuName(danhHieu);
    return name !== 'Chưa có dữ liệu' ? name : typeName;
  };

  return {
    CREATE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
      const nam = req.body?.nam || '';
      const personnelId = req.body?.quan_nhan_id || null;
      const danhHieu = req.body?.danh_hieu || '';

      let hoTen = '';
      try {
        const data = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        hoTen = (data?.data || data)?.QuanNhan?.ho_ten || '';
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
      }
      if (!hoTen && personnelId) {
        hoTen = await queryPersonnelName(personnelId, prisma);
      }

      let description = `Tạo ${getAwardLabel(danhHieu)}`;
      if (hoTen) description += ` cho quân nhân ${hoTen}`;
      if (nam) description += ` năm ${nam}`;
      return description;
    },

    DELETE: async (req: Request, res: Response, responseData: unknown): Promise<string> => {
      const awardId = routeParamId(req.params?.id);

      let hoTen = '';
      let nam = '';
      let danhHieu = '';

      if (awardId && model) {
        try {
          const record = await model.findUnique({
            where: { id: awardId },
            include: { QuanNhan: { select: { ho_ten: true } } },
          });
          if (record) {
            hoTen = record.QuanNhan?.ho_ten || '';
            nam = String(record.nam ?? '');
            danhHieu = record.danh_hieu || '';
          }
        } catch (error) {
          console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        }
      }

      if (hoTen) {
        return `Xóa ${getAwardLabel(danhHieu)} của quân nhân ${hoTen}${nam ? ` năm ${nam}` : ''}`;
      }
      return `Xóa ${typeName} (không xác định được thông tin)`;
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
          return `Import ${typeName} từ file: ${fileName} (${successCount} thành công${
            failCount > 0 ? `, ${failCount} thất bại` : ''
          })`;
        }
      } catch (error) {
        console.error('Audit log helper fallback triggered (helpers/auditLog/awards.ts):', error);
        // best-effort — audit description must not throw
      }

      return `Import ${typeName} từ file: ${fileName}`;
    },
  };
}

const tenureMedals = buildAwardTypeHelpers('tenure-medals');
const commemorativeMedals = buildAwardTypeHelpers('commemorative-medals');
const militaryFlag = buildAwardTypeHelpers('military-flag');
const contributionMedals = buildAwardTypeHelpers('contribution-medals');

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

const unitAnnualAwards: Record<
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
        const record = await prisma.danhHieuDonViHangNam.findUnique({
          where: { id: rewardId },
          include: {
            CoQuanDonVi: { select: { ten_don_vi: true } },
            DonViTrucThuoc: { select: { ten_don_vi: true } },
          },
        });
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
          const record = await prisma.danhHieuDonViHangNam.findUnique({
            where: { id: rewardId },
            include: {
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          });
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
          const record = await prisma.danhHieuDonViHangNam.findUnique({
            where: { id: rewardId },
            include: {
              CoQuanDonVi: { select: { ten_don_vi: true } },
              DonViTrucThuoc: { select: { ten_don_vi: true } },
            },
          });
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

export {
  annualRewards,
  adhocAwards,
  awards,
  tenureMedals,
  commemorativeMedals,
  militaryFlag,
  contributionMedals,
  unitAnnualAwards,
};
