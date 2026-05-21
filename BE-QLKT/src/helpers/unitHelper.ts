/*
 * ════════════════════════════════════════════════════════════════════════════
 *  UNIT HELPER — resolve đơn vị (CQDV/DVTT) + build FK fields
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  resolveUnit(unitId): tự xác định ID thuộc CQDV hay DVTT bằng cách
 *  query cả 2 bảng. Lý do:
 *  - Caller có 1 ID nhưng KHÔNG biết loại đơn vị (vd: import Excel).
 *
 *  buildUnitIdFields(unit): tạo { co_quan_don_vi_id, don_vi_truc_thuoc_id }
 *  với 1 field set, 1 field null. Dùng cho insert Prisma.
 *
 *  PATTERN UNIT FK trong DB:
 *  Mọi bảng có FK đơn vị đều có 2 field cùng lúc (1 NULL):
 *      QuanNhan, DanhHieuDonViHangNam, HoSoDonViHangNam, BangDeXuat...
 *
 *  Trade-off vs polymorphic FK:
 *  - Polymorphic: 1 field nhưng mất referential integrity.
 *  - 2 nullable: FK constraint mạnh, JOIN rõ ràng. → Chọn 2 nullable.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
 * Builds the Prisma unique where condition for DanhHieuDonViHangNam based on unit type.
 * @param unitId - The unit ID
 * @param isCoQuanDonVi - Whether the unit is a parent unit
 * @param nam - The year
 * @returns Prisma unique where clause
 */
export function buildUnitAwardWhereCondition(unitId: string, isCoQuanDonVi: boolean, nam: number) {
  return isCoQuanDonVi
    ? { unique_co_quan_don_vi_nam_dh: { co_quan_don_vi_id: unitId, nam } }
    : { unique_don_vi_truc_thuoc_nam_dh: { don_vi_truc_thuoc_id: unitId, nam } };
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
