import { prismaMock } from '../helpers/prismaMock';
import request from 'supertest';

jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
  validate: jest.fn(() => true),
}));

import { app } from '../../src/app';
import { writeSystemLog } from '../../src/helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../../src/constants/auditActions.constants';
import { RESOURCE_SLUGS } from '../../src/constants/resourceSlugs.constants';

const DEV_PW = process.env.DEV_ZONE_PASSWORD as string;
const mockWriteSystemLog = writeSystemLog as jest.Mock;

describe('DevZone: ghi log khi đổi cấu hình hệ thống (chỉ SUPER_ADMIN xem)', () => {
  beforeEach(() => {
    prismaMock.systemSetting.findUnique.mockResolvedValue({ value: 'true' } as never);
    prismaMock.systemSetting.upsert.mockResolvedValue({} as never);
    prismaMock.systemSetting.findMany.mockResolvedValue([] as never);
  });

  it('Đổi lịch tác vụ định kỳ → ghi log UPDATE / dev-zone', async () => {
    const res = await request(app)
      .put('/api/dev-zone/cron/schedule')
      .set('x-dev-password', DEV_PW)
      .send({ enabled: true, schedule: '0 1 1 * *' });

    expect(res.status).toBe(200);
    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.UPDATE,
        resource: RESOURCE_SLUGS.DEV_ZONE,
      })
    );
  });

  it('Bật/tắt tính năng hệ thống → ghi log UPDATE / dev-zone', async () => {
    const res = await request(app)
      .put('/api/dev-zone/features')
      .set('x-dev-password', DEV_PW)
      .send({ allow_annual: true });

    expect(res.status).toBe(200);
    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.UPDATE,
        resource: RESOURCE_SLUGS.DEV_ZONE,
      })
    );
  });

  it('Đổi lịch sao lưu tự động → ghi log UPDATE / backup', async () => {
    const res = await request(app)
      .put('/api/dev-zone/backup/schedule')
      .set('x-dev-password', DEV_PW)
      .send({ enabled: true, schedule: '0 2 * * *', retentionDays: 10 });

    expect(res.status).toBe(200);
    expect(mockWriteSystemLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.UPDATE,
        resource: RESOURCE_SLUGS.BACKUP,
      })
    );
  });

  it('Sai mật khẩu DevZone → 401, không đổi cấu hình', async () => {
    const res = await request(app)
      .put('/api/dev-zone/features')
      .set('x-dev-password', 'mat-khau-sai')
      .send({ allow_annual: true });

    expect(res.status).toBe(401);
  });
});
