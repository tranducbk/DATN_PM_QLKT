/*
 * ════════════════════════════════════════════════════════════════════════════
 *  SERVER ENTRYPOINT — bootstrap Express + Socket.IO + middleware chain
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  BOOTSTRAP ORDER:
 *  1. Express app + HTTP server.
 *  2. Middleware: cors, body parser, cookie parser.
 *  3. Mount routes (api/*).
 *  4. errorHandler middleware (CUỐI cùng — bắt mọi throw).
 *  5. Init Socket.IO + attach handshake auth.
 *  6. Listen PORT.
 *
 *  ORDER QUAN TRỌNG:
 *  - cors PHẢI trước routes (handle preflight OPTIONS).
 *  - errorHandler PHẢI cuối (Express 4 bắt error qua signature 4 arg).
 *  - 404 handler trong router/index.ts mount cuối các route.
 *
 *  HEALTH CHECK /health: load balancer ping được không cần token.
 * ════════════════════════════════════════════════════════════════════════════
 */

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

// Gắn Socket.IO vào CÙNG httpServer của Express (chung 1 port) → real-time
// notification + force_logout. Phải init trước khi server.listen() bên dưới.
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
