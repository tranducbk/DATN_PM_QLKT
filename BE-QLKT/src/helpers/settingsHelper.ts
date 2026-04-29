import { Request, Response, NextFunction } from 'express';
import { systemSettingRepository } from '../repositories/systemSetting.repository';

/**
 * Reads a system setting value by key.
 * @param key - Setting key
 * @param defaultValue - Fallback value when setting is missing
 * @returns Setting value or default value
 */
async function getSetting(key: string, defaultValue: string): Promise<string> {
  const setting = await systemSettingRepository.findUniqueByKey(key);
  return setting ? setting.value : defaultValue;
}

/**
 * Creates or updates a system setting.
 * @param key - Setting key
 * @param value - Setting value
 * @returns Promise resolved when persistence completes
 */
async function setSetting(key: string, value: string): Promise<void> {
  await systemSettingRepository.upsert(key, String(value));
}

/**
 * Gets multiple settings at once.
 * @param keys - List of setting keys
 * @returns Key-value map of existing settings
 */
async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const settings = await systemSettingRepository.findManyByKeys(keys);
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return map;
}

/**
 * Checks whether a feature flag is enabled.
 * @param key - Feature flag key
 * @returns `true` when the setting value equals `true`
 */
async function isFeatureEnabled(key: string): Promise<boolean> {
  return (await getSetting(key, 'false')) === 'true';
}

/**
 * Creates middleware that blocks requests when a feature flag is disabled.
 * @param key - Feature flag key
 * @returns Express middleware enforcing the feature flag
 */
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
