#!/usr/bin/env node

/**
 * Removes 0-day closed position-history periods (ngay_ket_thuc = ngay_bat_dau) — churn left over
 * from same-day position re-edits before rotatePositionHistory learned to collapse them.
 * Open periods (ngay_ket_thuc IS NULL) and real periods are untouched.
 * Run: npx tsx src/scripts/cleanupZeroDayPositionHistory.ts
 */

import 'dotenv/config';
import { prisma } from '../models';

async function main(): Promise<void> {
  const deleted = await prisma.$executeRawUnsafe(
    'DELETE FROM "LichSuChucVu" WHERE ngay_ket_thuc IS NOT NULL AND ngay_ket_thuc = ngay_bat_dau'
  );
  console.log(`Đã xoá ${deleted} bản ghi lịch sử chức vụ 0 ngày.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async err => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
