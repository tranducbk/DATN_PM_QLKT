import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

const cqdvHierarchyInclude = {
  DonViTrucThuoc: { include: { ChucVu: true } },
  ChucVu: true,
} as const;

const cqdvWithChildrenInclude = {
  DonViTrucThuoc: true,
} as const;

const cqdvDeepInclude = {
  DonViTrucThuoc: {
    include: {
      ChucVu: {
        include: {
          CoQuanDonVi: true,
          DonViTrucThuoc: { include: { CoQuanDonVi: true } },
        },
      },
    },
  },
  ChucVu: {
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
    },
  },
} as const;

const dvttDeepInclude = {
  CoQuanDonVi: {
    select: {
      id: true,
      ma_don_vi: true,
      ten_don_vi: true,
      so_luong: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  ChucVu: {
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
    },
  },
} as const;

const dvttWithParentLightInclude = {
  CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
} as const;

const dvttWithParentFullInclude = {
  CoQuanDonVi: true,
  ChucVu: true,
} as const;

const dvttWithBothInclude = {
  CoQuanDonVi: { select: { id: true, ten_don_vi: true, ma_don_vi: true } },
  ChucVu: true,
} as const;

export const coQuanDonViRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({ where: { id } });
  },

  /** Returns id only — used for existence checks. */
  findIdById(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({ where: { id }, select: { id: true } });
  },

  /** Returns id, ten_don_vi, ma_don_vi — used for manager scope display. */
  findLightById(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({
      where: { id },
      select: { id: true, ten_don_vi: true, ma_don_vi: true },
    });
  },

  /** Returns id + ten_don_vi — used for transfer notifications. */
  findNameById(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({
      where: { id },
      select: { id: true, ten_don_vi: true },
    });
  },

  /** Returns parent unit with its children — used for delete preflight checks. */
  findWithChildren(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({
      where: { id },
      include: cqdvWithChildrenInclude,
    });
  },

  /** Returns full hierarchy with nested ChucVu — used for unit detail page. */
  findDeepById(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({
      where: { id },
      include: cqdvDeepInclude,
    });
  },

  findByMaDonVi(maDonVi: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findUnique({ where: { ma_don_vi: maDonVi } });
  },

  findFirstByMaDonVi(maDonVi: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findFirst({ where: { ma_don_vi: maDonVi } });
  },

  findOtherByMaDonVi(maDonVi: string, excludeId: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findFirst({
      where: { ma_don_vi: maDonVi, id: { not: excludeId } },
    });
  },

  findManyHierarchyPaginated(
    args: { skip: number; take: number },
    tx: PrismaLike = prisma
  ) {
    return tx.coQuanDonVi.findMany({
      include: cqdvHierarchyInclude,
      orderBy: { ma_don_vi: 'asc' },
      skip: args.skip,
      take: args.take,
    });
  },

  findAllLight(tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findMany({
      select: { id: true, ten_don_vi: true, ma_don_vi: true },
      orderBy: { ma_don_vi: 'asc' },
    });
  },

  findAllForRecalc(tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.findMany({ select: { id: true, so_luong: true } });
  },

  findManyRaw<T extends Prisma.CoQuanDonViFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CoQuanDonViFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.coQuanDonVi.findMany(args);
  },

  findUniqueRaw<T extends Prisma.CoQuanDonViFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.CoQuanDonViFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.coQuanDonVi.findUnique(args);
  },

  count(tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.count();
  },

  create(data: Prisma.CoQuanDonViUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.create({ data, include: cqdvHierarchyInclude });
  },

  update(id: string, data: Prisma.CoQuanDonViUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.update({
      where: { id },
      data,
      include: cqdvHierarchyInclude,
    });
  },

  updateSoLuong(id: string, value: number, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.update({ where: { id }, data: { so_luong: value } });
  },

  incrementSoLuong(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.update({
      where: { id },
      data: { so_luong: { increment: 1 } },
    });
  },

  decrementSoLuong(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.update({
      where: { id },
      data: { so_luong: { decrement: 1 } },
    });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.coQuanDonVi.delete({ where: { id } });
  },
};

export const donViTrucThuocRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({ where: { id } });
  },

  findIdById(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({ where: { id }, select: { id: true } });
  },

  findNameById(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({
      where: { id },
      select: { id: true, ten_don_vi: true },
    });
  },

  /** Returns parent FK only — used to resolve unit hierarchy. */
  findCoQuanDonViIdById(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({
      where: { id },
      select: { co_quan_don_vi_id: true },
    });
  },

  /** Returns id + parent FK — used to resolve unit assignment during transfers. */
  findIdAndParentById(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({
      where: { id },
      select: { id: true, co_quan_don_vi_id: true },
    });
  },

  findDeepById(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({
      where: { id },
      include: dvttDeepInclude,
    });
  },

  findByMaDonVi(maDonVi: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findUnique({ where: { ma_don_vi: maDonVi } });
  },

  findFirstByMaDonVi(maDonVi: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findFirst({ where: { ma_don_vi: maDonVi } });
  },

  findOtherByMaDonVi(maDonVi: string, excludeId: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findFirst({
      where: { ma_don_vi: maDonVi, id: { not: excludeId } },
    });
  },

  findIdsByCoQuanDonViId(coQuanDonViId: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findMany({
      where: { co_quan_don_vi_id: coQuanDonViId },
      select: { id: true },
    });
  },

  /** Children of one parent with parent-light projection — used for manager scope view. */
  findManyByParent(coQuanDonViId: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findMany({
      where: { co_quan_don_vi_id: coQuanDonViId },
      include: dvttWithParentLightInclude,
      orderBy: { ma_don_vi: 'asc' },
    });
  },

  /** All sub-units (or under a parent if id given) with full parent + ChucVu — used for sub-units listing. */
  findManySubUnits(coQuanDonViId: string | undefined, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findMany({
      where: coQuanDonViId ? { co_quan_don_vi_id: coQuanDonViId } : {},
      include: dvttWithParentFullInclude,
      orderBy: { ma_don_vi: 'asc' },
    });
  },

  /** Flat list with parent-light + ChucVu — used for unit picker. */
  findAllWithParentLight(tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findMany({
      include: dvttWithBothInclude,
      orderBy: { ma_don_vi: 'asc' },
    });
  },

  findAllForRecalc(tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.findMany({ select: { id: true, so_luong: true } });
  },

  count(tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.count();
  },

  findManyRaw<T extends Prisma.DonViTrucThuocFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.DonViTrucThuocFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.donViTrucThuoc.findMany(args);
  },

  findUniqueRaw<T extends Prisma.DonViTrucThuocFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.DonViTrucThuocFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.donViTrucThuoc.findUnique(args);
  },

  create(data: Prisma.DonViTrucThuocUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.create({
      data,
      include: dvttWithParentFullInclude,
    });
  },

  update(id: string, data: Prisma.DonViTrucThuocUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.update({
      where: { id },
      data,
      include: dvttWithParentFullInclude,
    });
  },

  updateSoLuong(id: string, value: number, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.update({ where: { id }, data: { so_luong: value } });
  },

  incrementSoLuong(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.update({
      where: { id },
      data: { so_luong: { increment: 1 } },
    });
  },

  decrementSoLuong(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.update({
      where: { id },
      data: { so_luong: { decrement: 1 } },
    });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.donViTrucThuoc.delete({ where: { id } });
  },
};
