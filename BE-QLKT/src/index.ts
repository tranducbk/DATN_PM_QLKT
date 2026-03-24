import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { PORT } from './configs';
import { prisma } from './models';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { initSocket } from './utils/socketService';
import routes from './routes/index';

const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Thiếu biến môi trường bắt buộc: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

// Cấu hình CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
app.options('*', cors(corsOptions));

// Trust proxy for production deployment (Render.com, Heroku, etc.)
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

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

// Cron job được quản lý bởi devZone.route.ts (đọc lịch từ DB bảng system_settings)

app.use(routes);

// Global Error Handling (phải đặt SAU tất cả routes)
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
