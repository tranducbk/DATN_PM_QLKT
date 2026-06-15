import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import { positionHistoryRepository } from '../../repositories/positionHistory.repository';
import { positionRepository } from '../../repositories/position.repository';
import { calculateTenureMonthsWithDayPrecision } from '../../helpers/serviceYearsHelper';

type RotateTx = Prisma.TransactionClient | typeof prisma;

/**
 * Records the newly assigned position in history. Closes the open period and opens a new one —
 * EXCEPT when the open period already started today, in which case it replaces that period in place
 * so changing position several times the same day never stacks redundant 0-day entries.
 * @param tx - Transaction client (or prisma)
 * @param quanNhanId - Personnel ID
 * @param newChucVuId - Position now assigned to the personnel
 * @param asOf - Boundary date: closes the open period and starts the new one
 * @returns void
 */
export async function rotatePositionHistory(
  tx: RotateTx,
  quanNhanId: string,
  newChucVuId: string,
  asOf: Date
): Promise<void> {
  const openHistories = await positionHistoryRepository.findManyRaw(
    { where: { quan_nhan_id: quanNhanId, ngay_ket_thuc: null } },
    tx
  );
  const newChucVu = await positionRepository.findUniqueRaw(
    { where: { id: newChucVuId }, select: { he_so_chuc_vu: true } },
    tx
  );
  const heSo = Number(newChucVu?.he_so_chuc_vu ?? 0);

  // Same-day re-edit: the open period already started today → replace it in place instead of
  // stacking a redundant 0-day entry every time the position is changed during the same day.
  const open = openHistories[0];
  if (open) {
    const start = new Date(open.ngay_bat_dau);
    const sameDay =
      start.getFullYear() === asOf.getFullYear() &&
      start.getMonth() === asOf.getMonth() &&
      start.getDate() === asOf.getDate();
    if (sameDay) {
      await positionHistoryRepository.update(
        open.id,
        { chuc_vu_id: newChucVuId, he_so_chuc_vu: heSo },
        tx
      );
      return;
    }
  }

  for (const history of openHistories) {
    const soThang = calculateTenureMonthsWithDayPrecision(new Date(history.ngay_bat_dau), asOf);
    await positionHistoryRepository.update(
      history.id,
      { ngay_ket_thuc: asOf, so_thang: soThang },
      tx
    );
  }
  await positionHistoryRepository.create(
    {
      quan_nhan_id: quanNhanId,
      chuc_vu_id: newChucVuId,
      he_so_chuc_vu: heSo,
      ngay_bat_dau: asOf,
      ngay_ket_thuc: null,
      so_thang: null,
    },
    tx
  );
}
