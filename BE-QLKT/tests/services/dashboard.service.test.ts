import { prismaMock } from '../helpers/prismaMock';

import dashboardService from '../../src/services/dashboard.service';
import { ROLES } from '../../src/constants/roles.constants';
import { PROPOSAL_STATUS } from '../../src/constants/proposalStatus.constants';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../src/constants/danhHieu.constants';

describe('dashboard.service - getStatistics (SUPER_ADMIN)', () => {
  it('Cho role SUPER_ADMIN → Khi getStatistics → Thì tổng hợp count account, personnel, units, logs', async () => {
    prismaMock.taiKhoan.groupBy.mockResolvedValueOnce([
      { role: ROLES.ADMIN, _count: { id: 2 } },
      { role: ROLES.MANAGER, _count: { id: 5 } },
    ]);
    prismaMock.systemLog.findMany.mockResolvedValueOnce([]);
    prismaMock.systemLog.groupBy.mockResolvedValueOnce([
      { action: 'CREATE', _count: { id: 12 } },
    ]);
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(20);
    prismaMock.quanNhan.count.mockResolvedValueOnce(150);
    prismaMock.coQuanDonVi.count.mockResolvedValueOnce(3);
    prismaMock.donViTrucThuoc.count.mockResolvedValueOnce(7);
    prismaMock.systemLog.count.mockResolvedValueOnce(500);

    const result = await dashboardService.getStatistics();

    expect(result.totalAccounts).toBe(20);
    expect(result.totalPersonnel).toBe(150);
    expect(result.totalUnits).toBe(10);
    expect(result.totalLogs).toBe(500);
    expect(result.roleDistribution).toEqual([
      { role: ROLES.ADMIN, count: 2 },
      { role: ROLES.MANAGER, count: 5 },
    ]);
    expect(result.dailyActivity).toHaveLength(7);
    expect(result.newAccountsByDate).toHaveLength(30);
  });
});

describe('dashboard.service - getAdminStatistics', () => {
  it('Cho role ADMIN → Khi getAdminStatistics → Thì gom proposal/scientific theo type và status', async () => {
    prismaMock.thanhTichKhoaHoc.groupBy.mockResolvedValueOnce([
      { loai: 'BAI_BAO', _count: { id: 4 } },
    ]);
    prismaMock.bangDeXuat.groupBy
      .mockResolvedValueOnce([{ loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM, _count: { id: 3 } }])
      .mockResolvedValueOnce([{ status: PROPOSAL_STATUS.PENDING, _count: { id: 5 } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.count.mockResolvedValueOnce(100);
    prismaMock.donViTrucThuoc.count.mockResolvedValueOnce(8);
    prismaMock.chucVu.count.mockResolvedValueOnce(15);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(5);

    const result = await dashboardService.getAdminStatistics();

    expect(result.totalPersonnel).toBe(100);
    expect(result.totalUnits).toBe(8);
    expect(result.totalPositions).toBe(15);
    expect(result.pendingApprovals).toBe(5);
    expect(result.proposalsByStatus).toEqual([
      { status: PROPOSAL_STATUS.PENDING, count: 5 },
    ]);
    expect(result.scientificAchievementsByMonth).toHaveLength(6);
  });

  it('Cho count proposal pending → Khi gọi count → Thì truyền filter status=PENDING', async () => {
    prismaMock.thanhTichKhoaHoc.groupBy.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.quanNhan.count.mockResolvedValueOnce(0);
    prismaMock.donViTrucThuoc.count.mockResolvedValueOnce(0);
    prismaMock.chucVu.count.mockResolvedValueOnce(0);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(0);

    await dashboardService.getAdminStatistics();

    expect(prismaMock.bangDeXuat.count).toHaveBeenCalledWith({
      where: { status: PROPOSAL_STATUS.PENDING },
    });
  });
});

describe('dashboard.service - getManagerStatistics', () => {
  it('Cho manager không có quân nhân → Khi getManagerStatistics → Thì trả empty stats', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ quan_nhan_id: null });

    const result = await dashboardService.getManagerStatistics('user-1', undefined);

    expect(result.awardsByType).toEqual([]);
    expect(result.proposalsByType).toEqual([]);
    expect(result.personnelByPosition).toEqual([]);
  });

  it('Cho manager có don_vi_truc_thuoc → Khi getManagerStatistics → Thì query chỉ DVTT, ưu tiên DVTT trước CQDV', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      don_vi_truc_thuoc_id: 'dvtt-1',
      co_quan_don_vi_id: 'cqdv-1',
    });
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: 'qn-1' }, { id: 'qn-2' }]);
    prismaMock.danhHieuHangNam.findMany
      .mockResolvedValueOnce([
        { danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT },
        { danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT },
        { danh_hieu: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS },
      ])
      .mockResolvedValueOnce([]);
    prismaMock.quanNhan.groupBy.mockResolvedValueOnce([
      { cap_bac: 'Thiếu tá', _count: { id: 2 } },
    ]);
    prismaMock.bangDeXuat.groupBy
      .mockResolvedValueOnce([{ status: PROPOSAL_STATUS.PENDING, _count: { id: 1 } }])
      .mockResolvedValueOnce([{ loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM, _count: { id: 1 } }]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.thanhTichKhoaHoc.groupBy.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ chuc_vu_id: 'cv-1' }, { chuc_vu_id: 'cv-1' }]);
    prismaMock.chucVu.findMany.mockResolvedValueOnce([{ id: 'cv-1', ten_chuc_vu: 'Trợ lý' }]);

    const result = (await dashboardService.getManagerStatistics('user-1', 'qn-mgr')) as any;

    expect(result.totalPersonnel).toBe(2);
    expect(result.awardsByType).toEqual(
      expect.arrayContaining([
        { type: DANH_HIEU_CA_NHAN_HANG_NAM.CSTT, count: 2 },
        { type: DANH_HIEU_CA_NHAN_HANG_NAM.CSTDCS, count: 1 },
      ])
    );
    expect(result.personnelByPosition).toEqual([
      { positionId: 'cv-1', positionName: 'Trợ lý', count: 2 },
    ]);
    expect(result.personnelByRank).toEqual([{ rank: 'Thiếu tá', count: 2 }]);
  });

  it('Cho manager chỉ có CQDV (không DVTT) → Khi getManagerStatistics → Thì gom cả con DVTT', async () => {
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      don_vi_truc_thuoc_id: null,
      co_quan_don_vi_id: 'cqdv-1',
    });
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([{ id: 'dvtt-a' }, { id: 'dvtt-b' }]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([{ id: 'qn-1' }]);
    prismaMock.danhHieuHangNam.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.quanNhan.groupBy.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.thanhTichKhoaHoc.findMany.mockResolvedValueOnce([]);
    prismaMock.thanhTichKhoaHoc.groupBy.mockResolvedValueOnce([]);
    prismaMock.quanNhan.findMany.mockResolvedValueOnce([]);
    prismaMock.chucVu.findMany.mockResolvedValueOnce([]);

    const result = (await dashboardService.getManagerStatistics('user-1', 'qn-mgr')) as any;

    expect(prismaMock.donViTrucThuoc.findMany).toHaveBeenCalledWith({
      where: { co_quan_don_vi_id: 'cqdv-1' },
      select: { id: true },
    });
    expect(result.totalPersonnel).toBe(1);
  });
});
