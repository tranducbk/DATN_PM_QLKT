import { prismaMock } from '../helpers/prismaMock';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
  validate: jest.fn(() => true),
}));

jest.mock('../../src/helpers/settingsHelper', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn().mockResolvedValue(undefined),
  getSettings: jest.fn().mockResolvedValue({}),
  isFeatureEnabled: jest.fn().mockResolvedValue(false),
  requireFeatureFlag: jest.fn(),
}));

import cron from 'node-cron';
import profileService from '../../src/services/profile.service';
import unitAnnualAwardService from '../../src/services/unitAnnualAward.service';
import unitService from '../../src/services/unit.service';
import { getSetting, setSetting } from '../../src/helpers/settingsHelper';
import { writeSystemLog } from '../../src/helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../src/constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../../src/constants/resourceSlugs.constants';
import { runCronJob, updateCronTask } from '../../src/services/recalcCron.service';

const mockSchedule = cron.schedule as jest.Mock;
const mockValidate = cron.validate as jest.Mock;
const mockGetSetting = getSetting as jest.Mock;
const mockSetSetting = setSetting as jest.Mock;
const mockWriteSystemLog = writeSystemLog as jest.Mock;

void prismaMock;

describe('Tác vụ định kỳ: chạy job tính toán lại hồ sơ', () => {
  beforeEach(() => {
    jest.spyOn(profileService, 'recalculateAll').mockResolvedValue({ success: 5, errors: [] } as never);
    jest.spyOn(unitAnnualAwardService, 'recalculate').mockResolvedValue(3 as never);
    jest.spyOn(unitService, 'recalculatePersonnelCount').mockResolvedValue(2 as never);
    mockSetSetting.mockResolvedValue(undefined);
    mockGetSetting.mockResolvedValue('0 1 1 * *');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Tác vụ định kỳ: chạy thành công → tính lại cá nhân + đơn vị + quân số và ghi log RECALCULATE', async () => {
    const result = await runCronJob();

    expect(profileService.recalculateAll).toHaveBeenCalledTimes(1);
    expect(unitAnnualAwardService.recalculate).toHaveBeenCalledTimes(1);
    expect(unitService.recalculatePersonnelCount).toHaveBeenCalledTimes(1);

    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.RECALCULATE,
        resource: RESOURCE_SLUGS.PROFILES,
      })
    );

    expect(result.status).toBe('success');
    expect(result.success).toBe(8);
    expect(result.errors).toBe(0);
  });

  it('Tác vụ định kỳ: ghi lại thời điểm chạy gần nhất (cron_last_run) và kết quả (cron_last_result)', async () => {
    await runCronJob();

    const keys = mockSetSetting.mock.calls.map(c => c[0]);
    expect(keys).toContain('cron_last_run');
    expect(keys).toContain('cron_last_result');
  });

  it('Tác vụ định kỳ: tính lại thất bại → ném lỗi, lưu kết quả lỗi, KHÔNG ghi log thành công', async () => {
    (profileService.recalculateAll as jest.Mock).mockRejectedValueOnce(new Error('DB sập'));

    await expect(runCronJob()).rejects.toThrow('DB sập');

    const lastResultCall = mockSetSetting.mock.calls.find(c => c[0] === 'cron_last_result');
    expect(lastResultCall?.[1]).toContain('error');
    expect(mockWriteSystemLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTIONS.RECALCULATE })
    );
  });
});

describe('Tác vụ định kỳ: đăng ký lịch chạy theo cấu hình', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function arrangeSettings(enabled: string, schedule = '0 1 1 * *') {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'cron_enabled') return Promise.resolve(enabled);
      if (key === 'cron_schedule') return Promise.resolve(schedule);
      return Promise.resolve(def);
    });
  }

  it('Tác vụ định kỳ: bật + cron hợp lệ → đăng ký task theo đúng lịch', async () => {
    arrangeSettings('true', '0 1 1 * *');
    mockValidate.mockReturnValue(true);

    await updateCronTask();

    expect(mockSchedule).toHaveBeenCalledWith('0 1 1 * *', expect.any(Function));
  });

  it('Tác vụ định kỳ: tắt → không đăng ký task nào', async () => {
    arrangeSettings('false');

    await updateCronTask();

    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('Tác vụ định kỳ: cron expression không hợp lệ → không đăng ký task', async () => {
    arrangeSettings('true', 'không-phải-cron');
    mockValidate.mockReturnValueOnce(false);

    await updateCronTask();

    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
