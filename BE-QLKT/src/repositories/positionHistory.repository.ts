import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const positionHistoryRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.lichSuChucVu.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.LichSuChucVuFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.LichSuChucVuFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.lichSuChucVu.findMany(args);
  },

  findUniqueRaw<T extends Prisma.LichSuChucVuFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.LichSuChucVuFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.lichSuChucVu.findUnique(args);
  },

  count(where: Prisma.LichSuChucVuWhereInput, tx: PrismaLike = prisma) {
    return tx.lichSuChucVu.count({ where });
  },

  create(data: Prisma.LichSuChucVuUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.lichSuChucVu.create({ data });
  },

  createRaw<T extends Prisma.LichSuChucVuCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.LichSuChucVuCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.lichSuChucVu.create(args);
  },

  createMany(data: Prisma.LichSuChucVuCreateManyInput[], tx: PrismaLike = prisma) {
    return tx.lichSuChucVu.createMany({ data });
  },

  update(id: string, data: Prisma.LichSuChucVuUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.lichSuChucVu.update({ where: { id }, data });
  },

  updateRaw<T extends Prisma.LichSuChucVuUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.LichSuChucVuUpdateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.lichSuChucVu.update(args);
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.lichSuChucVu.delete({ where: { id } });
  },
};
