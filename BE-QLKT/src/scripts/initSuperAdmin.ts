#!/usr/bin/env node

/**
 * Script to initialize Super Admin for the system
 * Run: npm run init-super-admin
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { ROLES } from '../constants/roles.constants';
import { accountRepository } from '../repositories/account.repository';
import { prisma } from '../models';

const SUPER_ADMIN_USERNAME = 'superadmin';

async function initializeSuperAdmin(): Promise<void> {
  console.log('🚀 Starting to initialize SUPER_ADMIN...\n');

  const existingSuperAdmin = await accountRepository.findFirstRaw({
    where: { role: ROLES.SUPER_ADMIN },
  });

  if (existingSuperAdmin) {
    console.log('⚠️  SUPER_ADMIN already exists, skipping creation.');
    console.log(`   - Username: ${existingSuperAdmin.username}`);
    console.log(`   - ID: ${existingSuperAdmin.id}\n`);
    return;
  }

  const existingUser = await accountRepository.findFirstRaw({
    where: { username: SUPER_ADMIN_USERNAME },
  });

  if (existingUser) {
    console.log(`⚠️  Username '${SUPER_ADMIN_USERNAME}' already exists, skipping creation.\n`);
    return;
  }

  const defaultPassword = process.env.DEFAULT_PASSWORD;
  if (!defaultPassword) {
    throw new Error('DEFAULT_PASSWORD environment variable is not set');
  }
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // SUPER_ADMIN is system-level, not linked to any quan_nhan record
  const superAdmin = await accountRepository.create({
    username: SUPER_ADMIN_USERNAME,
    password_hash: hashedPassword,
    role: ROLES.SUPER_ADMIN,
    quan_nhan_id: null,
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
}

initializeSuperAdmin()
  .catch((error) => {
    console.error('❌ Error initializing SUPER_ADMIN:');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
