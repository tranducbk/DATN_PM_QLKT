import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const decisionFileRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.fileQuyetDinh.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.FileQuyetDinhFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.FileQuyetDinhFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.fileQuyetDinh.findMany(args);
  },

  findFirstRaw<T extends Prisma.FileQuyetDinhFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.FileQuyetDinhFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.fileQuyetDinh.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.FileQuyetDinhFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FileQuyetDinhFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.fileQuyetDinh.findUnique(args);
  },

  groupByLoaiKhenThuong(tx: PrismaLike = prisma) {
    return tx.fileQuyetDinh.groupBy({
      by: ['loai_khen_thuong'],
      where: { loai_khen_thuong: { not: null } },
      _count: { id: true },
    });
  },

  count(where: Prisma.FileQuyetDinhWhereInput, tx: PrismaLike = prisma) {
    return tx.fileQuyetDinh.count({ where });
  },

  create(data: Prisma.FileQuyetDinhUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.fileQuyetDinh.create({ data });
  },

  update(id: string, data: Prisma.FileQuyetDinhUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.fileQuyetDinh.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.fileQuyetDinh.delete({ where: { id } });
  },
};
