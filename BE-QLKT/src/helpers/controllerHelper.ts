import { Request } from 'express';
import { quanNhanRepository } from '../repositories/quanNhan.repository';
import { donViTrucThuocRepository } from '../repositories/unit.repository';
import { ROLES } from '../constants/roles.constants';

/**
 * Gets the admin username from the request.
 * @param req - Express request
 * @returns Admin username, or Admin as fallback
 */
export function getAdminUsername(req: Request): string {
  return req.user?.username ?? 'Admin';
}

/**
 * Parses personnel_ids from query string values.
 * @param query - Express request query object
 * @returns Normalized personnel ID list
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
 * Gets the current manager's unit context from the request user.
 * @param req - Express request
 * @returns Manager unit filter metadata, or null when unavailable
 */
export async function getManagerUnitFilter(req: Request) {
  const userRole = req.user?.role;
  if (userRole !== ROLES.MANAGER) return null;

  const quanNhanId = req.user?.quan_nhan_id;
  if (!quanNhanId) return null;

  const personnel = await quanNhanRepository.findUnitScope(quanNhanId);
  if (!personnel) return null;

  return {
    co_quan_don_vi_id: personnel.co_quan_don_vi_id,
    don_vi_truc_thuoc_id: personnel.don_vi_truc_thuoc_id,
    don_vi_id: personnel.co_quan_don_vi_id ?? personnel.don_vi_truc_thuoc_id,
    isCoQuanDonVi: !!personnel.co_quan_don_vi_id,
  };
}

/**
 * Gets subordinate unit IDs for a parent unit.
 * @param coQuanDonViId - Parent unit ID
 * @returns List of subordinate unit IDs
 */
export async function getSubordinateUnitIds(coQuanDonViId: string): Promise<string[]> {
  const list = await donViTrucThuocRepository.findIdsByCoQuanDonViId(coQuanDonViId);
  return list.map(d => d.id);
}

/**
 * Resolves the manager's unit context including subordinate unit IDs.
 * Returns metadata for service-level filters, not a Prisma where object.
 * @param req - Express request
 * @returns Unit context with optional sub-unit list, or null when not applicable
 */
export async function getManagerUnitContext(req: Request): Promise<Record<string, unknown> | null> {
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
 * Builds a Prisma where condition for personnel filtering by unit.
 * Reused by manager-based filtering and explicit unit_id filtering.
 *
 * - If the unit is a parent unit, includes personnel in the parent or its subordinate units.
 * - If the unit is a subordinate unit, filters directly by that subordinate unit.
 *
 * @param unit - Unit payload containing co_quan_don_vi_id or don_vi_truc_thuoc_id
 * @param extraFilter - Optional additional personnel filters
 * @returns Prisma where condition for personnel, or null when no unit is available
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
 * Helper that builds manager-scoped personnel filter directly from request context.
 * Combines getManagerUnitFilter and buildUnitWhereFilter.
 *
 * @param req - Express request
 * @param extraFilter - Optional additional personnel filters
 * @returns Prisma where condition for personnel, or null when request user is not a manager
 */
export async function buildManagerQuanNhanFilter(
  req: Request,
  extraFilter?: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const managerUnit = await getManagerUnitFilter(req);
  if (!managerUnit) return null;
  return buildUnitWhereFilter(managerUnit, extraFilter);
}

/**
 * Normalizes a route param that may be a string or string array to a single string.
 * @param value - Route param value from Express params
 * @returns The first element if array, or the value itself
 */
export function resolveIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
