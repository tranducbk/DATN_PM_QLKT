import type { Prisma } from '../../generated/prisma';
import { prisma } from '../../models';
import {
  coQuanDonViRepository,
  donViTrucThuocRepository,
} from '../../repositories/unit.repository';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  ATOMIC COUNTER — chống race condition khi tăng/giảm so_luong đơn vị
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  VẤN ĐỀ RACE CONDITION:
 *  - so_luong là counter denormalized (lưu số quân nhân thuộc đơn vị).
 *  - 2 admin cùng lúc thêm 2 quân nhân vào cùng đơn vị:
 *
 *      Admin A         Admin B
 *      ─────────       ─────────
 *      read so_luong = 100
 *                      read so_luong = 100
 *      tính 100+1=101
 *                      tính 100+1=101
 *      write 101
 *                      write 101  ← SAI! Phải là 102
 *
 *      → Counter mất 1 unit (lost update problem).
 *
 *  GIẢI PHÁP — PRISMA ATOMIC INCREMENT/DECREMENT:
 *      await prisma.coQuanDonVi.update({
 *        where: { id },
 *        data: { so_luong: { increment: 1 } }
 *      });
 *
 *  Prisma compile thành SQL:
 *      UPDATE CoQuanDonVi SET so_luong = so_luong + 1 WHERE id = X;
 *
 *  Atomicity đảm bảo bởi DB engine (PostgreSQL):
 *      - Postgres dùng row-level lock khi update.
 *      - Read+compute+write làm trong 1 transaction operation.
 *      - 2 query đồng thời → 1 thắng + lock → 1 chờ → cả 2 đều cộng đúng.
 *
 *  TRANSACTION CONTEXT (`tx: AdjustTx`):
 *  - Caller pass PrismaTx (transaction client) → counter update nằm
 *    cùng transaction với insert/update QuanNhan.
 *  - Nếu insert fail → rollback → so_luong cũng revert.
 *  - Đảm bảo NHẤT QUÁN: không bao giờ insert thành công mà counter quên
 *    update, hoặc ngược lại.
 *
 *  KHI TRANSFER QUÂN NHÂN GIỮA 2 ĐƠN VỊ:
 *      decrement(unit cũ)
 *      increment(unit mới)
 *  Cả 2 phải nằm trong cùng transaction → đảm bảo tổng count không đổi
 *  giữa chừng (race-free).
 *
 *  ALTERNATIVE đã loại trừ:
 *  - COUNT(*) on-the-fly mỗi query: chậm với DB lớn, đặc biệt khi
 *    dashboard query 100 đơn vị.
 *  - Materialized view: thêm dependency, refresh trigger phức tạp.
 *  - Counter + scheduled reconcile: vẫn không an toàn nếu race trong
 *    cửa sổ reconcile.
 *
 *  → Atomic counter là lựa chọn TỐI ƯU: nhanh + an toàn race.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
