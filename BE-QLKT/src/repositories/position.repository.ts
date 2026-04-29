import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const positionRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.chucVu.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.ChucVuFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChucVuFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.chucVu.findMany(args);
  },

  findFirstRaw<T extends Prisma.ChucVuFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChucVuFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.chucVu.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.ChucVuFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChucVuFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.chucVu.findUnique(args);
  },

  count(where: Prisma.ChucVuWhereInput, tx: PrismaLike = prisma) {
    return tx.chucVu.count({ where });
  },

  create(data: Prisma.ChucVuUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.chucVu.create({ data });
  },

  createRaw<T extends Prisma.ChucVuCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChucVuCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.chucVu.create(args);
  },

  update(id: string, data: Prisma.ChucVuUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.chucVu.update({ where: { id }, data });
  },

  updateRaw<T extends Prisma.ChucVuUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ChucVuUpdateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.chucVu.update(args);
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.chucVu.delete({ where: { id } });
  },
};
