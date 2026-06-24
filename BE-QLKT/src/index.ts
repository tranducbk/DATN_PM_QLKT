import { createServer } from 'http';
import 'dotenv/config';
import { PORT, warnInsecureCookieConfig } from './configs';
import { prisma } from './models';
import { initSocket } from './utils/socketService';
import { initScheduledJobs } from './services/recalcCron.service';
import { app } from './app';

const httpServer = createServer(app);

// Test Prisma connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Kết nối database thành công');
  } catch (error) {
    console.error('❌ Không thể kết nối database:', error);
    process.exit(1);
  }
}

testDatabaseConnection();

// Recalculation + auto-backup cron tasks (schedules read from system_settings)
initScheduledJobs().catch(err => console.error('[Scheduler] init failed:', err));

initSocket(httpServer);

warnInsecureCookieConfig();

httpServer.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
  console.log(`🔌 Socket.IO đã khởi động`);
  console.log(`🔍 Prisma Studio: npx prisma studio`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Đang đóng server...');
  await prisma.$disconnect();
  process.exit(0);
});
