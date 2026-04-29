import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const scientificAchievementRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.thanhTichKhoaHoc.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.ThanhTichKhoaHocFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ThanhTichKhoaHocFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.thanhTichKhoaHoc.findMany(args);
  },

  findFirstRaw<T extends Prisma.ThanhTichKhoaHocFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ThanhTichKhoaHocFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.thanhTichKhoaHoc.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.ThanhTichKhoaHocFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ThanhTichKhoaHocFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.thanhTichKhoaHoc.findUnique(args);
  },

  groupByLoai(where: Prisma.ThanhTichKhoaHocWhereInput = {}, tx: PrismaLike = prisma) {
    return tx.thanhTichKhoaHoc.groupBy({
      by: ['loai'],
      where,
      _count: { id: true },
    });
  },

  count(where: Prisma.ThanhTichKhoaHocWhereInput, tx: PrismaLike = prisma) {
    return tx.thanhTichKhoaHoc.count({ where });
  },

  create(data: Prisma.ThanhTichKhoaHocUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.thanhTichKhoaHoc.create({ data });
  },

  update(id: string, data: Prisma.ThanhTichKhoaHocUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.thanhTichKhoaHoc.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.thanhTichKhoaHoc.delete({ where: { id } });
  },
};
