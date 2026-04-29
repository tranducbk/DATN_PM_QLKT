import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const proposalRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.BangDeXuatFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.BangDeXuatFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.bangDeXuat.findMany(args);
  },

  findFirstRaw<T extends Prisma.BangDeXuatFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.BangDeXuatFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.bangDeXuat.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.BangDeXuatFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.BangDeXuatFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.bangDeXuat.findUnique(args);
  },

  groupByLoaiDeXuat(where: Prisma.BangDeXuatWhereInput = {}, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.groupBy({
      by: ['loai_de_xuat'],
      where,
      _count: { id: true },
    });
  },

  groupByStatus(where: Prisma.BangDeXuatWhereInput = {}, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });
  },

  count(where: Prisma.BangDeXuatWhereInput, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.count({ where });
  },

  create(data: Prisma.BangDeXuatUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.create({ data });
  },

  createRaw<T extends Prisma.BangDeXuatCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.BangDeXuatCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.bangDeXuat.create(args);
  },

  update(id: string, data: Prisma.BangDeXuatUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.update({ where: { id }, data });
  },

  updateMany(where: Prisma.BangDeXuatWhereInput, data: Prisma.BangDeXuatUncheckedUpdateManyInput, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.updateMany({ where, data });
  },

  deleteMany(where: Prisma.BangDeXuatWhereInput, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.deleteMany({ where });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.bangDeXuat.delete({ where: { id } });
  },
};
