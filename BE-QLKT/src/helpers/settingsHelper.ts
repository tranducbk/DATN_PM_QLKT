import { Request, Response, NextFunction } from 'express';
import { prisma } from '../models';

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting ? setting.value : defaultValue;
}

async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
}

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return map;
}

async function isFeatureEnabled(key: string): Promise<boolean> {
  return (await getSetting(key, 'false')) === 'true';
}

function requireFeatureFlag(
  key: string
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const enabled = await isFeatureEnabled(key);
    if (!enabled) {
      res.status(403).json({
        success: false,
        message: 'Đã xảy ra lỗi. Vui lòng tải lại trang và thử lại.',
      });
      return;
    }
    next();
  };
}

export { getSetting, setSetting, getSettings, isFeatureEnabled, requireFeatureFlag };
