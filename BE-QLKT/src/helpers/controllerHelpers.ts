import { Request } from 'express';
import { prisma } from '../models';
import { ROLES } from '../constants/roles.constants';

/**
 * Lấy username của admin từ request, fallback về 'Admin' nếu không có.
 * @param req - Express request
 * @returns username string
 */
export function getAdminUsername(req: Request): string {
  return req.user?.username ?? 'Admin';
}

/**
 * Parse personnel_ids từ query string (dùng chung cho các award controllers)
 */
export function parsePersonnelIdsFromQuery(query: Request['query']): string[] {
  const raw = query.personnel_ids;
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Lấy thông tin đơn vị của Manager từ quân nhân ID.
 * Trả về unit filter hoặc null nếu không phải Manager / không tìm thấy.
 */
export async function getManagerUnitFilter(req: Request) {
  const userRole = req.user?.role;
  if (userRole !== ROLES.MANAGER) return null;

  const quanNhanId = req.user?.quan_nhan_id;
  if (!quanNhanId) return null;

  const personnel = await prisma.quanNhan.findUnique({
    where: { id: quanNhanId },
    select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
  });
  if (!personnel) return null;

  return {
    co_quan_don_vi_id: personnel.co_quan_don_vi_id,
    don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id,
    don_vi_id: personnel.co_quan_don_vi_id ?? personnel.don_vi_truc_thuoc_id,
    isCoQuanDonVi: !!personnel.co_quan_don_vi_id,
  };
}

/**
 * Lấy danh sách ID đơn vị trực thuộc của 1 cơ quan đơn vị
 */
export async function getSubordinateUnitIds(coQuanDonViId: string): Promise<string[]> {
  const list = await prisma.donViTrucThuoc.findMany({
    where: { co_quan_don_vi_id: coQuanDonViId },
    select: { id: true },
  });
  return list.map(d => d.id);
}

/**
 * Xây dựng filter cho Manager dựa trên đơn vị.
 * Trả về object để dùng làm Prisma where condition.
 */
export async function buildManagerUnitWhere(req: Request): Promise<Record<string, unknown> | null> {
  const unit = await getManagerUnitFilter(req);
  if (!unit) return null;

  if (unit.co_quan_don_vi_id) {
    const subUnitIds = await getSubordinateUnitIds(unit.co_quan_don_vi_id);
    return {
      don_vi_id: unit.co_quan_don_vi_id,
      include_sub_units: true,
      sub_unit_ids: subUnitIds,
    };
  }

  if (unit.don_vi_truc_thuoc_id) {
    return { don_vi_id: unit.don_vi_truc_thuoc_id };
  }

  return null;
}

/**
 * Xây dựng Prisma where condition để lọc QuanNhan theo đơn vị.
 * Dùng chung cho cả manager filter và unit_id filter.
 *
 * - Nếu unitId là cơ quan đơn vị: lọc quân nhân thuộc cơ quan đó HOẶC thuộc đơn vị trực thuộc của nó
 * - Nếu unitId là đơn vị trực thuộc: lọc quân nhân thuộc đơn vị trực thuộc đó
 *
 * @param unit - Object chứa co_quan_don_vi_id hoặc don_vi_truc_thuoc_id
 * @param extraFilter - Các điều kiện QuanNhan bổ sung (vd: lọc theo ho_ten)
 * @returns Prisma where condition cho QuanNhan, hoặc null nếu không có unit
 */
export async function buildUnitWhereFilter(
  unit: { co_quan_don_vi_id?: string | null; don_vi_truc_thuoc_id?: string | null },
  extraFilter?: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  if (unit.co_quan_don_vi_id) {
    const donViTrucThuocIds = await getSubordinateUnitIds(unit.co_quan_don_vi_id);
    return {
      ...extraFilter,
      OR: [
        { co_quan_don_vi_id: unit.co_quan_don_vi_id },
        ...(donViTrucThuocIds.length > 0
          ? [{ don_vi_truc_thuoc_id: { in: donViTrucThuocIds } }]
          : []),
      ],
    };
  }

  if (unit.don_vi_truc_thuoc_id) {
    return {
      ...extraFilter,
      don_vi_truc_thuoc_id: unit.don_vi_truc_thuoc_id,
    };
  }

  return null;
}

/**
 * Tiện ích: lấy unit filter của Manager từ request và xây dựng Prisma QuanNhan where.
 * Kết hợp getManagerUnitFilter + buildUnitWhereFilter.
 *
 * @returns Prisma where condition cho QuanNhan, hoặc null nếu không phải Manager
 */
export async function buildManagerQuanNhanFilter(
  req: Request,
  extraFilter?: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const managerUnit = await getManagerUnitFilter(req);
  if (!managerUnit) return null;
  return buildUnitWhereFilter(managerUnit, extraFilter);
}
