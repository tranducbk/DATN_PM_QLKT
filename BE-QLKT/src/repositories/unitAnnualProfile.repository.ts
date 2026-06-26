import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const unitAnnualProfileRepository = {
  findFirstRaw<T extends Prisma.HoSoDonViHangNamFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoDonViHangNamFindFirstArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoDonViHangNam.findFirst(args);
  },

  findManyRaw<T extends Prisma.HoSoDonViHangNamFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoDonViHangNamFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoDonViHangNam.findMany(args);
  },

  findUniqueRaw<T extends Prisma.HoSoDonViHangNamFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoDonViHangNamFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoDonViHangNam.findUnique(args);
  },

  createRaw<T extends Prisma.HoSoDonViHangNamCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoDonViHangNamCreateArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoDonViHangNam.create(args);
  },

  upsertRaw<T extends Prisma.HoSoDonViHangNamUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.HoSoDonViHangNamUpsertArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.hoSoDonViHangNam.upsert(args);
  },
};
