import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import unitService from '../services/unit.service';
import backupService from '../services/backup.service';
import profileService from '../services/profile.service';
import { NotFoundError } from '../middlewares/errorHandler';
import cron from 'node-cron';
import { AWARD_TYPES, SYSTEM_FEATURES } from '../constants/devZone.constants';
import {
  runCronJob,
  updateCronTask,
  updateBackupCronTask,
  getCronState,
} from '../services/recalcCron.service';
import { getSetting, setSetting, getSettings } from '../helpers/settingsHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { describeCron } from '../helpers/cronDescribe';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import { SYSTEM_ACTOR } from '../constants/roles.constants';
import { authLimiter } from '../configs/rateLimiter';
import { DEV_ZONE_PASSWORD } from '../configs';

const router = Router();

const DEV_PASSWORD = DEV_ZONE_PASSWORD;
if (!DEV_PASSWORD) {
  console.warn('[DevZone] DEV_ZONE_PASSWORD env var is not set — devZone routes are disabled');
}

const ALL_FEATURE_KEYS = [
  ...AWARD_TYPES.map((t: string) => `allow_${t}`),
  ...SYSTEM_FEATURES.map((f: string) => `allow_${f}`),
];

/** Length-revealing constant-time string compare (avoids early-exit timing oracle). */
function constantTimeEqual(input: string, secret: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const verifyDevPasswordCore = (req: Request, res: Response, next: NextFunction) => {
  if (!DEV_PASSWORD) {
    return res.status(503).json({ success: false, message: 'DevZone không khả dụng' });
  }
  const header = req.headers['x-dev-password'];
  const headerPwd = Array.isArray(header) ? header[0] : header;
  const bodyPwd =
    req.body &&
    typeof req.body === 'object' &&
    'password' in req.body &&
    typeof (req.body as { password?: unknown }).password === 'string'
      ? (req.body as { password: string }).password
      : undefined;
  const password = headerPwd ?? bodyPwd;
  if (typeof password !== 'string' || !constantTimeEqual(password, DEV_PASSWORD)) {
    return res.status(401).json({ success: false, message: 'Mật khẩu không đúng' });
  }
  next();
};

// Rate-limit every privileged DevZone route so the shared password can't be brute-forced.
// Express flattens this array wherever `verifyDevPassword` is used as a route handler.
const verifyDevPassword = [authLimiter, verifyDevPasswordCore];

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
  if (typeof password === 'string' && constantTimeEqual(password, DEV_PASSWORD)) {
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
  const { lastCronRun, lastCronResult } = getCronState();
  const cronEnabled = (await getSetting('cron_enabled', 'true')) === 'true';
  const cronSchedule = await getSetting('cron_schedule', '0 1 1 * *');
  const storedLastRun = await getSetting('cron_last_run', null);
  const storedLastResult = await getSetting('cron_last_result', null);

  let parsedLastResult = lastCronResult;
  if (storedLastResult) {
    try {
      parsedLastResult = JSON.parse(storedLastResult);
    } catch (e) {
      void writeSystemLog({
        action: AUDIT_ACTIONS.ERROR,
        resource: RESOURCE_SLUGS.DEV_ZONE,
        description: `Dữ liệu cron_last_result không hợp lệ: ${e}`,
      });
    }
  }

  res.json({
    success: true,
    data: {
      cron: {
        enabled: cronEnabled,
        schedule: cronSchedule,
        lastRun: storedLastRun || lastCronRun,
        lastResult: parsedLastResult,
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
      userId: SYSTEM_ACTOR,
      userRole: SYSTEM_ACTOR,
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: RESOURCE_SLUGS.PROFILES,
      description: `Tính toán lại hồ sơ: ${result.success} thành công, ${result.errors || 0} lỗi (kích hoạt thủ công)`,
      payload: { success: result.success, errors: result.errors || 0 },
    });

    res.json({ success: true, message: 'Tác vụ định kỳ đã chạy xong', data: result });
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

  await writeSystemLog({
    userId: SYSTEM_ACTOR,
    userRole: SYSTEM_ACTOR,
    action: AUDIT_ACTIONS.UPDATE,
    resource: RESOURCE_SLUGS.DEV_ZONE,
    description: `Cập nhật tác vụ định kỳ: ${cronEnabled ? 'bật' : 'tắt'}, lịch ${describeCron(cronSchedule)}`,
    payload: { enabled: cronEnabled, schedule: cronSchedule },
  });

  res.json({
    success: true,
    message: `Tác vụ định kỳ ${cronEnabled ? 'đã bật' : 'đã tắt'}. Lịch: ${cronSchedule}`,
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
      userId: SYSTEM_ACTOR,
      userRole: SYSTEM_ACTOR,
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: RESOURCE_SLUGS.UNITS,
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
 * @route   POST /api/dev-zone/recalculate-profile
 * @desc    Recalculate all three profile types for one personnel (with personnel_id) or every personnel (without)
 * @access  Private - DevZone password required
 */
router.post('/recalculate-profile', verifyDevPassword, async (req: Request, res: Response) => {
  const body = req.body as { personnel_id?: string };
  const personnelId = typeof body.personnel_id === 'string' ? body.personnel_id.trim() : '';

  try {
    if (personnelId) {
      const { ho_ten } = await profileService.recalculateFullProfile(personnelId);

      await writeSystemLog({
        userId: SYSTEM_ACTOR,
        userRole: SYSTEM_ACTOR,
        action: AUDIT_ACTIONS.RECALCULATE,
        resource: RESOURCE_SLUGS.PROFILES,
        resourceId: personnelId,
        description: `Tính toán lại hồ sơ ${ho_ten || 'một quân nhân'} (kích hoạt thủ công)`,
      });

      return res.json({
        success: true,
        message: `Đã tính toán lại hồ sơ cho ${ho_ten || 'quân nhân'}`,
        data: { personnel_id: personnelId },
      });
    }

    const result = await profileService.recalculateAllFullProfiles();

    await writeSystemLog({
      userId: SYSTEM_ACTOR,
      userRole: SYSTEM_ACTOR,
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: RESOURCE_SLUGS.PROFILES,
      description: `Tính toán lại toàn bộ hồ sơ quân nhân: ${result.success} thành công, ${result.errors.length} lỗi (kích hoạt thủ công)`,
      payload: { success: result.success, errors: result.errors.length },
    });

    return res.json({
      success: true,
      message: `Đã tính toán lại hồ sơ cho ${result.success} quân nhân${result.errors.length ? `, ${result.errors.length} lỗi` : ''}`,
      data: { success: result.success, errors: result.errors.length },
    });
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy quân nhân với ID đã nhập' });
    }
    const errMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, message: errMessage });
  }
});

/**
 * @route   PUT /api/dev-zone/features
 * @desc    Update one or more feature flags
 * @access  Private - DevZone password required
 */
router.put('/features', verifyDevPassword, async (req: Request, res: Response) => {
  const updates = req.body;

  const changed: string[] = [];
  for (const key of ALL_FEATURE_KEYS) {
    if (typeof updates[key] === 'boolean') {
      await setSetting(key, String(updates[key]));
      changed.push(`${key}=${updates[key]}`);
    }
  }

  if (changed.length > 0) {
    await writeSystemLog({
      userId: SYSTEM_ACTOR,
      userRole: SYSTEM_ACTOR,
      action: AUDIT_ACTIONS.UPDATE,
      resource: RESOURCE_SLUGS.DEV_ZONE,
      description: `Cập nhật tính năng hệ thống: ${changed.join(', ')}`,
      payload: { changed },
    });
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
      userId: SYSTEM_ACTOR,
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
      recentBackups: files,
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

  await writeSystemLog({
    userId: SYSTEM_ACTOR,
    userRole: SYSTEM_ACTOR,
    action: AUDIT_ACTIONS.UPDATE,
    resource: RESOURCE_SLUGS.BACKUP,
    description: `Cập nhật lịch backup tự động: ${currentEnabled ? 'bật' : 'tắt'}, lịch ${describeCron(currentSchedule)}, giữ ${currentRetention} ngày`,
    payload: {
      enabled: currentEnabled,
      schedule: currentSchedule,
      retentionDays: parseInt(currentRetention, 10),
    },
  });

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
 * @route   DELETE /api/dev-zone/backup/:filename
 * @desc    Delete a specific backup file by name
 * @access  Private - DevZone password required
 */
router.delete('/backup/:filename', verifyDevPassword, async (req: Request, res: Response) => {
  const param = req.params.filename;
  const filename = Array.isArray(param) ? param[0] : param;
  try {
    await backupService.deleteBackup(filename);
    res.json({ success: true, message: 'Đã xóa file sao lưu' });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    res.status(400).json({ success: false, message: errMessage });
  }
});

export default router;
