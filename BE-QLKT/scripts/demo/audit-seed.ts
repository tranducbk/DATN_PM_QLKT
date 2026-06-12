/**
 * Seed audit: detects where hand-seeded derived profiles drift from what the
 * real recalc functions produce.
 *
 * `02-seed-eligibility.sql` writes HoSoHangNam / HoSoCongHien / HoSoNienHan with
 * hand-typed values. Those rows are OUTPUTS that the app derives from raw awards
 * + position history. This script, for every personnel, snapshots the stored
 * values, runs the production recalc (`profileService.recalculate*`), re-reads,
 * and reports any field that differed — i.e. where the seed was inconsistent
 * with the rules.
 *
 * Side effect: recalc WRITES the corrected values, so after running, the
 * profiles match the rules. Run on a copy/demo DB if you only want to inspect.
 *
 *     npx tsx scripts/demo/audit-seed.ts
 */
import { prisma } from '../../src/models';
import profileService from '../../src/services/profile.service';

const ANNUAL_FIELDS = [
  'tong_cstdcs',
  'tong_nckh',
  'cstdcs_lien_tuc',
  'nckh_lien_tuc',
  'bkbqp_lien_tuc',
  'cstdtq_lien_tuc',
  'du_dieu_kien_bkbqp',
  'du_dieu_kien_cstdtq',
  'du_dieu_kien_bkttcp',
] as const;

const CONTRIBUTION_FIELDS = [
  'hcbvtq_total_months',
  'months_07',
  'months_08',
  'months_0910',
  'hcbvtq_hang_ba_status',
  'hcbvtq_hang_nhi_status',
  'hcbvtq_hang_nhat_status',
] as const;

const TENURE_FIELDS = [
  'hccsvv_hang_ba_status',
  'hccsvv_hang_nhi_status',
  'hccsvv_hang_nhat_status',
] as const;

type Row = Record<string, unknown> | null;

interface Diff {
  personnel: string;
  profile: string;
  field: string;
  seeded: unknown;
  computed: unknown;
}

function collectDiffs(
  personnel: string,
  profile: string,
  fields: readonly string[],
  before: Row,
  after: Row,
  diffs: Diff[]
): void {
  for (const field of fields) {
    const seeded = before?.[field] ?? null;
    const computed = after?.[field] ?? null;
    if (String(seeded) !== String(computed)) {
      diffs.push({ personnel, profile, field, seeded, computed });
    }
  }
}

async function main(): Promise<void> {
  const year = new Date().getFullYear();
  const personnel = await prisma.quanNhan.findMany({ select: { id: true, ho_ten: true } });
  console.log(`Audit ${personnel.length} quân nhân (recalc theo năm ${year})...\n`);

  const diffs: Diff[] = [];
  let recalcErrors = 0;

  for (const p of personnel) {
    const name = p.ho_ten || p.id;
    const [annualBefore, contribBefore, tenureBefore] = await Promise.all([
      prisma.hoSoHangNam.findUnique({ where: { quan_nhan_id: p.id } }),
      prisma.hoSoCongHien.findUnique({ where: { quan_nhan_id: p.id } }),
      prisma.hoSoNienHan.findUnique({ where: { quan_nhan_id: p.id } }),
    ]);

    try {
      await profileService.recalculateAnnualProfile(p.id, year);
      await profileService.recalculateContributionProfile(p.id);
      await profileService.recalculateTenureProfile(p.id);
    } catch (err) {
      recalcErrors += 1;
      console.error(`  ! recalc lỗi cho ${name}:`, err);
      continue;
    }

    const [annualAfter, contribAfter, tenureAfter] = await Promise.all([
      prisma.hoSoHangNam.findUnique({ where: { quan_nhan_id: p.id } }),
      prisma.hoSoCongHien.findUnique({ where: { quan_nhan_id: p.id } }),
      prisma.hoSoNienHan.findUnique({ where: { quan_nhan_id: p.id } }),
    ]);

    collectDiffs(name, 'HangNam', ANNUAL_FIELDS, annualBefore, annualAfter, diffs);
    collectDiffs(name, 'CongHien', CONTRIBUTION_FIELDS, contribBefore, contribAfter, diffs);
    collectDiffs(name, 'NienHan', TENURE_FIELDS, tenureBefore, tenureAfter, diffs);
  }

  if (diffs.length === 0) {
    console.log('✅ Không lệch: dữ liệu seed khớp với recalc.');
  } else {
    console.log(`⚠️  ${diffs.length} field lệch giữa seed và recalc:\n`);
    for (const d of diffs) {
      console.log(
        `  [${d.profile}] ${d.personnel} · ${d.field}: seed=${d.seeded} → recalc=${d.computed}`
      );
    }
  }
  if (recalcErrors > 0) {
    console.log(`\n${recalcErrors} quân nhân recalc lỗi (xem log trên).`);
  }
}

main()
  .catch(err => {
    console.error('Audit thất bại:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
