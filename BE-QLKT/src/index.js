const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
require('dotenv').config();
const { PORT } = require('./configs');
const { prisma } = require('./models');
const profileService = require('./services/profile.service');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const app = express();

// Cấu hình CORS
const allowedOrigins = [
  'https://qlhv.vercel.app',
  'https://fe-student-manager.vercel.app',
  'https://fe-qlhv-ahnzq9nap-tran-ducs-projects-6b0bdbb3.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

const corsOptions = {
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
  allowedHeaders: ['Content-Type', 'Authorization', 'token', 'x-access-token', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  preflightContinue: false,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Trust proxy for production deployment (Render.com, Heroku, etc.)
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// Cron job: Tự động cập nhật hồ sơ hàng tháng
// Chạy vào ngày 1 hàng tháng lúc 01:00 sáng
cron.schedule('0 1 1 * *', async () => {
  console.log('\n📅 [CRON JOB] Bắt đầu cập nhật hồ sơ định kỳ hàng tháng...');
  console.log(`📅 Thời gian: ${new Date().toLocaleString('vi-VN')}`);

  try {
    const result = await profileService.recalculateAll();
    console.log(`✅ [CRON JOB] Hoàn thành cập nhật hồ sơ định kỳ`);
    console.log(`   - Thành công: ${result.success} quân nhân`);
    console.log(`   - Thất bại: ${result.errors.length} quân nhân`);

    if (result.errors.length > 0) {
      console.log('⚠️  [CRON JOB] Danh sách lỗi:');
      result.errors.forEach(err => {
        console.log(`   - ID ${err.personnelId}: ${err.error}`);
      });
    }
  } catch (error) {
    console.error('❌ [CRON JOB] Lỗi khi cập nhật hồ sơ định kỳ:', error.message);
  }

  console.log('📅 [CRON JOB] Kết thúc\n');
});

console.log('⏰ Cron job đã được kích hoạt: Cập nhật hồ sơ vào 01:00 ngày 1 hàng tháng');

app.use(require('./routes/index'));

// Global Error Handling (phải đặt SAU tất cả routes)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
  console.log(`🔍 Prisma Studio: npx prisma studio`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Đang đóng server...');
  await prisma.$disconnect();
  process.exit(0);
});
