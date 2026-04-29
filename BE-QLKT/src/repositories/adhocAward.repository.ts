import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const adhocAwardRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.khenThuongDotXuat.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.KhenThuongDotXuatFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongDotXuatFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongDotXuat.findMany(args);
  },

  findFirstRaw<T extends Prisma.KhenThuongDotXuatFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongDotXuatFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongDotXuat.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.KhenThuongDotXuatFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongDotXuatFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongDotXuat.findUnique(args);
  },

  count(where: Prisma.KhenThuongDotXuatWhereInput, tx: PrismaLike = prisma) {
    return tx.khenThuongDotXuat.count({ where });
  },

  create(data: Prisma.KhenThuongDotXuatUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.khenThuongDotXuat.create({ data });
  },

  update(id: string, data: Prisma.KhenThuongDotXuatUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.khenThuongDotXuat.update({ where: { id }, data });
  },

  updateRaw<T extends Prisma.KhenThuongDotXuatUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.KhenThuongDotXuatUpdateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.khenThuongDotXuat.update(args);
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.khenThuongDotXuat.delete({ where: { id } });
  },
};
