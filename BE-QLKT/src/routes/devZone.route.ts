import { Router, Request, Response, NextFunction } from 'express';
import profileService from '../services/profile.service';
import unitAnnualAwardService from '../services/unitAnnualAward.service';
import unitService from '../services/unit.service';
import backupService from '../services/backup.service';
import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { SETTING_DEFAULTS, AWARD_TYPES, SYSTEM_FEATURES } from '../constants/devZone.constants';
import { getSetting, setSetting, getSettings } from '../helpers/settingsHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { authLimiter } from '../configs/rateLimiter';
import { DEV_ZONE_PASSWORD } from '../configs';
import { systemSettingRepository } from '../repositories/systemSetting.repository';

const router = Router();

const DEV_PASSWORD = DEV_ZONE_PASSWORD;
if (!DEV_PASSWORD) {
  console.warn('[DevZone] DEV_ZONE_PASSWORD env var is not set — devZone routes are disabled');
}

const ALL_FEATURE_KEYS = [
  ...AWARD_TYPES.map((t: string) => `allow_${t}`),
  ...SYSTEM_FEATURES.map((f: string) => `allow_${f}`),
];

let cronTask: ScheduledTask | null = null;
let backupCronTask: ScheduledTask | null = null;
let lastCronRun: string | null = null;
interface CronResult {
  status: 'success' | 'error';
  time: string | null;
  success?: number;
  errors?: number;
  message?: string;
}

let lastCronResult: CronResult | null = null;

/** Runs the scheduled recalculation job for all personnel profiles and unit awards. */
const runCronJob = async () => {
  lastCronRun = new Date().toISOString();
  await setSetting('cron_last_run', lastCronRun);
  try {
    const [personnelResult, unitRecalculated, unitCountUpdated] = await Promise.all([
      profileService.recalculateAll(),
      unitAnnualAwardService.recalculate({ don_vi_id: undefined, nam: undefined }),
      unitService.recalculatePersonnelCount(),
    ]);
    const totalSuccess = (personnelResult.success || 0) + unitRecalculated;
    const totalErrors = personnelResult.errors?.length || 0;
    lastCronResult = {
      status: 'success',
      time: lastCronRun,
      success: totalSuccess,
      errors: totalErrors,
    };
    await setSetting('cron_last_result', JSON.stringify(lastCronResult));

    await writeSystemLog({
      userId: 'SYSTEM',
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: 'profiles',
      description: `Cron job tính toán hồ sơ: cá nhân ${personnelResult.success} thành công (${totalErrors} lỗi), đơn vị ${unitRecalculated} bản ghi, quân số ${unitCountUpdated} đơn vị cập nhật`,
      payload: {
        personnelSuccess: personnelResult.success,
        personnelErrors: totalErrors,
        unitRecalculated,
        unitCountUpdated,
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

/** Updates the active cron task based on cron_enabled and cron_schedule settings. */
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

/** Updates the backup cron task based on backup_enabled and backup_cron settings. */
const updateBackupCronTask = async () => {
  if (backupCronTask) {
    backupCronTask.stop();
    backupCronTask = null;
  }
  const enabled = (await getSetting('backup_enabled', 'false')) === 'true';
  const schedule = await getSetting('backup_cron', '0 2 * * *');
  if (enabled && cron.validate(schedule)) {
    backupCronTask = cron.schedule(schedule, () => {
      backupService
        .createBackup({ triggeredBy: 'SYSTEM', userId: 'SYSTEM', type: 'scheduled' })
        .catch(err => console.error('[BackupCron] Failed:', err));
    });
  }
};

/** Seeds default system settings to DB if they do not already exist. */
async function seedDefaults() {
  const existing = await systemSettingRepository.findManyRaw({
    where: { key: { in: Object.keys(SETTING_DEFAULTS) } },
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((s: { key: string }) => s.key));
  const toCreate = Object.entries(SETTING_DEFAULTS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({ key, value: value as string }));
  if (toCreate.length > 0) {
    await systemSettingRepository.createMany(toCreate);
  }
}

seedDefaults()
  .then(() => Promise.all([updateCronTask(), updateBackupCronTask()]))
  .catch(error => {
    console.error('[DevZone] Failed to seed defaults or initialize cron:', error);
  });

/** Middleware that authenticates DevZone requests via X-Dev-Password header or body.password. */
const verifyDevPassword = (req: Request, res: Response, next: NextFunction) => {
  if (!DEV_PASSWORD) {
    return res.status(503).json({ success: false, message: 'DevZone không khả dụng' });
  }
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

/** Returns all feature flags as a key → boolean map from DB settings. */
async function getFeatures() {
  const settingsMap = await getSettings(ALL_FEATURE_KEYS);
  const features: Record<string, boolean> = {};
  for (const key of ALL_FEATURE_KEYS) {
    features[key] = settingsMap[key] === 'true';
  }
  return features;
}

/**
 * @route   GET /api/dev-zone/features
 * @desc    Get all feature flags
 * @access  Public
 */
router.get('/features', async (req: Request, res: Response) => {
  res.json({ success: true, data: await getFeatures() });
});

/**
 * @route   POST /api/dev-zone/auth
 * @desc    Authenticate with DevZone password
 * @access  Public (rate limited)
 */
router.post('/auth', authLimiter, (req: Request, res: Response) => {
  if (!DEV_PASSWORD) {
    return res.status(503).json({ success: false, message: 'DevZone không khả dụng' });
  }
  const { password } = req.body;
  if (password === DEV_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: 'Mật khẩu không đúng' });
});

/**
 * @route   GET /api/dev-zone/status
 * @desc    Get cron job status, feature flags, and server info
 * @access  Private - DevZone password required
 */
router.get('/status', verifyDevPassword, async (req: Request, res: Response) => {
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

/**
 * @route   POST /api/dev-zone/cron/trigger
 * @desc    Manually trigger the cron recalculation job
 * @access  Private - DevZone password required
 */
router.post('/cron/trigger', verifyDevPassword, async (req: Request, res: Response) => {
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

/**
 * @route   PUT /api/dev-zone/cron/schedule
 * @desc    Update cron schedule or toggle cron enabled state
 * @access  Private - DevZone password required
 */
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

/**
 * @route   POST /api/dev-zone/recalculate-unit-count
 * @desc    Recalculate personnel headcount for all units
 * @access  Private - DevZone password required
 */
router.post('/recalculate-unit-count', verifyDevPassword, async (req: Request, res: Response) => {
  try {
    const updated = await unitService.recalculatePersonnelCount();

    await writeSystemLog({
      userId: 'SYSTEM',
      userRole: 'SYSTEM',
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: 'units',
      description: `Tính lại quân số đơn vị: ${updated} đơn vị đã cập nhật`,
      payload: { updated },
    });

    res.json({
      success: true,
      message: `Đã cập nhật quân số cho ${updated} đơn vị`,
      data: { updated },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: errMessage });
  }
});

/**
 * @route   PUT /api/dev-zone/features
 * @desc    Update one or more feature flags
 * @access  Private - DevZone password required
 */
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

/**
 * @route   POST /api/dev-zone/backup/trigger
 * @desc    Manually trigger a backup
 * @access  Private - DevZone password required
 */
router.post('/backup/trigger', verifyDevPassword, async (req: Request, res: Response) => {
  try {
    const result = await backupService.createBackup({
      triggeredBy: 'devzone',
      userId: 'SYSTEM',
      type: 'manual',
    });
    res.json({ success: true, message: 'Backup thành công', data: result });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: errMessage });
  }
});

/**
 * @route   GET /api/dev-zone/backup/status
 * @desc    Get backup schedule config and recent backup list
 * @access  Private - DevZone password required
 */
router.get('/backup/status', verifyDevPassword, async (req: Request, res: Response) => {
  const [enabled, schedule, retentionDays, lastRun] = await Promise.all([
    getSetting('backup_enabled', 'false'),
    getSetting('backup_cron', '0 2 * * *'),
    getSetting('backup_retention_days', '15'),
    getSetting('backup_last_run', null),
  ]);
  const files = backupService.listBackups();
  res.json({
    success: true,
    data: {
      enabled: enabled === 'true',
      schedule,
      retentionDays: parseInt(retentionDays, 10),
      lastRun,
      recentBackups: files.slice(0, 5),
      totalFiles: files.length,
    },
  });
});

/**
 * @route   PUT /api/dev-zone/backup/schedule
 * @desc    Update backup schedule settings
 * @access  Private - DevZone password required
 */
router.put('/backup/schedule', verifyDevPassword, async (req: Request, res: Response) => {
  const { enabled, schedule, retentionDays } = req.body as {
    enabled?: boolean;
    schedule?: string;
    retentionDays?: number;
  };

  if (typeof enabled === 'boolean') await setSetting('backup_enabled', String(enabled));

  if (schedule !== undefined) {
    if (!cron.validate(schedule)) {
      return res.status(400).json({ success: false, message: 'Cron expression không hợp lệ' });
    }
    await setSetting('backup_cron', schedule);
  }

  if (retentionDays !== undefined && retentionDays > 0) {
    await setSetting('backup_retention_days', String(retentionDays));
  }

  await updateBackupCronTask();

  const currentEnabled = (await getSetting('backup_enabled', 'false')) === 'true';
  const currentSchedule = await getSetting('backup_cron', '0 2 * * *');
  const currentRetention = await getSetting('backup_retention_days', '15');

  res.json({
    success: true,
    message: `Backup tự động ${currentEnabled ? 'đã bật' : 'đã tắt'}`,
    data: {
      enabled: currentEnabled,
      schedule: currentSchedule,
      retentionDays: parseInt(currentRetention, 10),
    },
  });
});

/**
 * @route   POST /api/dev-zone/backup/cleanup
 * @desc    Manually trigger old backup cleanup
 * @access  Private - DevZone password required
 */
router.post('/backup/cleanup', verifyDevPassword, async (req: Request, res: Response) => {
  try {
    const result = await backupService.cleanupOldBackups();
    res.json({
      success: true,
      message: `Đã xóa ${result.deleted} file backup cũ`,
      data: result,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: errMessage });
  }
});

export default router;
