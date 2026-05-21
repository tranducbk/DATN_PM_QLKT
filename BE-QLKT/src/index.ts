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
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import { PORT } from './configs';
import { allowCorsOrigin } from './configs/cors';
import { prisma } from './models';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { initSocket } from './utils/socketService';
import routes from './routes/index';

const app = express();
const httpServer = createServer(app);

// CORS: shares ALLOWED_ORIGINS with Socket.IO (configs/cors.ts)
const corsOptions: cors.CorsOptions = {
  origin: allowCorsOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'token',
    'x-access-token',
    'Cookie',
    'x-dev-password',
  ],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  maxAge: 86400,
};

app.use(cors(corsOptions));

// Trust proxy for production deployment (Render.com, Heroku, etc.)
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(express.json({ limit: '10mb' }));

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

// Cron schedule managed by devZone.route.ts (reads from system_settings table)

app.use(routes);

// Global error handler — must be registered after all routes
app.use(notFoundHandler);
app.use(errorHandler);

initSocket(httpServer);

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
