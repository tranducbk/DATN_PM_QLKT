import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const tenureMedalRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.findUnique({ where: { id } });
  },

  findMany(args: Prisma.KhenThuongHCCSVVFindManyArgs, tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.findMany(args);
  },

  findManyRaw<T extends Prisma.KhenThuongHCCSVVFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCCSVVFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCCSVV.findMany(args);
  },

  findFirstRaw<T extends Prisma.KhenThuongHCCSVVFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCCSVVFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCCSVV.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.KhenThuongHCCSVVFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCCSVVFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCCSVV.findUnique(args);
  },

  groupByDanhHieu(tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.groupBy({
      by: ['danh_hieu'],
      _count: { id: true },
    });
  },

  groupByYear(tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });
  },

  count(where: Prisma.KhenThuongHCCSVVWhereInput, tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.count({ where });
  },

  create(data: Prisma.KhenThuongHCCSVVUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.create({ data });
  },

  createRaw<T extends Prisma.KhenThuongHCCSVVCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongHCCSVVCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongHCCSVV.create(args);
  },

  update(id: string, data: Prisma.KhenThuongHCCSVVUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.khenThuongHCCSVV.delete({ where: { id } });
  },
};
