import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const systemLogRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.systemLog.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.SystemLogFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemLogFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.systemLog.findMany(args);
  },

  findUniqueRaw<T extends Prisma.SystemLogFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemLogFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.systemLog.findUnique(args);
  },

  groupByActionTop(limit: number, tx: PrismaLike = prisma) {
    return tx.systemLog.groupBy({
      by: ['action'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
  },

  count(where: Prisma.SystemLogWhereInput, tx: PrismaLike = prisma) {
    return tx.systemLog.count({ where });
  },

  create(data: Prisma.SystemLogUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.systemLog.create({ data });
  },

  createMany(data: Prisma.SystemLogCreateManyInput[], tx: PrismaLike = prisma) {
    return tx.systemLog.createMany({ data });
  },

  deleteMany(where: Prisma.SystemLogWhereInput, tx: PrismaLike = prisma) {
    return tx.systemLog.deleteMany({ where });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.systemLog.delete({ where: { id } });
  },
};
