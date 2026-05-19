import { prisma } from '../models';

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "BangDeXuat" ADD COLUMN IF NOT EXISTS files_attached_admin JSON`
  );
  console.log('✓ BangDeXuat.files_attached_admin added');

  console.log('\nDone. Run `npx prisma db push` to sync schema (no destructive change).');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
