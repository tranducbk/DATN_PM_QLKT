/**
 * Set bcrypt password for 4 demo accounts after running 01-seed-data.sql.
 * Usage:
 *   cd BE-QLKT
 *   npx tsx scripts/demo/02-set-passwords.ts
 *
 * Default password: Hvkhqs@123
 * Override via: DEMO_PASSWORD=mypassword npx tsx scripts/demo/02-set-passwords.ts
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

const DEMO_USERNAMES = [
  'superadmin_demo',
  'admin_demo',
  'manager_demo',
  'user_demo',
];

async function main() {
  const password = process.env.DEMO_PASSWORD || 'Hvkhqs@123';
  const rounds = 10;

  console.log(`Hashing password "${password}" with bcrypt cost ${rounds}...`);
  const hash = await bcrypt.hash(password, rounds);

  console.log(`Updating ${DEMO_USERNAMES.length} demo accounts...`);
  const result = await prisma.taiKhoan.updateMany({
    where: { username: { in: DEMO_USERNAMES } },
    data: { password_hash: hash },
  });

  console.log(`✓ Updated ${result.count} accounts.`);
  console.log(`\nDemo accounts ready (password: ${password}):`);
  DEMO_USERNAMES.forEach((u) => console.log(`  • ${u}`));
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
