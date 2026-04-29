import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const commemorativeMedalRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.kyNiemChuongVSNXDQDNDVN.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.KyNiemChuongVSNXDQDNDVNFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.KyNiemChuongVSNXDQDNDVNFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.kyNiemChuongVSNXDQDNDVN.findMany(args);
  },

  findFirstRaw<T extends Prisma.KyNiemChuongVSNXDQDNDVNFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.KyNiemChuongVSNXDQDNDVNFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.kyNiemChuongVSNXDQDNDVN.findFirst(args);
  },

  findUniqueRaw<T extends Prisma.KyNiemChuongVSNXDQDNDVNFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.KyNiemChuongVSNXDQDNDVNFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.kyNiemChuongVSNXDQDNDVN.findUnique(args);
  },

  groupByYear(tx: PrismaLike = prisma) {
    return tx.kyNiemChuongVSNXDQDNDVN.groupBy({
      by: ['nam'],
      _count: { id: true },
      orderBy: { nam: 'desc' },
    });
  },

  count(where: Prisma.KyNiemChuongVSNXDQDNDVNWhereInput, tx: PrismaLike = prisma) {
    return tx.kyNiemChuongVSNXDQDNDVN.count({ where });
  },

  create(data: Prisma.KyNiemChuongVSNXDQDNDVNUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.kyNiemChuongVSNXDQDNDVN.create({ data });
  },

  update(
    id: string,
    data: Prisma.KyNiemChuongVSNXDQDNDVNUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.kyNiemChuongVSNXDQDNDVN.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.kyNiemChuongVSNXDQDNDVN.delete({ where: { id } });
  },
};
