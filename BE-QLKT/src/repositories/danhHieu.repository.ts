import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

type PrismaLike = typeof prisma | Prisma.TransactionClient;

const personalWithUnitInclude = {
  QuanNhan: {
    include: {
      CoQuanDonVi: true,
      DonViTrucThuoc: { include: { CoQuanDonVi: true } },
    },
  },
} as const;

const unitInclude = {
  CoQuanDonVi: true,
  DonViTrucThuoc: { include: { CoQuanDonVi: true } },
} as const;

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

  findByIdWithPersonnel(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findUnique({
      where: { id },
      include: personalWithUnitInclude,
    });
  },

  findByPersonnelId(quanNhanId: string, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findMany({
      where: { quan_nhan_id: quanNhanId },
      orderBy: { nam: 'desc' },
    });
  },

  findByPersonnelAndYear(quanNhanId: string, nam: number, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findFirst({
      where: { quan_nhan_id: quanNhanId, nam },
    });
  },

  findManyByPersonnelIds(
    quanNhanIds: string[],
    options: { nam?: number } = {},
    tx: PrismaLike = prisma
  ) {
    const where: Prisma.DanhHieuHangNamWhereInput = {
      quan_nhan_id: { in: quanNhanIds },
    };
    if (options.nam !== undefined) where.nam = options.nam;
    return tx.danhHieuHangNam.findMany({
      where,
      orderBy: { nam: 'desc' },
    });
  },

  findRecentCreatedByPersonnelIds(
    quanNhanIds: string[],
    sinceDate: Date,
    tx: PrismaLike = prisma
  ) {
    return tx.danhHieuHangNam.findMany({
      where: {
        quan_nhan_id: { in: quanNhanIds },
        createdAt: { gte: sinceDate },
      },
      select: { createdAt: true },
    });
  },

  findMany(args: Prisma.DanhHieuHangNamFindManyArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findMany(args);
  },

  findManyWithPersonnel(
    args: { where?: Prisma.DanhHieuHangNamWhereInput; orderBy?: Prisma.DanhHieuHangNamOrderByWithRelationInput | Prisma.DanhHieuHangNamOrderByWithRelationInput[]; skip?: number; take?: number },
    tx: PrismaLike = prisma
  ) {
    return tx.danhHieuHangNam.findMany({
      where: args.where,
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take,
      include: personalWithUnitInclude,
    });
  },

  count(args: Prisma.DanhHieuHangNamCountArgs = {}, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.count(args);
  },

  findFirst(args: Prisma.DanhHieuHangNamFindFirstArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findFirst(args);
  },

  findAll(tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.findMany();
  },

  create(data: Prisma.DanhHieuHangNamUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.create({ data });
  },

  update(id: string, data: Prisma.DanhHieuHangNamUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuHangNam.update({ where: { id }, data });
  },

  upsertByPersonnelYear(
    quanNhanId: string,
    nam: number,
    create: Prisma.DanhHieuHangNamUncheckedCreateInput,
    update: Prisma.DanhHieuHangNamUncheckedUpdateInput,
    tx: PrismaLike = prisma
  ) {
    return tx.danhHieuHangNam.upsert({
      where: { quan_nhan_id_nam: { quan_nhan_id: quanNhanId, nam } },
      create,
      update,
    });
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

  findByIdWithUnit(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findUnique({
      where: { id },
      include: unitInclude,
    });
  },

  findFirst(args: Prisma.DanhHieuDonViHangNamFindFirstArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findFirst(args);
  },

  findMany(args: Prisma.DanhHieuDonViHangNamFindManyArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findMany(args);
  },

  findManyWithUnit(
    args: {
      where?: Prisma.DanhHieuDonViHangNamWhereInput;
      orderBy?: Prisma.DanhHieuDonViHangNamOrderByWithRelationInput | Prisma.DanhHieuDonViHangNamOrderByWithRelationInput[];
      skip?: number;
      take?: number;
    },
    tx: PrismaLike = prisma
  ) {
    return tx.danhHieuDonViHangNam.findMany({
      where: args.where,
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take,
      include: unitInclude,
    });
  },

  count(args: Prisma.DanhHieuDonViHangNamCountArgs = {}, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.count(args);
  },

  findAll(tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.findMany();
  },

  create(data: Prisma.DanhHieuDonViHangNamUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.create({ data });
  },

  createWithUnit(data: Prisma.DanhHieuDonViHangNamUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.create({ data, include: unitInclude });
  },

  update(id: string, data: Prisma.DanhHieuDonViHangNamUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.update({ where: { id }, data });
  },

  updateWithUnit(id: string, data: Prisma.DanhHieuDonViHangNamUncheckedUpdateInput, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.update({
      where: { id },
      data,
      include: unitInclude,
    });
  },

  upsert(args: Prisma.DanhHieuDonViHangNamUpsertArgs, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.upsert(args);
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.danhHieuDonViHangNam.delete({ where: { id } });
  },
};
