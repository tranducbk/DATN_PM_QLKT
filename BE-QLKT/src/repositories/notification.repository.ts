import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const notificationRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.thongBao.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.ThongBaoFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ThongBaoFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.thongBao.findMany(args);
  },

  findUniqueRaw<T extends Prisma.ThongBaoFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ThongBaoFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.thongBao.findUnique(args);
  },

  count(where: Prisma.ThongBaoWhereInput, tx: PrismaLike = prisma) {
    return tx.thongBao.count({ where });
  },

  create(data: Prisma.ThongBaoUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.thongBao.create({ data });
  },

  createMany(data: Prisma.ThongBaoCreateManyInput[], tx: PrismaLike = prisma) {
    return tx.thongBao.createMany({ data });
  },

  update(id: string, data: Prisma.ThongBaoUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.thongBao.update({ where: { id }, data });
  },

  updateMany(
    where: Prisma.ThongBaoWhereInput,
    data: Prisma.ThongBaoUncheckedUpdateManyInput,
    tx: PrismaLike = prisma
  ) {
    return tx.thongBao.updateMany({ where, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.thongBao.delete({ where: { id } });
  },

  deleteMany(where: Prisma.ThongBaoWhereInput, tx: PrismaLike = prisma) {
    return tx.thongBao.deleteMany({ where });
  },
};
