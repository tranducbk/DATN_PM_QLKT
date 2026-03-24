import { Request } from 'express';
import { prisma } from '../models';
import { ROLES } from '../constants/roles';

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
