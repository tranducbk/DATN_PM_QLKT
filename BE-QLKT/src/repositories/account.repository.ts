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
