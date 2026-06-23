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

describe('Nhật ký hệ thống: quyền xem nhật ký theo vai trò', () => {
  beforeEach(() => {
    mockIsFeatureEnabled.mockResolvedValue(false);
  });

  it('Nhật ký hệ thống: vai trò không đủ quyền (USER) → không trả dữ liệu', async () => {
    const result = await systemLogsService.getLogs({
      ...PARAMS_BASE,
      userRole: ROLES.USER,
    });

    expect(result).toBeNull();
  });

  it('Nhật ký hệ thống: ADMIN xem nhật ký → ẩn nhật ký sao lưu (backup) và chỉ thấy nhật ký từ vai trò ngang/thấp hơn', async () => {
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({ ...PARAMS_BASE, userRole: ROLES.ADMIN });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.resource).toEqual({ not: 'backup' });
    expect(args.where.actor_role).toEqual({
      in: [ROLES.USER, ROLES.MANAGER, ROLES.ADMIN, 'SYSTEM'],
    });
  });

  it('Nhật ký hệ thống: ADMIN cố lọc đúng nhật ký sao lưu (backup) → trả rỗng ngay, không truy vấn', async () => {
    const result = await systemLogsService.getLogs({
      ...PARAMS_BASE,
      resource: 'backup',
      userRole: ROLES.ADMIN,
    });

    expect(result).toEqual({ logs: [], total: 0, stats: { create: 0, delete: 0, update: 0 } });
    expect(prismaMock.systemLog.findMany).not.toHaveBeenCalled();
  });

  it('Nhật ký hệ thống: chỉ SUPER_ADMIN mới được xem nhật ký sao lưu (backup)', async () => {
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({
      ...PARAMS_BASE,
      resource: 'backup',
      userRole: ROLES.SUPER_ADMIN,
    });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.resource).toBe('backup');
  });

  it('Nhật ký hệ thống: tính năng xem lỗi đang tắt → ẩn các bản ghi loại ERROR', async () => {
    mockIsFeatureEnabled.mockResolvedValue(false);
    arrangeLogQueries([], 0);

    await systemLogsService.getLogs({ ...PARAMS_BASE, userRole: ROLES.SUPER_ADMIN });

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where.action).toEqual({ not: 'ERROR' });
  });

  it('Nhật ký hệ thống: lọc theo khoảng ngày (từ ngày - đến ngày) → chỉ lấy bản ghi trong khoảng đó', async () => {
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

describe('Nhật ký hệ thống: danh sách loại tài nguyên để lọc', () => {
  it('Nhật ký hệ thống: ADMIN lấy danh sách loại tài nguyên → loại bỏ tài nguyên sao lưu (backup)', async () => {
    prismaMock.systemLog.findMany.mockResolvedValueOnce([
      { resource: 'personnel' },
      { resource: 'proposal' },
    ]);

    const result = await systemLogsService.getResources(ROLES.ADMIN);

    const args = prismaMock.systemLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ resource: { not: 'backup' } });
    expect(result).toEqual(['personnel', 'proposal']);
  });

  it('Nhật ký hệ thống: SUPER_ADMIN lấy danh sách loại tài nguyên → thấy tất cả, kể cả sao lưu (backup)', async () => {
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

describe('Nhật ký hệ thống: xóa nhật ký', () => {
  it('Nhật ký hệ thống: xóa theo danh sách được chọn → chỉ xóa đúng các bản ghi đó', async () => {
    prismaMock.systemLog.deleteMany.mockResolvedValueOnce({ count: 3 });

    const result = await systemLogsService.deleteLogs(['l1', 'l2', 'l3']);

    expect(prismaMock.systemLog.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['l1', 'l2', 'l3'] } },
    });
    expect(result).toBe(3);
  });

  it('Nhật ký hệ thống: xóa toàn bộ nhật ký → xóa hết rồi ghi lại một bản ghi xóa (DELETE) để truy vết', async () => {
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
