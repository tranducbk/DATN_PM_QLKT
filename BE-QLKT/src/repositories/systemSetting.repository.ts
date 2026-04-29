import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const systemSettingRepository = {
  findUniqueByKey(key: string, tx: PrismaLike = prisma) {
    return tx.systemSetting.findUnique({ where: { key } });
  },

  findManyByKeys(keys: string[], tx: PrismaLike = prisma) {
    return tx.systemSetting.findMany({ where: { key: { in: keys } } });
  },

  findManyRaw<T extends Prisma.SystemSettingFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemSettingFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.systemSetting.findMany(args);
  },

  findUniqueRaw<T extends Prisma.SystemSettingFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemSettingFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.systemSetting.findUnique(args);
  },

  upsert(key: string, value: string, tx: PrismaLike = prisma) {
    return tx.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },

  createMany(data: Prisma.SystemSettingCreateManyInput[], tx: PrismaLike = prisma) {
    return tx.systemSetting.createMany({ data });
  },
};
