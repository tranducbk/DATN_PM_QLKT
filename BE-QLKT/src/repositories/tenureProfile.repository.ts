import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const tenureProfileRepository = {
  findByPersonnelId(quanNhanId: string, tx: PrismaLike = prisma) {
    return tx.hoSoNienHan.findUnique({ where: { quan_nhan_id: quanNhanId } });
  },

  findManyRaw<T extends Prisma.HoSoNienHanFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoNienHanFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoNienHan.findMany(args);
  },

  findUniqueRaw<T extends Prisma.HoSoNienHanFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoNienHanFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoNienHan.findUnique(args);
  },

  createRaw<T extends Prisma.HoSoNienHanCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoNienHanCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoNienHan.create(args);
  },

  updateRaw<T extends Prisma.HoSoNienHanUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoNienHanUpdateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoNienHan.update(args);
  },

  upsert(
    quanNhanId: string,
    data: Prisma.HoSoNienHanUncheckedCreateInput,
    update: Prisma.HoSoNienHanUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoNienHan.upsert({
      where: { quan_nhan_id: quanNhanId },
      update,
      create: data,
    });
  },
};
