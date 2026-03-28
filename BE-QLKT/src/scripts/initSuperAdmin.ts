#!/usr/bin/env node

/**
 * Script khởi tạo Super Admin cho hệ thống QLKT
 * Chạy: npm run init-super-admin
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function initializeSuperAdmin() {
  try {
    console.log('🚀 Bắt đầu khởi tạo SUPER_ADMIN...\n');

    // Kiểm tra xem đã có super admin chưa
    const existingSuperAdmin = await prisma.taiKhoan.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (existingSuperAdmin) {
      console.log('⚠️  Đã tồn tại tài khoản SUPER_ADMIN!');
      console.log(`   - Username: ${existingSuperAdmin.username}`);
      console.log(`   - ID: ${existingSuperAdmin.id}`);
      console.log('\nℹ️  Nếu muốn tạo lại, hãy xóa tài khoản này trước.\n');
      process.exit(1);
    }

    // Kiểm tra username "superadmin" đã tồn tại chưa
    const existingUser = await prisma.taiKhoan.findFirst({
      where: { username: 'superadmin' },
    });

    if (existingUser) {
      console.log("❌ Username 'superadmin' đã tồn tại!");
      console.log('💡 Vui lòng xóa user này trước hoặc chọn username khác.\n');
      process.exit(1);
    }

    // Hash password - Mật khẩu mặc định lấy từ env
    const defaultPassword = process.env.DEFAULT_PASSWORD || 'Hvkhqs@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Tạo tài khoản SUPER_ADMIN (không cần liên kết với quân nhân)
    const superAdmin = await prisma.taiKhoan.create({
      data: {
        username: 'superadmin',
        password_hash: hashedPassword,
        role: 'SUPER_ADMIN',
        quan_nhan_id: null,
      },
    });

    console.log('✅ Khởi tạo SUPER_ADMIN thành công!\n');
    console.log('📋 Thông tin đăng nhập:');
    console.log(`   ├─ Username: ${superAdmin.username}`);
    console.log(`   ├─ Password: ${defaultPassword}`);
    console.log(`   ├─ Role: ${superAdmin.role}`);
    console.log(`   └─ ID: ${superAdmin.id}`);
    console.log('\n⚠️  QUAN TRỌNG: Hãy đổi mật khẩu ngay sau khi đăng nhập lần đầu!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo SUPER_ADMIN:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy script
initializeSuperAdmin();
