import type { Prisma } from '../../generated/prisma';
import { danhHieuDonViHangNamRepository } from '../../repositories/danhHieu.repository';
import { quanNhanRepository } from '../../repositories/quanNhan.repository';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';
import { unitAnnualProfileRepository } from '../../repositories/unitAnnualProfile.repository';
import {
  getDanhHieuName,
  formatDanhHieuList,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_DON_VI_CO_BAN,
  DANH_HIEU_DON_VI_BANG_KHEN,
} from '../../constants/danhHieu.constants';
import { ROLES } from '../../constants/roles.constants';
import { NotFoundError, ValidationError, ForbiddenError } from '../../middlewares/errorHandler';
import { resolveUnit, buildUnitIdFields } from '../../helpers/unitHelper';
import { validateDecisionNumbers } from '../eligibility/decisionNumberValidation';
import { recalculateAnnualUnit as defaultRecalculateAnnualUnit } from './eligibility';
import type { UnitAnnualAwardDeps } from './types';

const defaultDeps: UnitAnnualAwardDeps = {
  recalculateAnnualUnit: defaultRecalculateAnnualUnit,
  checkUnitAwardEligibility: async () => ({ eligible: true, reason: '' }),
  getSubUnits: async () => [],
};

export async function getSubUnits(coQuanDonViId) {
  const subUnits = await donViTrucThuocRepository.findIdsByCoQuanDonViId(coQuanDonViId);
  return subUnits.map(u => u.id);
}

export async function list(
  {
    page = 1,
    limit = 10,
    year,
    donViId,
    danhHieu,
    userRole,
    userQuanNhanId,
  }: Record<string, any> = {},
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const where: Record<string, any> = {};
  if (year) where.nam = Number(year);
  if (danhHieu) where.danh_hieu = danhHieu;

  let allowedUnitIds: string[] | null = null;
  if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (user) {
      if (userRole === ROLES.MANAGER && user.co_quan_don_vi_id) {
        const subUnitIds = await deps.getSubUnits(user.co_quan_don_vi_id);
        allowedUnitIds = [user.co_quan_don_vi_id, ...subUnitIds];
        where.OR = [
          { co_quan_don_vi_id: user.co_quan_don_vi_id },
          { don_vi_truc_thuoc_id: { in: subUnitIds } },
        ];
      } else if (userRole === ROLES.MANAGER && user.don_vi_truc_thuoc_id) {
        allowedUnitIds = [user.don_vi_truc_thuoc_id];
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      } else if (userRole === ROLES.USER && user.don_vi_truc_thuoc_id) {
        allowedUnitIds = [user.don_vi_truc_thuoc_id];
        where.don_vi_truc_thuoc_id = user.don_vi_truc_thuoc_id;
      }
    } else {
      return {
        data: [],
        pagination: { total: 0, page: Number(page), limit: Number(limit), totalPages: 0 },
      };
    }
  }

  if (donViId) {
    if (allowedUnitIds && !allowedUnitIds.includes(donViId)) {
      // donViId outside allowed scope — keep scoping, ignore the filter
    } else {
      where.OR = [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }];
    }
  }

  const [total, awards] = await Promise.all([
    danhHieuDonViHangNamRepository.count({ where }),
    danhHieuDonViHangNamRepository.findMany({
      where,
      orderBy: [{ nam: 'desc' }, { createdAt: 'desc' }],
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { CoQuanDonVi: true, DonViTrucThuoc: true },
    }),
  ]);

  return {
    data: awards,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

export async function getById(
  id: string,
  userRole: string,
  userQuanNhanId: string,
  _deps: UnitAnnualAwardDeps = defaultDeps
) {
  const record = await danhHieuDonViHangNamRepository.findUnique({
    where: { id: String(id) },
    include: { CoQuanDonVi: true, DonViTrucThuoc: true },
  });

  if (!record) return null;

  if ((userRole === ROLES.USER || userRole === ROLES.MANAGER) && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (!user) return null;

    const recordDonViId = record.co_quan_don_vi_id || record.don_vi_truc_thuoc_id;

    if (userRole === ROLES.MANAGER) {
      if (
        user.co_quan_don_vi_id !== record.co_quan_don_vi_id &&
        user.co_quan_don_vi_id !== recordDonViId
      ) {
        return null;
      }
    } else if (userRole === ROLES.USER) {
      if (user.don_vi_truc_thuoc_id !== recordDonViId) {
        return null;
      }
    }
  }

  return record;
}

export async function upsert(
  {
    don_vi_id,
    nam,
    danh_hieu,
    so_quyet_dinh,
    ghi_chu,
    nguoi_tao_id,
  }: {
    don_vi_id: string;
    nam: number | string;
    danh_hieu?: string | null;
    so_quyet_dinh?: string | null;
    ghi_chu?: string | null;
    nguoi_tao_id: string;
  },
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const year = Number(nam);
  const unitId = don_vi_id;

  const { isCoQuanDonVi } = await resolveUnit(unitId);

  if (danh_hieu) {
    const existing = await danhHieuDonViHangNamRepository.findFirst({
      where: {
        OR: [
          { co_quan_don_vi_id: unitId, nam: year },
          { don_vi_truc_thuoc_id: unitId, nam: year },
        ],
      },
      select: { danh_hieu: true, nhan_bkbqp: true, nhan_bkttcp: true },
    });

    if (existing) {
      const isDv = DANH_HIEU_DON_VI_CO_BAN.has(danh_hieu);
      const isBkbqp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
      const isBkttcp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;

      if (isDv && existing.danh_hieu) {
        throw new ValidationError(
          `Đơn vị đã có danh hiệu ${getDanhHieuName(existing.danh_hieu)} năm ${year}`
        );
      }
      if (isBkbqp && existing.nhan_bkbqp) {
        throw new ValidationError(
          `Đơn vị đã có ${getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKBQP)} năm ${year}`
        );
      }
      if (isBkttcp && existing.nhan_bkttcp) {
        throw new ValidationError(
          `Đơn vị đã có ${getDanhHieuName(DANH_HIEU_DON_VI_HANG_NAM.BKTTCP)} năm ${year}`
        );
      }
    }
  }

  const whereCondition = isCoQuanDonVi
    ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam: year } }
    : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam: year } };

  const isBk = DANH_HIEU_DON_VI_BANG_KHEN.has(danh_hieu || '');
  const isBkbqp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKBQP;
  const isBkttcp = danh_hieu === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP;

  if (danh_hieu) {
    const decisionErrors = validateDecisionNumbers(
      {
        danh_hieu: isBk ? null : danh_hieu,
        so_quyet_dinh: isBk ? null : so_quyet_dinh,
        nhan_bkbqp: isBkbqp,
        so_quyet_dinh_bkbqp: isBkbqp ? so_quyet_dinh : null,
        nhan_bkttcp: isBkttcp,
        so_quyet_dinh_bkttcp: isBkttcp ? so_quyet_dinh : null,
      },
      { entityType: 'unit', entityName: unitId }
    );
    if (decisionErrors.length > 0) {
      throw new ValidationError(decisionErrors.join('\n'));
    }
  }

  const updateData: Record<string, unknown> = {};
  if (isBk) {
    if (isBkbqp) {
      updateData.nhan_bkbqp = true;
      if (so_quyet_dinh) updateData.so_quyet_dinh_bkbqp = so_quyet_dinh;
      if (ghi_chu) updateData.ghi_chu_bkbqp = ghi_chu;
    }
    if (isBkttcp) {
      updateData.nhan_bkttcp = true;
      if (so_quyet_dinh) updateData.so_quyet_dinh_bkttcp = so_quyet_dinh;
      if (ghi_chu) updateData.ghi_chu_bkttcp = ghi_chu;
    }
  } else {
    updateData.danh_hieu = danh_hieu || null;
    if (so_quyet_dinh) updateData.so_quyet_dinh = so_quyet_dinh;
    if (ghi_chu) updateData.ghi_chu = ghi_chu;
  }

  const record = await danhHieuDonViHangNamRepository.upsert({
    where: whereCondition,
    update: updateData,
    create: {
      ...buildUnitIdFields(unitId, isCoQuanDonVi),
      nam: year,
      danh_hieu: isBk ? null : danh_hieu || null,
      so_quyet_dinh: isBk ? null : so_quyet_dinh || null,
      ghi_chu: isBk ? null : ghi_chu || null,
      nhan_bkbqp: isBkbqp,
      ...(isBkbqp && so_quyet_dinh && { so_quyet_dinh_bkbqp: so_quyet_dinh }),
      ...(isBkbqp && ghi_chu && { ghi_chu_bkbqp: ghi_chu }),
      nhan_bkttcp: isBkttcp,
      ...(isBkttcp && so_quyet_dinh && { so_quyet_dinh_bkttcp: so_quyet_dinh }),
      ...(isBkttcp && ghi_chu && { ghi_chu_bkttcp: ghi_chu }),
      nguoi_tao_id: nguoi_tao_id,
    },
    include: { CoQuanDonVi: true, DonViTrucThuoc: true },
  });

  await deps.recalculateAnnualUnit(unitId, year);

  return record;
}

export async function remove(
  id: string,
  awardType?: string | null,
  deps: UnitAnnualAwardDeps = defaultDeps
) {
  const danhHieu = await danhHieuDonViHangNamRepository.findUnique({
    where: { id: String(id) },
    include: {
      CoQuanDonVi: { select: { ten_don_vi: true } },
      DonViTrucThuoc: { select: { ten_don_vi: true } },
    },
  });

  if (!danhHieu) {
    throw new NotFoundError('Danh hiệu đơn vị hằng năm');
  }

  const donViId = danhHieu.co_quan_don_vi_id || danhHieu.don_vi_truc_thuoc_id;

  if (awardType) {
    const validTypes = new Set<string>([...DANH_HIEU_DON_VI_CO_BAN, ...DANH_HIEU_DON_VI_BANG_KHEN]);
    if (!validTypes.has(awardType)) {
      throw new ValidationError(
        `Loại danh hiệu không hợp lệ. Chỉ được chọn: ${formatDanhHieuList([...validTypes])}.`
      );
    }

    const updateData: Prisma.DanhHieuDonViHangNamUncheckedUpdateInput = {};
    const isBaseAward = DANH_HIEU_DON_VI_CO_BAN.has(awardType);

    if (isBaseAward) {
      if (danhHieu.danh_hieu !== awardType) {
        throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
      }
      updateData.danh_hieu = null;
      updateData.so_quyet_dinh = null;
      updateData.ghi_chu = null;
    } else if (awardType === DANH_HIEU_DON_VI_HANG_NAM.BKBQP) {
      if (!danhHieu.nhan_bkbqp) {
        throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
      }
      updateData.nhan_bkbqp = false;
      updateData.so_quyet_dinh_bkbqp = null;
      updateData.ghi_chu_bkbqp = null;
    } else if (awardType === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP) {
      if (!danhHieu.nhan_bkttcp) {
        throw new ValidationError(`Bản ghi không có ${getDanhHieuName(awardType)}`);
      }
      updateData.nhan_bkttcp = false;
      updateData.so_quyet_dinh_bkttcp = null;
      updateData.ghi_chu_bkttcp = null;
    }

    const remainingDanhHieu = isBaseAward ? null : danhHieu.danh_hieu;
    const remainingBkbqp =
      awardType === DANH_HIEU_DON_VI_HANG_NAM.BKBQP ? false : danhHieu.nhan_bkbqp;
    const remainingBkttcp =
      awardType === DANH_HIEU_DON_VI_HANG_NAM.BKTTCP ? false : danhHieu.nhan_bkttcp;
    const isEmpty = !remainingDanhHieu && !remainingBkbqp && !remainingBkttcp;

    if (isEmpty) {
      await danhHieuDonViHangNamRepository.delete(String(id));
    } else {
      await danhHieuDonViHangNamRepository.updateRaw({
        where: { id: String(id) },
        data: updateData,
      });
    }

    await deps.recalculateAnnualUnit(donViId, danhHieu.nam);
    return danhHieu;
  }

  await danhHieuDonViHangNamRepository.delete(String(id));

  await deps.recalculateAnnualUnit(donViId, danhHieu.nam);

  return danhHieu;
}

export async function getAnnualUnit(donViId: string, year: number) {
  year = Number(year);
  const { isCoQuanDonVi } = await resolveUnit(donViId);

  let profile = await unitAnnualProfileRepository.findFirstRaw({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
      nam: year,
    },
    orderBy: { nam: 'desc' },
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: true,
    },
  });

  if (!profile) {
    const currentYear = new Date().getFullYear();
    profile = await unitAnnualProfileRepository.createRaw({
      data: {
        ...buildUnitIdFields(donViId, isCoQuanDonVi),
        nam: currentYear,
        tong_dvqt: 0,
        tong_dvqt_json: [],
        dvqt_lien_tuc: 0,
        du_dieu_kien_bkbqp: false,
        du_dieu_kien_bkttcp: false,
        goi_y: 'Chưa có dữ liệu để tính toán. Vui lòng nhập danh hiệu đơn vị.',
      },
      include: {
        CoQuanDonVi: true,
        DonViTrucThuoc: true,
      },
    });
  }

  return profile;
}

export async function getUnitAnnualAwards(
  donViId: string,
  userRole: string = ROLES.ADMIN,
  userQuanNhanId: string | null = null
) {
  if (!donViId) throw new ValidationError('don_vi_id là bắt buộc');

  const donVi =
    (await coQuanDonViRepository.findById(donViId)) ||
    (await donViTrucThuocRepository.findById(donViId));

  if (!donVi) throw new NotFoundError('Đơn vị');

  if (userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN) {
  } else if ((userRole === ROLES.MANAGER || userRole === ROLES.USER) && userQuanNhanId) {
    const user = await quanNhanRepository.findUnitScope(userQuanNhanId);

    if (!user) throw new NotFoundError('Thông tin người dùng');

    if (userRole === ROLES.MANAGER) {
      const targetCoQuanId =
        'co_quan_don_vi_id' in donVi && donVi.co_quan_don_vi_id
          ? donVi.co_quan_don_vi_id
          : donVi.id;
      if (!user.co_quan_don_vi_id || user.co_quan_don_vi_id !== targetCoQuanId) {
        throw new ForbiddenError('Không có quyền xem lịch sử khen thưởng của đơn vị này');
      }
    } else if (userRole === ROLES.USER) {
      if (!user.don_vi_truc_thuoc_id || user.don_vi_truc_thuoc_id !== donViId) {
        throw new ForbiddenError('Không có quyền xem lịch sử khen thưởng của đơn vị này');
      }
    }
  } else {
    throw new ForbiddenError('Không có quyền truy cập');
  }

  const danhHieuRecords = await danhHieuDonViHangNamRepository.findMany({
    where: {
      OR: [{ co_quan_don_vi_id: donViId }, { don_vi_truc_thuoc_id: donViId }],
    },
    orderBy: { nam: 'desc' },
  });

  return danhHieuRecords;
}
