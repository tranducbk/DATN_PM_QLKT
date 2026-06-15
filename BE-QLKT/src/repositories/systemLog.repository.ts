import type { Prisma } from '../generated/prisma';
import { prisma } from '../models';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SYSTEM LOG REPOSITORY — lớp truy cập DB cho bảng system_logs
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Repo mỏng, chỉ wrap Prisma client cho model SystemLog (create/findMany/
 *  count/delete...). KHÔNG chứa business logic — việc lọc theo role, build
 *  where, phân trang nằm ở systemLogs.service.ts.
 *
 *  Mọi method nhận tham số `tx` (mặc định = prisma) để có thể chạy trong
 *  transaction: truyền `Prisma.TransactionClient` khi cần ghi log cùng một
 *  transaction với thao tác nghiệp vụ (atomic — log và data cùng commit/rollback).
 * ════════════════════════════════════════════════════════════════════════════
 */

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const systemLogRepository = {
  findById(id: string, tx: PrismaLike = prisma) {
    return tx.systemLog.findUnique({ where: { id } });
  },

  findManyRaw<T extends Prisma.SystemLogFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemLogFindManyArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.systemLog.findMany(args);
  },

  findUniqueRaw<T extends Prisma.SystemLogFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.SystemLogFindUniqueArgs>,
    tx: PrismaLike = prisma
  ) {
    return tx.systemLog.findUnique(args);
  },

  groupByActionTop(limit: number, tx: PrismaLike = prisma) {
    return tx.systemLog.groupBy({
      by: ['action'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
  },

  count(where: Prisma.SystemLogWhereInput, tx: PrismaLike = prisma) {
    return tx.systemLog.count({ where });
  },

  create(data: Prisma.SystemLogUncheckedCreateInput, tx: PrismaLike = prisma) {
    return tx.systemLog.create({ data });
  },

  createMany(data: Prisma.SystemLogCreateManyInput[], tx: PrismaLike = prisma) {
    return tx.systemLog.createMany({ data });
  },

  deleteMany(where: Prisma.SystemLogWhereInput, tx: PrismaLike = prisma) {
    return tx.systemLog.deleteMany({ where });
  },

  delete(id: string, tx: PrismaLike = prisma) {
    return tx.systemLog.delete({ where: { id } });
  },
};
