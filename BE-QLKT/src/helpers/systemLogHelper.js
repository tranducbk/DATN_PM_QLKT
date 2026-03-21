/**
 * Helper ghi System Log trực tiếp từ service (không qua middleware)
 * Dùng cho import, bulk create, recalculate — các thao tác không đi qua route audit
 */
const { prisma } = require('../models');

async function writeSystemLog({
  userId,
  userRole,
  action,
  resource,
  resourceId = null,
  description,
  payload = null,
}) {
  try {
    await prisma.systemLog.create({
      data: {
        nguoi_thuc_hien_id: userId,
        actor_role: userRole || 'SYSTEM',
        action,
        resource,
        tai_nguyen_id: resourceId,
        description: description.substring(0, 500),
        payload: payload ? JSON.stringify(payload) : null,
      },
    });
  } catch {
    // Không throw — log lỗi không được ảnh hưởng nghiệp vụ
  }
}

module.exports = { writeSystemLog };
