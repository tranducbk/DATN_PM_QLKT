import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const annualProfileRepository = {
  findByPersonnelId(quanNhanId: string, tx: PrismaLike = prisma) {
    return tx.hoSoHangNam.findUnique({ where: { quan_nhan_id: quanNhanId } });
  },

  findManyRaw<T extends Prisma.HoSoHangNamFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoHangNamFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoHangNam.findMany(args);
  },

  findUniqueRaw<T extends Prisma.HoSoHangNamFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoHangNamFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoHangNam.findUnique(args);
  },

  createRaw<T extends Prisma.HoSoHangNamCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoHangNamCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoHangNam.create(args);
  },

  upsert(
    quanNhanId: string,
    data: Prisma.HoSoHangNamUncheckedCreateInput,
    update: Prisma.HoSoHangNamUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoHangNam.upsert({
      where: { quan_nhan_id: quanNhanId },
      update,
      create: data,
    });
  },
};
