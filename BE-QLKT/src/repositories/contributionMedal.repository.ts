import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const contributionMedalRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.KhenThuongHCBVTQFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCBVTQFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCBVTQ.findMany(args);
  },

  findFirstRaw<T extends Prisma.KhenThuongHCBVTQFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCBVTQFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCBVTQ.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.KhenThuongHCBVTQFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCBVTQFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCBVTQ.findUnique(args);
  },

  groupByDanhHieu(tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.groupBy({
      by: ['danh_hieu'],
      _count: { id: true },
    });
  },

  groupByYear(tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });
  },

  count(where: Prisma.KhenThuongHCBVTQWhereInput, tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.count({ where });
  },

  create(data: Prisma.KhenThuongHCBVTQUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.create({ data });
  },

  update(id: string, data: Prisma.KhenThuongHCBVTQUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.khenThuongHCBVTQ.delete({ where: { id } });
  },
};
