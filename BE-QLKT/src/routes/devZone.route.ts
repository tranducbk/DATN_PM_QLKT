import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../models';
import profileService from '../services/profile.service';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { SETTING_DEFAULTS, AWARD_TYPES, SYSTEM_FEATURES } from '../constants/devZone.constants';
import { getSetting, setSetting, getSettings } from '../helpers/settingsHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

const router = Router();

const DEV_PASSWORD = process.env.DEV_ZONE_PASSWORD || 'admin_msa_!@#';

const ALL_FEATURE_KEYS = [
  ...AWARD_TYPES.map((t: string) => `allow_${t}`),
  ...SYSTEM_FEATURES.map((f: string) => `allow_${f}`),
];

let cronTask: ScheduledTask | null = null;
let lastCronRun: string | null = null;
interface CronResult {
  status: 'success' | 'error';
  time: string | null;
  success?: number;
  errors?: number;
  message?: string;
}

let lastCronResult: CronResult | null = null;

const runCronJob = async () => {
  lastCronRun = new Date().toISOString();
  await setSetting('cron_last_run', lastCronRun);
  try {
    const result = await profileService.recalculateAll();
    lastCronResult = {
      status: 'success',
      time: lastCronRun,
      success: result.success,
      errors: result.errors?.length || 0,
    };
    await setSetting('cron_last_result', JSON.stringify(lastCronResult));

    await writeSystemLog({
      userId: 'SYSTEM',
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: 'profiles',
      description: `Cron job tính toán hồ sơ: ${result.success} thành công, ${result.errors || 0} lỗi`,
      payload: {
        success: result.success,
        errors: result.errors || 0,
        schedule: await getSetting('cron_schedule', '0 1 1 * *'),
      },
    });

    return lastCronResult;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    lastCronResult = {
      status: 'error',
      time: lastCronRun,
      message: errMessage,
    };
    await setSetting('cron_last_result', JSON.stringify(lastCronResult));
    throw error;
  }
};

const updateCronTask = async () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  const enabled = (await getSetting('cron_enabled', 'true')) === 'true';
  const schedule = await getSetting('cron_schedule', '0 1 1 * *');
  if (enabled && cron.validate(schedule)) {
    cronTask = cron.schedule(schedule, runCronJob);
  }
};

async function seedDefaults() {
  const existing = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(SETTING_DEFAULTS) } },
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((s: { key: string }) => s.key));
  const toCreate = Object.entries(SETTING_DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({ key, value: value as string }));
  if (toCreate.length > 0) {
    await prisma.systemSetting.createMany({ data: toCreate });
  }
}

seedDefaults()
  .then(() => updateCronTask())
  .catch(() => {});

const verifyDevPassword = (req: Request, res: Response, next: NextFunction) => {
  const bodyPwd =
    req.body &&
    typeof req.body === 'object' &&
    'password' in req.body &&
    typeof (req.body as { password?: unknown }).password === 'string'
      ? (req.body as { password: string }).password
      : undefined;
  const password = req.headers['x-dev-password'] || bodyPwd;
  if (password !== DEV_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Mật khẩu không đúng' });
  }
  next();
};

/** Build features object from batch query */
async function getFeatures() {
  const settingsMap = await getSettings(ALL_FEATURE_KEYS);
  const features: Record<string, boolean> = {};
  for (const key of ALL_FEATURE_KEYS) {
    features[key] = settingsMap[key] === 'true';
  }
  return features;
}

router.get('/features', async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getFeatures() });
});

router.post('/auth', (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === DEV_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: 'Mật khẩu không đúng' });
});

router.get('/status', verifyDevPassword, async (_req: Request, res: Response) => {
  const cronEnabled = (await getSetting('cron_enabled', 'true')) === 'true';
  const cronSchedule = await getSetting('cron_schedule', '0 1 1 * *');
  const storedLastRun = await getSetting('cron_last_run', null);
  const storedLastResult = await getSetting('cron_last_result', null);

  res.json({
    success: true,
    data: {
      cron: {
        enabled: cronEnabled,
        schedule: cronSchedule,
        lastRun: storedLastRun || lastCronRun,
        lastResult: storedLastResult ? JSON.parse(storedLastResult) : lastCronResult,
      },
      features: await getFeatures(),
      server: {
        uptime: Math.floor(process.uptime()),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeVersion: process.version,
      },
    },
  });
});

router.post('/cron/trigger', verifyDevPassword, async (_req: Request, res: Response) => {
  try {
    const result = await runCronJob();

    await writeSystemLog({
      userId: 'SYSTEM',
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: 'profiles',
      description: `Tính toán lại hồ sơ: ${result.success} thành công, ${result.errors || 0} lỗi (trigger thủ công)`,
      payload: { success: result.success, errors: result.errors || 0 },
    });

    res.json({ success: true, message: 'Cron job đã chạy xong', data: result });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: errMessage });
  }
});

router.put('/cron/schedule', verifyDevPassword, async (req: Request, res: Response) => {
  const { schedule, enabled } = req.body;

  if (typeof enabled === 'boolean') {
    await setSetting('cron_enabled', String(enabled));
  }

  if (schedule) {
    if (!cron.validate(schedule)) {
      return res.status(400).json({ success: false, message: 'Cron expression không hợp lệ' });
    }
    await setSetting('cron_schedule', schedule);
  }

  await updateCronTask();

  const cronEnabled = (await getSetting('cron_enabled', 'true')) === 'true';
  const cronSchedule = await getSetting('cron_schedule', '0 1 1 * *');

  res.json({
    success: true,
    message: `Cron job ${cronEnabled ? 'đã bật' : 'đã tắt'}. Lịch: ${cronSchedule}`,
    data: { enabled: cronEnabled, schedule: cronSchedule },
  });
});

router.put('/features', verifyDevPassword, async (req: Request, res: Response) => {
  const updates = req.body;

  for (const key of ALL_FEATURE_KEYS) {
    if (typeof updates[key] === 'boolean') {
      await setSetting(key, String(updates[key]));
    }
  }

  res.json({
    success: true,
    message: 'Cập nhật tính năng thành công',
    data: await getFeatures(),
  });
});

export default router;
