import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { ROLES } from '../../src/constants/roles.constants';
import { ADHOC_TYPE } from '../../src/constants/adhocType.constants';
import { NOTIFICATION_TYPES, RESOURCE_TYPES } from '../../src/constants/notificationTypes.constants';

jest.mock('../../src/utils/socketService', () => ({
  emitNotificationToUser: jest.fn(),
  emitToUser: jest.fn(),
  initSocket: jest.fn(),
}));

import notificationService from '../../src/services/notification.service';
import adhocAwardService from '../../src/services/adhocAward.service';
import { emitNotificationToUser } from '../../src/utils/socketService';

beforeEach(() => {
  resetPrismaMock();
  (emitNotificationToUser as jest.Mock).mockReset();
});

interface NotificationFixtureInput {
  recipientId?: string;
  type?: string;
  title?: string;
  message?: string;
  resource?: string;
  resourceId?: string | null;
}

function NOTIFICATION_makeData(input: NotificationFixtureInput = {}) {
  return {
    recipient_id: input.recipientId ?? 'acc-recipient',
    recipient_role: ROLES.MANAGER,
    type: input.type ?? NOTIFICATION_TYPES.PROPOSAL_APPROVED,
    title: input.title ?? 'Đề xuất đã được phê duyệt',
    message: input.message ?? 'Đề xuất của bạn đã được phê duyệt',
    resource: input.resource ?? RESOURCE_TYPES.PROPOSALS,
    resource_id: input.resourceId ?? 'p-1',
    link: '/manager/proposals/p-1',
  };
}

function NOTIFICATION_makeStoredRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'noti-1',
    nguoi_nhan_id: 'acc-recipient',
    recipient_role: ROLES.MANAGER,
    type: NOTIFICATION_TYPES.PROPOSAL_APPROVED,
    title: 'Đề xuất đã được phê duyệt',
    message: 'Đề xuất của bạn đã được phê duyệt',
    resource: RESOURCE_TYPES.PROPOSALS,
    tai_nguyen_id: 'p-1',
    link: '/manager/proposals/p-1',
    is_read: false,
    readAt: null,
    createdAt: new Date(),
    nhat_ky_he_thong_id: null,
    ...overrides,
  };
}

describe('notification.service - createNotification', () => {
  it('Tạo record DB với recipient + emit socket cho recipient', async () => {
    // Cho
    prismaMock.thongBao.create.mockResolvedValueOnce(NOTIFICATION_makeStoredRecord());

    // Khi
    const result = await notificationService.createNotification(NOTIFICATION_makeData());

    // Thì
    expect(prismaMock.thongBao.create).toHaveBeenCalledTimes(1);
    const createArgs = prismaMock.thongBao.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArgs.data.nguoi_nhan_id).toBe('acc-recipient');
    expect(createArgs.data.tai_nguyen_id).toBe('p-1');
    expect(createArgs.data.type).toBe(NOTIFICATION_TYPES.PROPOSAL_APPROVED);
    expect(emitNotificationToUser).toHaveBeenCalledTimes(1);
    expect(emitNotificationToUser).toHaveBeenCalledWith('acc-recipient', expect.objectContaining({ id: 'noti-1' }));
    expect(result.id).toBe('noti-1');
  });

  it('Recipient_id null → tạo record nhưng không emit socket', async () => {
    // Cho
    prismaMock.thongBao.create.mockResolvedValueOnce(
      NOTIFICATION_makeStoredRecord({ nguoi_nhan_id: null })
    );

    // Khi
    await notificationService.createNotification({
      ...NOTIFICATION_makeData(),
      recipient_id: null,
    });

    // Thì
    expect(prismaMock.thongBao.create).toHaveBeenCalledTimes(1);
    expect(emitNotificationToUser).not.toHaveBeenCalled();
  });

  it('Socket emit thực thi sau khi DB create thành công (thứ tự call)', async () => {
    // Cho
    const callOrder: string[] = [];
    prismaMock.thongBao.create.mockImplementationOnce(async () => {
      callOrder.push('db.create');
      return NOTIFICATION_makeStoredRecord();
    });
    (emitNotificationToUser as jest.Mock).mockImplementation(() => {
      callOrder.push('socket.emit');
    });

    // Khi
    await notificationService.createNotification(NOTIFICATION_makeData());

    // Thì
    expect(callOrder).toEqual(['db.create', 'socket.emit']);
  });
});

describe('notification.service - getNotificationsByUserId', () => {
  it('Filter theo recipient userId + trả pagination', async () => {
    // Cho
    const records = [NOTIFICATION_makeStoredRecord()];
    prismaMock.thongBao.findMany.mockResolvedValueOnce(records);
    prismaMock.thongBao.count.mockResolvedValueOnce(1);

    // Khi
    const result = await notificationService.getNotificationsByUserId('acc-recipient', {
      page: 1,
      limit: 20,
    });

    // Thì
    const findManyCall = prismaMock.thongBao.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toEqual({ nguoi_nhan_id: 'acc-recipient' });
    expect(result.notifications).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('Filter isRead=false → chỉ lấy unread', async () => {
    // Cho
    prismaMock.thongBao.findMany.mockResolvedValueOnce([]);
    prismaMock.thongBao.count.mockResolvedValueOnce(0);

    // Khi
    await notificationService.getNotificationsByUserId('acc-recipient', { isRead: false });

    // Thì
    const findManyCall = prismaMock.thongBao.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toEqual({
      nguoi_nhan_id: 'acc-recipient',
      is_read: false,
    });
  });
});

describe('notification dispatch - adhoc award create', () => {
  it('Tạo adhoc cá nhân → notify managers của CQDV + tài khoản personnel với resource AWARDS', async () => {
    // Given: admin valid; personnel có CQDV; 1 manager + 1 account của personnel
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-admin',
      username: 'admin_x',
      role: ROLES.ADMIN,
    });
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      id: 'qn-1',
      ho_ten: 'Lê Văn N',
      co_quan_don_vi_id: 'cqdv-X',
      don_vi_truc_thuoc_id: null,
    });
    prismaMock.khenThuongDotXuat.create.mockResolvedValueOnce({
      id: 'adh-99',
      doi_tuong: ADHOC_TYPE.CA_NHAN,
      hinh_thuc_khen_thuong: 'Khen thưởng đột xuất A',
      nam: 2024,
      QuanNhan: {
        id: 'qn-1',
        ho_ten: 'Lê Văn N',
        co_quan_don_vi_id: 'cqdv-X',
        don_vi_truc_thuoc_id: null,
        DonViTrucThuoc: null,
      },
    });
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([
      { id: 'acc-mgr-1', role: ROLES.MANAGER },
    ]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce({
      id: 'acc-user-personnel',
      role: ROLES.USER,
    });

    // Khi
    await adhocAwardService.createAdhocAward({
      adminId: 'acc-admin',
      type: ADHOC_TYPE.CA_NHAN,
      year: 2024,
      awardForm: 'Khen thưởng đột xuất A',
      personnelId: 'qn-1',
    });

    // Thì
    expect(prismaMock.thongBao.createMany).toHaveBeenCalledTimes(1);
    const createManyArg = prismaMock.thongBao.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(createManyArg.data).toHaveLength(2);
    const recipientIds = createManyArg.data.map(d => d.nguoi_nhan_id);
    expect(recipientIds).toEqual(expect.arrayContaining(['acc-mgr-1', 'acc-user-personnel']));
    createManyArg.data.forEach(d => {
      expect(d.resource).toBe(RESOURCE_TYPES.AWARDS);
      expect(d.type).toBe(NOTIFICATION_TYPES.AWARD_ADDED);
      expect(d.tai_nguyen_id).toBe('adh-99');
    });
    expect(emitNotificationToUser).toHaveBeenCalledTimes(2);
  });

  it('Adhoc tập thể (CQDV) → notify managers của CQDV với type AWARD_ADDED', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-admin',
      username: 'admin_x',
      role: ROLES.ADMIN,
    });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({
      id: 'cqdv-Y',
      ten_don_vi: 'CQDV-Y',
    });
    prismaMock.khenThuongDotXuat.create.mockResolvedValueOnce({
      id: 'adh-tt-1',
      doi_tuong: ADHOC_TYPE.TAP_THE,
      hinh_thuc_khen_thuong: 'Khen thưởng đơn vị',
      nam: 2024,
      co_quan_don_vi_id: 'cqdv-Y',
      CoQuanDonVi: { id: 'cqdv-Y', ten_don_vi: 'CQDV-Y' },
      DonViTrucThuoc: null,
      QuanNhan: null,
    });
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([
      { id: 'acc-mgr-A', role: ROLES.MANAGER },
      { id: 'acc-mgr-B', role: ROLES.MANAGER },
    ]);

    // Khi
    await adhocAwardService.createAdhocAward({
      adminId: 'acc-admin',
      type: ADHOC_TYPE.TAP_THE,
      year: 2024,
      awardForm: 'Khen thưởng đơn vị',
      unitId: 'cqdv-Y',
      unitType: 'CO_QUAN_DON_VI',
    });

    // Thì
    expect(prismaMock.thongBao.createMany).toHaveBeenCalledTimes(1);
    const args = prismaMock.thongBao.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(args.data).toHaveLength(2);
    expect(args.data.map(d => d.nguoi_nhan_id)).toEqual(['acc-mgr-A', 'acc-mgr-B']);
    args.data.forEach(d => {
      expect(d.title).toBe('Đơn vị được khen thưởng đột xuất');
      expect(d.type).toBe(NOTIFICATION_TYPES.AWARD_ADDED);
    });
  });
});
