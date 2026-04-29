import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const contributionProfileRepository = {
  findByPersonnelId(quanNhanId: string, tx: PrismaLike = prisma) {
    return tx.hoSoCongHien.findUnique({ where: { quan_nhan_id: quanNhanId } });
  },

  findManyRaw<T extends Prisma.HoSoCongHienFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoCongHienFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoCongHien.findMany(args);
  },

  findUniqueRaw<T extends Prisma.HoSoCongHienFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoCongHienFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoCongHien.findUnique(args);
  },

  createRaw<T extends Prisma.HoSoCongHienCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoCongHienCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoCongHien.create(args);
  },

  upsert(
    quanNhanId: string,
    data: Prisma.HoSoCongHienUncheckedCreateInput,
    update: Prisma.HoSoCongHienUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoCongHien.upsert({
      where: { quan_nhan_id: quanNhanId },
      update,
      create: data,
    });
  },
};
