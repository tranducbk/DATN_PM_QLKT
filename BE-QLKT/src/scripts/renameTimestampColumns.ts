import { prisma } from '../models';

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE system_logs RENAME COLUMN created_at TO "createdAt"`
  );
  console.log('✓ system_logs.created_at → createdAt');

  await prisma.$executeRawUnsafe(
    `ALTER TABLE notifications RENAME COLUMN created_at TO "createdAt"`
  );
  console.log('✓ notifications.created_at → createdAt');

  await prisma.$executeRawUnsafe(
    `ALTER TABLE notifications RENAME COLUMN read_at TO "readAt"`
  );
  console.log('✓ notifications.read_at → readAt');

  console.log('\nDone. Run `npx prisma db push` to sync schema.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
