/*
 * ════════════════════════════════════════════════════════════════════════════
 *  PRISMA CLIENT SINGLETON — 1 instance dùng chung toàn app
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  WHY SINGLETON:
 *  - PrismaClient mỗi instance giữ connection pool (10 connection default).
 *  - Tạo nhiều instance → mỗi instance pool riêng → exhaust DB connection
 *    limit nhanh chóng (Postgres default 100 connection).
 *  - Hot reload trong dev: nếu mỗi reload tạo instance mới → leak.
 *  - Pattern singleton: import { prisma } from '../models' ở mọi nơi.
 *
 *  LOGGING:
 *  - Dev mode: log 'query' để debug SQL Prisma generate.
 *  - Prod: chỉ 'error' để tránh log spam.
 *  - Performance: query log có overhead → KHÔNG bật ở prod.
 *
 *  IMPORT FROM '../generated/prisma':
 *  Schema generate type vào folder local (KHÔNG node_modules) — output
 *  config trong schema.prisma. Lý do: dễ inspect generated types khi debug.
 *
 *  GRACEFUL DISCONNECT:
 *  Khi server shutdown → prisma.$disconnect() để close connection pool
 *  clean (xem index.ts SIGTERM handler).
 * ════════════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export { prisma };
