import { prismaMock } from '../helpers/prismaMock';

jest.mock('../../src/helpers/settingsHelper', () => ({
  isFeatureEnabled: jest.fn().mockResolvedValue(false),
  getSetting: jest.fn(),
  setSetting: jest.fn(),
  getSettings: jest.fn(),
  requireFeatureFlag: jest.fn(),
}));

import systemLogsService from '../../src/services/systemLogs.service';
import { ROLES } from '../../src/constants/roles.constants';
import { AUDIT_ACTIONS } from '../../src/constants/auditActions.constants';
import { isFeatureEnabled } from '../../src/helpers/settingsHelper';

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const PARAMS_BASE = {
  page: 1,
  limit: 10,
};

function arrangeLogQueries(logs: unknown[] = [], total = 0) {
  prismaMock.systemLog.findMany.mockResolvedValueOnce(logs);
  prismaMock.systemLog.count
    .mockResolvedValueOnce(total)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
}

describe('systemLogs.service - getLogs role visibility', () => {
  beforeEach(() => {
    mockIsFeatureEnabled.mockResolvedValue(false);
  });

  it('Cho role không hợp lệ → Khi getLogs → Thì trả null', async () => {
    const result = await systemLogsService.getLogs({
      ...PARAMS_BASE,
      userRole: ROLES.USER,
    });

    expect(result).toBeNull();
  });

  it('Cho ADMIN không truyền resource → Khi getLogs → Thì where.resource = { not: "backup" }', async () => {
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({ ...PARAMS_BASE, userRole: ROLES.ADMIN });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.resource).toEqual({ not: 'backup' });
    expect(args.where.actor_role).toEqual({
      in: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, 'SYSTEM'],
    });
  });

  it('Cho ADMIN truyền resource=backup → Khi getLogs → Thì trả thẳng empty (không query)', async () => {
    const result = await systemLogsService.getLogs({
      ...PARAMS_BASE,
      resource: 'backup',
      userRole: ROLES.ADMIN,
    });

    expect(result).toEqual({ logs: [], total: 0, stats: { create: 0, delete: 0, update: 0 } });
    expect(prismaMock.systemLog.findMany).not.toHaveBeenCalled();
  });

  it('Cho SUPER_ADMIN truyền resource=backup → Khi getLogs → Thì cho phép query backup', async () => {
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({
      ...PARAMS_BASE,
      resource: 'backup',
      userRole: ROLES.SUPER_ADMIN,
    });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.resource).toBe('backup');
  });

  it('Cho feature view-errors tắt → Khi getLogs → Thì where.action loại trừ ERROR', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({ ...PARAMS_BASE, userRole: ROLES.SUPER_ADMIN });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.action).toEqual({ not: 'ERROR' });
  });

  it('Cho startDate và endDate → Khi getLogs → Thì where.createdAt có gte và lte', async () => {
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({
      ...PARAMS_BASE,
      userRole: ROLES.SUPER_ADMIN,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.where.createdAt.lte).toBeInstanceOf(Date);
  });
});

describe('systemLogs.service - getResources', () => {
  it('Cho role ADMIN → Khi getResources → Thì filter ra resource backup', async () => {
    prismaMock.systemLog.findMany.mockResolvedValueOnce([
      { resource: 'personnel' },
      { resource: 'proposal' },
    ]);

    const result = await systemLogsService.getResources(ROLES.ADMIN);

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ resource: { not: 'backup' } });
    expect(result).toEqual(['personnel', 'proposal']);
  });

  it('Cho role SUPER_ADMIN → Khi getResources → Thì where rỗng (xem tất cả)', async () => {
    prismaMock.systemLog.findMany.mockResolvedValueOnce([
      { resource: 'backup' },
      { resource: 'personnel' },
    ]);

    const result = await systemLogsService.getResources(ROLES.SUPER_ADMIN);

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({});
    expect(result).toEqual(['backup', 'personnel']);
  });
});

describe('systemLogs.service - deleteLogs / deleteAllLogs', () => {
  it('Cho danh sách id → Khi deleteLogs → Thì gọi deleteMany với filter id in', async () => {
    prismaMock.systemLog.deleteMany.mockResolvedValueOnce({ count: 3 });

    const result = await systemLogsService.deleteLogs(['l1', 'l2', 'l3']);

    expect(prismaMock.systemLog.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['l1', 'l2', 'l3'] } },
    });
    expect(result).toBe(3);
  });

  it('Cho deleteAllLogs → Khi gọi → Thì xoá hết và viết audit log mới với action DELETE', async () => {
    prismaMock.systemLog.count.mockResolvedValueOnce(42);
    prismaMock.systemLog.deleteMany.mockResolvedValueOnce({ count: 42 });
    prismaMock.systemLog.create.mockResolvedValueOnce({ id: 'audit-1' });

    const count = await systemLogsService.deleteAllLogs('user-1', ROLES.SUPER_ADMIN);

    expect(count).toBe(42);
    const createArgs = prismaMock.systemLog.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      nguoi_thuc_hien_id: 'user-1',
      actor_role: ROLES.SUPER_ADMIN,
      action: AUDIT_ACTIONS.DELETE,
      resource: 'system-logs',
    });
    expect(createArgs.data.description).toContain('42');
  });
});
