import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';

type AdjustTx = Prisma.TransactionClient | typeof prisma;

/** Increments or decrements the personnel count on a unit (CoQuanDonVi or DonViTrucThuoc). */
export async function adjustUnitCount(
  tx: AdjustTx,
  unitId: string,
  isCoQuanDonVi: boolean,
  direction: 'increment' | 'decrement'
) {
  const repo = isCoQuanDonVi ? coQuanDonViRepository : donViTrucThuocRepository;
  if (direction === 'increment') {
    await repo.incrementSoLuong(unitId, tx);
  } else {
    await repo.decrementSoLuong(unitId, tx);
  }
}
