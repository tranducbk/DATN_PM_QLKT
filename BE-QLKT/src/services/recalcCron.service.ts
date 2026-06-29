import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import profileService from './profile.service';
import unitAnnualAwardService from './unitAnnualAward.service';
import unitService from './unit.service';
import backupService from './backup.service';
import { SETTING_DEFAULTS } from '../constants/devZone.constants';
import { getSetting, setSetting } from '../helpers/settingsHelper';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../constants/resourceSlugs.constants';
import { SYSTEM_ACTOR } from '../constants/roles.constants';
import { systemSettingRepository } from '../repositories/systemSetting.repository';

interface CronResult {
  status: 'success' | 'error';
  time: string | null;
  success?: number;
  errors?: number;
  message?: string;
}

let cronTask: ScheduledTask | null = null;
let backupCronTask: ScheduledTask | null = null;
let lastCronRun: string | null = null;
let lastCronResult: CronResult | null = null;

/**
 * Returns the latest in-memory cron run timestamp and result.
 * @returns Last run time and result, surfaced by the DevZone status endpoint
 */
export function getCronState(): { lastCronRun: string | null; lastCronResult: CronResult | null } {
  return { lastCronRun, lastCronResult };
}

/**
 * Recalculates every personnel profile, unit award and unit headcount, then logs the outcome.
 * @returns Run summary with success and error counts
 */
export async function runCronJob(): Promise<CronResult> {
  lastCronRun = new Date().toISOString();
  await setSetting('cron_last_run', lastCronRun);
  try {
    const [personnelResult, unitRecalculated, unitCountUpdated] = await Promise.all([
      profileService.recalculateAll(),
      unitAnnualAwardService.recalculate({ don_vi_id: undefined, nam: new Date().getFullYear() }),
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
      userId: SYSTEM_ACTOR,
      userRole: SYSTEM_ACTOR,
      action: AUDIT_ACTIONS.RECALCULATE,
      resource: RESOURCE_SLUGS.PROFILES,
      description: `Tác vụ định kỳ tính toán hồ sơ: cá nhân ${personnelResult.success} thành công (${totalErrors} lỗi), đơn vị ${unitRecalculated} bản ghi, quân số ${unitCountUpdated} đơn vị cập nhật`,
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
    lastCronResult = { status: 'error', time: lastCronRun, message: errMessage };
    await setSetting('cron_last_result', JSON.stringify(lastCronResult));
    throw error;
  }
}

/** Re-registers the recalculation cron task from cron_enabled and cron_schedule settings. */
export async function updateCronTask(): Promise<void> {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
  const enabled = (await getSetting('cron_enabled', 'true')) === 'true';
  const schedule = await getSetting('cron_schedule', '0 1 1 * *');
  if (enabled && cron.validate(schedule)) {
    cronTask = cron.schedule(schedule, () => {
      runCronJob().catch(err => console.error('[RecalcCron] Failed:', err));
    });
  }
}

/** Re-registers the auto-backup cron task from backup_enabled and backup_cron settings. */
export async function updateBackupCronTask(): Promise<void> {
  if (backupCronTask) {
    backupCronTask.stop();
    backupCronTask = null;
  }
  const enabled = (await getSetting('backup_enabled', 'false')) === 'true';
  const schedule = await getSetting('backup_cron', '0 2 * * *');
  if (enabled && cron.validate(schedule)) {
    backupCronTask = cron.schedule(schedule, () => {
      backupService
        .createBackup({ triggeredBy: SYSTEM_ACTOR, userId: SYSTEM_ACTOR, type: 'scheduled' })
        .catch(err => console.error('[BackupCron] Failed:', err));
    });
  }
}

/** Seeds default system settings if absent, then starts the recalculation and backup cron tasks. */
export async function initScheduledJobs(): Promise<void> {
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
  await Promise.all([updateCronTask(), updateBackupCronTask()]);
}
