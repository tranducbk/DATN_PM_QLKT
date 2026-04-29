import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const militaryFlagRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.huanChuongQuanKyQuyetThang.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.HuanChuongQuanKyQuyetThangFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.HuanChuongQuanKyQuyetThangFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.huanChuongQuanKyQuyetThang.findMany(args);
  },

  findFirstRaw<T extends Prisma.HuanChuongQuanKyQuyetThangFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.HuanChuongQuanKyQuyetThangFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.huanChuongQuanKyQuyetThang.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.HuanChuongQuanKyQuyetThangFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.HuanChuongQuanKyQuyetThangFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.huanChuongQuanKyQuyetThang.findUnique(args);
  },

  groupByYear(tx: PrismaLike = prisma) {
    return tx.huanChuongQuanKyQuyetThang.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });
  },

  count(where: Prisma.HuanChuongQuanKyQuyetThangWhereInput, tx: PrismaLike = prisma) {
    return tx.huanChuongQuanKyQuyetThang.count({ where });
  },

  create(
    data: Prisma.HuanChuongQuanKyQuyetThangUncheckedCreateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.huanChuongQuanKyQuyetThang.create({ data });
  },

  update(
    id: string,
    data: Prisma.HuanChuongQuanKyQuyetThangUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.huanChuongQuanKyQuyetThang.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.huanChuongQuanKyQuyetThang.delete({ where: { id } });
  },
};
