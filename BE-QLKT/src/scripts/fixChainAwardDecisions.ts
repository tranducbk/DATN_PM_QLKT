/**
 * Fix data: migrate so_quyet_dinh to correct field for chain awards (BKBQP/CSTDTQ/BKTTCP).
 * Run: npx tsx src/scripts/fixChainAwardDecisions.ts
 */
import { prisma } from '../models';
import profileService from '../services/profile.service';

async function main() {
  console.log('=== Fix chain award decisions ===\n');

  // 1. Fix DanhHieuHangNam: so_quyet_dinh in wrong field
  const wrongRecords = await prisma.danhHieuHangNam.findMany({
    where: {
      danh_hieu: null,
      OR: [
        { nhan_bkbqp: true, so_quyet_dinh: { not: null } },
        { nhan_cstdtq: true, so_quyet_dinh: { not: null } },
        { nhan_bkttcp: true, so_quyet_dinh: { not: null } },
      ],
    },
  });

  console.log(`Found ${wrongRecords.length} records with so_quyet_dinh in wrong field\n`);

  for (const record of wrongRecords) {
    const updates: Record<string, any> = { so_quyet_dinh: null };

    if (record.nhan_bkbqp && !record.so_quyet_dinh_bkbqp) {
      updates.so_quyet_dinh_bkbqp = record.so_quyet_dinh;
    }
    if (record.nhan_cstdtq && !record.so_quyet_dinh_cstdtq) {
      updates.so_quyet_dinh_cstdtq = record.so_quyet_dinh;
    }
    if (record.nhan_bkttcp && !record.so_quyet_dinh_bkttcp) {
      updates.so_quyet_dinh_bkttcp = record.so_quyet_dinh;
    }

    await prisma.danhHieuHangNam.update({
      where: { id: record.id },
      data: updates,
    });

    console.log(`  Fixed: ${record.id} (nam=${record.nam}, QD=${record.so_quyet_dinh})`);
  }

  // 2. Fix DanhHieuDonViHangNam: same issue
  const wrongUnitRecords = await prisma.danhHieuDonViHangNam.findMany({
    where: {
      danh_hieu: null,
      OR: [
        { nhan_bkbqp: true, so_quyet_dinh: { not: null } },
        { nhan_bkttcp: true, so_quyet_dinh: { not: null } },
      ],
    },
  });

  console.log(`\nFound ${wrongUnitRecords.length} unit records with so_quyet_dinh in wrong field\n`);

  for (const record of wrongUnitRecords) {
    const updates: Record<string, any> = { so_quyet_dinh: null };

    if (record.nhan_bkbqp && !record.so_quyet_dinh_bkbqp) {
      updates.so_quyet_dinh_bkbqp = record.so_quyet_dinh;
    }
    if (record.nhan_bkttcp && !record.so_quyet_dinh_bkttcp) {
      updates.so_quyet_dinh_bkttcp = record.so_quyet_dinh;
    }

    await prisma.danhHieuDonViHangNam.update({
      where: { id: record.id },
      data: updates,
    });

    console.log(`  Fixed unit: ${record.id} (nam=${record.nam}, QD=${record.so_quyet_dinh})`);
  }

  // 3. Recalculate all annual profiles
  const allPersonnel = await prisma.quanNhan.findMany({ select: { id: true, ho_ten: true } });
  console.log(`\nRecalculating ${allPersonnel.length} profiles...\n`);

  let success = 0;
  let failed = 0;
  for (const p of allPersonnel) {
    try {
      await profileService.recalculateAnnualProfile(p.id);
      success++;
    } catch (e) {
      console.error(`  Failed: ${p.ho_ten} (${p.id}):`, e);
      failed++;
    }
  }

  console.log(`\n=== Done: ${success} recalculated, ${failed} failed ===`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
