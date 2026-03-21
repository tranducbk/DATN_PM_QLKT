const { prisma } = require('../models');

/** Đọc setting từ DB */
async function getSetting(key, defaultValue) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting ? setting.value : defaultValue;
}

/** Lưu setting vào DB */
async function setSetting(key, value) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}

/** Đọc nhiều settings cùng lúc (tránh N+1) */
async function getSettings(keys) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  const map = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return map;
}

/** Check feature flag có bật không */
async function isFeatureEnabled(key) {
  return (await getSetting(key, 'false')) === 'true';
}

/**
 * Express middleware: yêu cầu feature flag phải bật
 * @param {string} key - Tên setting key (VD: 'allow_delete_logs')
 */
function requireFeatureFlag(key) {
  return async (req, res, next) => {
    const enabled = await isFeatureEnabled(key);
    if (!enabled) {
      return res.status(403).json({
        success: false,
        message: 'Đã xảy ra lỗi. Vui lòng tải lại trang và thử lại.',
      });
    }
    next();
  };
}

module.exports = { getSetting, setSetting, getSettings, isFeatureEnabled, requireFeatureFlag };
