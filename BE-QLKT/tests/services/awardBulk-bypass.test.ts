/**
 * Bulk awards bypass flag — SUPER_ADMIN data-correction path skips personnel eligibility.
 * Pin the contract: bypassEligibility=true must NOT call validatePersonnelConditions,
 * but other checks (duplicates) still run.
 */

import { prismaMock } from '../helpers/prismaMock';

jest.mock('../../src/helpers/notification', () => ({
  ...jest.requireActual('../../src/helpers/notification'),
  notifyOnBulkAwardAdded: jest.fn().mockResolvedValue(0),
  notifyAdminsOnBulkBypass: jest.fn().mockResolvedValue(0),
}));

jest.mock('../../src/services/awardBulk/handlers', () => ({
  ...jest.requireActual('../../src/services/awardBulk/handlers'),
  CREATE_HANDLERS: new Proxy(
    {},
    {
      get: () => async () => undefined,
    }
  ),
}));

import awardBulkService from '../../src/services/awardBulk.service';
import * as notificationHelper from '../../src/helpers/notification';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_HCCSVV } from '../../src/constants/danhHieu.constants';

beforeEach(() => {
  prismaMock.danhHieuHangNam.findMany.mockResolvedValue([]);
  prismaMock.bangDeXuat.findMany.mockResolvedValue([]);
  prismaMock.quanNhan.findMany.mockResolvedValue([]);
  prismaMock.quanNhan.findUnique.mockResolvedValue(null);
  // Bypass duplicate check so the eligibility-validation branch is reachable
  jest.spyOn(awardBulkService, 'checkDuplicateAwards').mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Trao hàng loạt — lách kiểm tra giao diện: cờ bỏ qua xét điều kiện quân nhân', () => {
  it('Trao hàng loạt — lách kiểm tra giao diện: bật cờ bỏ qua xét điều kiện → không gọi bước kiểm tra điều kiện quân nhân', async () => {
    const spy = jest
      .spyOn(awardBulkService, 'validatePersonnelConditions')
      .mockResolvedValue([]);

    try {
      await awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: ['qn-1'],
        titleData: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }],
        adminId: 'admin-1',
        bypassEligibility: true,
      });
    } catch {
      // Handler may fail with mocks — we only care about the validation call
    }

    expect(spy).not.toHaveBeenCalled();
  });

  it('Trao hàng loạt — lách kiểm tra giao diện: tắt cờ bỏ qua xét điều kiện → vẫn kiểm tra điều kiện quân nhân với đúng tham số', async () => {
    const spy = jest
      .spyOn(awardBulkService, 'validatePersonnelConditions')
      .mockResolvedValue([]);

    try {
      await awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: ['qn-1'],
        titleData: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }],
        adminId: 'admin-1',
        bypassEligibility: false,
      });
    } catch {
      // Handler may fail with mocks — we only care about the validation call
    }

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(PROPOSAL_TYPES.NIEN_HAN, ['qn-1']);
  });

  it('Trao hàng loạt — lách kiểm tra giao diện: không truyền cờ (mặc định) → vẫn kiểm tra điều kiện quân nhân', async () => {
    const spy = jest
      .spyOn(awardBulkService, 'validatePersonnelConditions')
      .mockResolvedValue([]);

    try {
      await awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: ['qn-1'],
        titleData: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }],
        adminId: 'admin-1',
      });
    } catch {
      // Handler may fail with mocks — we only care about the validation call
    }

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Trao hàng loạt — lách kiểm tra giao diện: dù bỏ qua xét điều kiện, vẫn kiểm tra trùng khen thưởng (giữ toàn vẹn dữ liệu)', async () => {
    // beforeEach already spied on checkDuplicateAwards
    const dupSpy = awardBulkService.checkDuplicateAwards as unknown as jest.Mock;
    dupSpy.mockClear();

    try {
      await awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: ['qn-1'],
        titleData: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }],
        adminId: 'admin-1',
        bypassEligibility: true,
      });
    } catch {
      // ignore — only asserting the spy
    }

    expect(dupSpy).toHaveBeenCalledTimes(1);
  });

  it('Trao hàng loạt — lách kiểm tra giao diện: SUPER_ADMIN bỏ qua xét điều kiện → gửi thông báo cho các ADMIN để minh bạch', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValue({ id: 'sa-1', username: 'sa_admin' });
    const notifyMock = notificationHelper.notifyAdminsOnBulkBypass as jest.Mock;
    notifyMock.mockClear();

    try {
      await awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: ['qn-1'],
        titleData: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }],
        adminId: 'sa-1',
        bypassEligibility: true,
      });
    } catch {
      // handler may fail with mocks — only asserting the notify call
    }
    // Notification is fire-and-forget (background IIFE) — flush microtasks before asserting.
    await new Promise(resolve => setImmediate(resolve));

    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it('Trao hàng loạt — lách kiểm tra giao diện: admin trao bình thường (không bỏ qua xét điều kiện) → không gửi thông báo cho ADMIN', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValue({ id: 'admin-1', username: 'admin' });
    const notifyMock = notificationHelper.notifyAdminsOnBulkBypass as jest.Mock;
    notifyMock.mockClear();

    try {
      await awardBulkService.bulkCreateAwards({
        type: PROPOSAL_TYPES.NIEN_HAN,
        nam: 2024,
        thang: 6,
        selectedPersonnel: ['qn-1'],
        titleData: [{ personnel_id: 'qn-1', danh_hieu: DANH_HIEU_HCCSVV.HANG_BA }],
        adminId: 'admin-1',
        bypassEligibility: false,
      });
    } catch {
      // ignore
    }
    await new Promise(resolve => setImmediate(resolve));

    expect(notifyMock).not.toHaveBeenCalled();
  });
});
