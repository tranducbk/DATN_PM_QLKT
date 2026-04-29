import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

const personnelInclude = {
  CoQuanDonVi: true,
  DonViTrucThuoc: { include: { CoQuanDonVi: true } },
  ChucVu: true,
} as const;

const personnelDetailInclude = {
  CoQuanDonVi: true,
  DonViTrucThuoc: { include: { CoQuanDonVi: true } },
  ChucVu: true,
  TaiKhoan: {
    select: {
      id: true,
      username: true,
      role: true,
    },
  },
} as const;

export const quanNhanRepository = {
  /** Returns personnel with unit + position info (no account). */
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { id },
      include: personnelInclude,
    });
  },

  findIdById(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { id },
      select: { id: true },
    });
  },

  /** Returns personnel with unit + position + minimal account (id, username, role). */
  findByIdForDetail(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { id },
      include: personnelDetailInclude,
    });
  },

  /** Returns personnel with full TaiKhoan record — used for cascade delete. */
  findByIdWithAccount(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { id },
      include: { TaiKhoan: true },
    });
  },

  /** Returns personnel with TaiKhoan role only — used for permission checks. */
  findByIdWithAccountRole(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { id },
      include: { TaiKhoan: { select: { role: true } } },
    });
  },

  /** Returns only the unit foreign keys — used for manager scope checks. */
  findUnitScope(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { id },
      select: { co_quan_don_vi_id: true, don_vi_truc_thuoc_id: true },
    });
  },

  /** Returns id when a record with the given CCCD exists — used for uniqueness checks. */
  findIdByCccd(cccd: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.findUnique({
      where: { cccd },
      select: { id: true },
    });
  },

  findMany(args: {
    where: Prisma.QuanNhanWhereInput;
    skip: number;
    take: number;
  }, tx: PrismaLike = prisma) {
    return tx.quanNhan.findMany({
      where: args.where,
      skip: args.skip,
      take: args.take,
      include: personnelInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  count(where: Prisma.QuanNhanWhereInput, tx: PrismaLike = prisma) {
    return tx.quanNhan.count({ where });
  },

  /** Returns all personnel ordered for Excel export. */
  findAllForExport(tx: PrismaLike = prisma) {
    return tx.quanNhan.findMany({
      include: personnelInclude,
      orderBy: [
        { co_quan_don_vi_id: 'asc' },
        { don_vi_truc_thuoc_id: 'asc' },
        { ho_ten: 'asc' },
      ],
    });
  },

  findManyByIds(ids: string[], tx: PrismaLike = prisma) {
    return tx.quanNhan.findMany({ where: { id: { in: ids } } });
  },

  findUniqueRaw<T extends Prisma.QuanNhanFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.QuanNhanFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.quanNhan.findUnique(args);
  },

  findManyRaw<T extends Prisma.QuanNhanFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.QuanNhanFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.quanNhan.findMany(args);
  },

  groupByCapBac(where: Prisma.QuanNhanWhereInput, tx: PrismaLike = prisma) {
    return tx.quanNhan.groupBy({ by: ['cap_bac'], where, _count: { id: true } });
  },

  groupByCoQuanDonViForRecalc(tx: PrismaLike = prisma) {
    return tx.quanNhan.groupBy({
      by: ['co_quan_don_vi_id'],
      where: { co_quan_don_vi_id: { not: null }, don_vi_truc_thuoc_id: null },
      _count: true,
    });
  },

  groupByDonViTrucThuocForRecalc(tx: PrismaLike = prisma) {
    return tx.quanNhan.groupBy({
      by: ['don_vi_truc_thuoc_id'],
      where: { don_vi_truc_thuoc_id: { not: null } },
      _count: true,
    });
  },

  create(data: Prisma.QuanNhanUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.quanNhan.create({
      data,
      include: personnelInclude,
    });
  },

  update(id: string, data: Prisma.QuanNhanUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.quanNhan.update({
      where: { id },
      data,
      include: personnelInclude,
    });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.quanNhan.delete({ where: { id } });
  },
};
