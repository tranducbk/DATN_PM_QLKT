/*
 * ════════════════════════════════════════════════════════════════════════════
 *  REPOSITORY PATTERN — wrapper quanh Prisma client
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WHY REPOSITORY LAYER:
 *  - Tách concern: service = business logic, repository = DB access.
 *  - Easy mock trong test (mock 1 repo method, không mock toàn Prisma).
 *  - Centralized query: đổi DB chỉ sửa repository.
 *  - Domain methods rõ ý đồ hơn raw query.
 *
 *  TRANSACTION SUPPORT:
 *  Method nhận optional `tx?: Prisma.TransactionClient` để dùng trong
 *  $transaction. Null → dùng prisma client mặc định.
 *
 *  ⚠️ ATTT cho account:
 *  - findById KHÔNG select password_hash mặc định.
 *  - Chỉ login flow mới select để bcrypt.compare.
 *  - Mọi response API KHÔNG include password_hash.
 * ════════════════════════════════════════════════════════════════════════════
 */

import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const accountRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.taiKhoan.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.TaiKhoanFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaiKhoanFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.taiKhoan.findMany(args);
  },

  findFirstRaw<T extends Prisma.TaiKhoanFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaiKhoanFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.taiKhoan.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.TaiKhoanFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaiKhoanFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.taiKhoan.findUnique(args);
  },

  groupByRole(tx: PrismaLike = prisma) {
    return tx.taiKhoan.groupBy({ by: ['role'], _count: { id: true } });
  },

  count(where: Prisma.TaiKhoanWhereInput, tx: PrismaLike = prisma) {
    return tx.taiKhoan.count({ where });
  },

  create(data: Prisma.TaiKhoanUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.taiKhoan.create({ data });
  },

  createMany(data: Prisma.TaiKhoanCreateManyInput[], tx: PrismaLike = prisma) {
    return tx.taiKhoan.createMany({ data });
  },

  update(id: string, data: Prisma.TaiKhoanUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.taiKhoan.update({ where: { id }, data });
  },

  updateRaw<T extends Prisma.TaiKhoanUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaiKhoanUpdateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.taiKhoan.update(args);
  },

  updateMany(where: Prisma.TaiKhoanWhereInput, data: Prisma.TaiKhoanUncheckedUpdateManyInput, tx: PrismaLike = prisma) {
    return tx.taiKhoan.updateMany({ where, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.taiKhoan.delete({ where: { id } });
  },
};
