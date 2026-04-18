#!/usr/bin/env node

/**
 * Script to initialize Super Admin for the system
 * Run: npm run init-super-admin
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/prisma';
import { ROLES } from '../constants/roles.constants';

const prisma = new PrismaClient();

async function initializeSuperAdmin() {
  try {
    console.log('🚀 Starting to initialize SUPER_ADMIN...\n');

    const existingSuperAdmin = await prisma.taiKhoan.findFirst({
      where: { role: ROLES.SUPER_ADMIN },
    });

    if (existingSuperAdmin) {
      console.log('⚠️  SUPER_ADMIN already exists!');
      console.log(`   - Username: ${existingSuperAdmin.username}`);
      console.log(`   - ID: ${existingSuperAdmin.id}`);
      console.log('\nℹ️  If you want to create again, please delete the account first.\n');
      process.exit(1);
    }

    const existingUser = await prisma.taiKhoan.findFirst({
      where: { username: 'superadmin' },
    });

    if (existingUser) {
      console.log("❌ Username 'superadmin' already exists!");
      console.log('💡 Please delete this user before or choose a different username.\n');
      process.exit(1);
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD;
    if (!defaultPassword) {
      console.error('❌ DEFAULT_PASSWORD environment variable is not set');
      process.exit(1);
    }
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // No quan_nhan link needed for SUPER_ADMIN
    const superAdmin = await prisma.taiKhoan.create({
      data: {
        username: 'superadmin',
        password_hash: hashedPassword,
        role: ROLES.SUPER_ADMIN,
        quan_nhan_id: null,
      },
    });

    console.log('✅ SUPER_ADMIN initialization successful!\n');
    console.log('📋 Login information:');
    console.log(`   ├─ Username: ${superAdmin.username}`);
    console.log(`   ├─ Password: ${defaultPassword}`);
    console.log(`   ├─ Role: ${superAdmin.role}`);
    console.log(`   └─ ID: ${superAdmin.id}`);
    console.log(
      '\n⚠️  IMPORTANT: Please change your password immediately after logging in for the first time!\n'
    );

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing SUPER_ADMIN:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

initializeSuperAdmin();
