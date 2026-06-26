import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest', // chạy test viết bằng TypeScript trực tiếp, khỏi build sang JS trước
  testEnvironment: 'node', // BE thuần Node → không cần jsdom giả lập DOM trình duyệt
  roots: ['<rootDir>/tests'], // chỉ quét test trong thư mục tests/
  testMatch: ['**/*.test.ts'], // nhận diện file test theo đuôi .test.ts
  // Integration tests cần DB thật (không mock Prisma) và chạy riêng qua
  // `npm run test:integration` (jest.integration.config.ts). Loại khỏi suite
  // mặc định để `npm test` vẫn là unit-only, không phụ thuộc DB đã seed.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/integration/'],
  moduleFileExtensions: ['ts', 'js', 'json'], // thứ tự ưu tiên khi resolve import thiếu đuôi
  setupFiles: ['<rootDir>/tests/env.setup.ts'], // chạy TRƯỚC khung test → nạp biến môi trường test
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // chạy SAU khi jest sẵn sàng → mock Prisma, helper chung
  clearMocks: true, // tự reset mock sau mỗi test → tránh state test này rò sang test khác
  // Đo coverage trên toàn bộ src, trừ các file không chứa logic cần test:
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts', // file khai báo type, không có code chạy
    '!src/generated/**', // code Prisma sinh tự động
    '!src/index.ts', // entry point khởi động server
    '!src/scripts/**', // script chạy tay (seed, migrate)
    '!src/configs/**', // file cấu hình
    '!src/types/**', // định nghĩa type
  ],
  coverageReporters: ['text-summary', 'lcov'], // tóm tắt ra console + file lcov cho công cụ CI
  // Ngưỡng coverage đặt sát ngay dưới số thực tế hiện tại để CI pass hôm nay;
  // nâng dần khi coverage tăng (ratchet floor — chỉ tăng ngưỡng, không hạ).
  coverageThreshold: {
    global: { statements: 66, branches: 51, functions: 60, lines: 67 },
  },
};

export default config;
