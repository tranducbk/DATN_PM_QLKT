import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const danhHieuHangNamRepository = {
  findUnique(args: Prisma.DanhHieuHangNamFindUniqueArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findUnique(args);
  },

  updateRaw(args: Prisma.DanhHieuHangNamUpdateArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.update(args);
  },

  createRaw(args: Prisma.DanhHieuHangNamCreateArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.create(args);
  },

  upsertRaw(args: Prisma.DanhHieuHangNamUpsertArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.upsert(args);
  },

  findById(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findUnique({ where: { id } });
  },

  findByPersonnelId(quanNhanId: string, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findMany({
      where: { quan_nhan_id: quanNhanId },
      orderBy: { nam: 'desc' },
    });
  },

  findMany(args: Prisma.DanhHieuHangNamFindManyArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findMany(args);
  },

  count(args: Prisma.DanhHieuHangNamCountArgs = {}, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.count(args);
  },

  findFirst(args: Prisma.DanhHieuHangNamFindFirstArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findFirst(args);
  },

  create(data: Prisma.DanhHieuHangNamUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.create({ data });
  },

  update(id: string, data: Prisma.DanhHieuHangNamUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.update({ where: { id }, data });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.delete({ where: { id } });
  },

  deleteManyByPersonnelId(quanNhanId: string, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.deleteMany({ where: { quan_nhan_id: quanNhanId } });
  },
};

export const danhHieuDonViHangNamRepository = {
  findUnique(args: Prisma.DanhHieuDonViHangNamFindUniqueArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findUnique(args);
  },

  updateRaw(args: Prisma.DanhHieuDonViHangNamUpdateArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.update(args);
  },

  createRaw(args: Prisma.DanhHieuDonViHangNamCreateArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.create(args);
  },

  findById(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findUnique({ where: { id } });
  },

  findFirst(args: Prisma.DanhHieuDonViHangNamFindFirstArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findFirst(args);
  },

  findMany(args: Prisma.DanhHieuDonViHangNamFindManyArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findMany(args);
  },

  count(args: Prisma.DanhHieuDonViHangNamCountArgs = {}, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.count(args);
  },

  create(data: Prisma.DanhHieuDonViHangNamUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.create({ data });
  },

  update(
    id: string,
    data: Prisma.DanhHieuDonViHangNamUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.danhHieuDonViHangNam.update({ where: { id }, data });
  },

  upsert(args: Prisma.DanhHieuDonViHangNamUpsertArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.upsert(args);
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.delete({ where: { id } });
  },
};
