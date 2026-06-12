import { coQuanDonViRepository, donViTrucThuocRepository } from '../repositories/unit.repository';
import { NotFoundError } from '../middlewares/errorHandler';

interface ResolvedUnit {
  id: string;
  isCoQuanDonVi: boolean;
}

/**
 * Resolves a unit ID to determine whether it belongs to CoQuanDonVi or DonViTrucThuoc.
 * @param unitId - The unit ID to resolve
 * @returns The resolved unit info with isCoQuanDonVi flag
 * @throws NotFoundError - When no unit matches the given ID
 */
export async function resolveUnit(unitId: string): Promise<ResolvedUnit> {
  const [coQuanDonVi, donViTrucThuoc] = await Promise.all([
    coQuanDonViRepository.findIdById(unitId),
    donViTrucThuocRepository.findIdById(unitId),
  ]);

  if (!coQuanDonVi && !donViTrucThuoc) {
    throw new NotFoundError('Đơn vị');
  }

  return { id: unitId, isCoQuanDonVi: !!coQuanDonVi };
}

/**
 * Builds the unit ID fields for creating a DanhHieuDonViHangNam record.
 * @param unitId - The unit ID
 * @param isCoQuanDonVi - Whether the unit is a parent unit
 * @returns Object with co_quan_don_vi_id or don_vi_truc_thuoc_id set
 */
export function buildUnitIdFields(unitId: string, isCoQuanDonVi: boolean) {
  return isCoQuanDonVi
    ? { co_quan_don_vi_id: unitId, don_vi_truc_thuoc_id: null }
    : { co_quan_don_vi_id: null, don_vi_truc_thuoc_id: unitId };
}

/**
 * Builds the Prisma where filter for personnel-based medal list endpoints.
 * @param filters - Raw query filters (ho_ten, don_vi_id, include_sub_units, nam, danh_hieu)
 * @returns Prisma where object
 */
export async function buildMedalListWhere(
  filters: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = {};

  const quanNhanFilter: Record<string, unknown> = {};
  if (filters.ho_ten) {
    quanNhanFilter.ho_ten = { contains: filters.ho_ten, mode: 'insensitive' };
  }

  if (filters.don_vi_id) {
    if (filters.include_sub_units) {
      // include_sub_units: expand filter to all DVTT under the parent unit
      const donViTrucThuocIds = await donViTrucThuocRepository.findIdsByCoQuanDonViId(
        String(filters.don_vi_id)
      );
      const donViTrucThuocIdList = donViTrucThuocIds.map(d => d.id);
      where.QuanNhan = {
        ...quanNhanFilter,
        OR: [
          { co_quan_don_vi_id: filters.don_vi_id },
          { don_vi_truc_thuoc_id: { in: donViTrucThuocIdList } },
        ],
      };
    } else {
      where.QuanNhan = {
        ...quanNhanFilter,
        OR: [
          { co_quan_don_vi_id: filters.don_vi_id },
          { don_vi_truc_thuoc_id: filters.don_vi_id },
        ],
      };
    }
  } else if (Object.keys(quanNhanFilter).length > 0) {
    where.QuanNhan = quanNhanFilter;
  }

  if (filters.nam) {
    where.nam = parseInt(String(filters.nam), 10);
  }

  if (filters.danh_hieu) {
    where.danh_hieu = filters.danh_hieu;
  }

  return where;
}
