import type { Request } from 'express';
import { prismaMock } from '../helpers/prismaMock';
import { makeUnit, makePersonnel } from '../helpers/fixtures';
import { ROLES } from '../../src/constants/roles.constants';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';
import {
  buildManagerQuanNhanFilter,
  getManagerUnitContext,
} from '../../src/helpers/controllerHelper';
import { getProposals, getProposalById } from '../../src/services/proposal/core';
import {
  PROPOSAL_NOT_FOUND_ERROR,
} from '../helpers/errorMessages';

interface ManagerAccountFixture {
  accountId: string;
  quanNhanId: string;
  coQuanDonViId: string | null;
  donViTrucThuocId: string | null;
}

function AUTHZ_makeManagerAccount(overrides: Partial<ManagerAccountFixture> = {}): ManagerAccountFixture {
  return {
    accountId: overrides.accountId ?? 'acc-mgr-1',
    quanNhanId: overrides.quanNhanId ?? 'qn-mgr-1',
    coQuanDonViId: overrides.coQuanDonViId ?? null,
    donViTrucThuocId: overrides.donViTrucThuocId ?? null,
  };
}

function AUTHZ_makeRequest(role: string, quanNhanId: string | null = 'qn-mgr-1'): Request {
  return {
    user: {
      id: 'acc-1',
      username: 'manager_user',
      role,
      quan_nhan_id: quanNhanId,
    },
  } as unknown as Request;
}

describe('authz/manager-scope - getProposals filter theo role', () => {
  it('MANAGER thuộc CQDV → where chỉ chứa co_quan_don_vi_id', async () => {
    // Cho trước
    const cqdv = makeUnit({ kind: 'CQDV', id: 'cqdv-mgr' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      QuanNhan: {
        id: 'qn-mgr',
        co_quan_don_vi_id: cqdv.id,
        don_vi_truc_thuoc_id: null,
        CoQuanDonVi: cqdv.CoQuanDonVi,
        DonViTrucThuoc: null,
      },
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(0);

    // Khi
    await getProposals('acc-1', ROLES.MANAGER, 1, 10);

    // Kết quả
    const findManyCall = prismaMock.bangDeXuat.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toEqual({ co_quan_don_vi_id: cqdv.id });
  });

  it('MANAGER thuộc DVTT (không có CQDV) → where chỉ chứa don_vi_truc_thuoc_id', async () => {
    // Cho trước
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-mgr' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      QuanNhan: {
        id: 'qn-mgr',
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: dvtt.id,
        CoQuanDonVi: null,
        DonViTrucThuoc: dvtt.DonViTrucThuoc,
      },
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(0);

    // Khi
    await getProposals('acc-1', ROLES.MANAGER, 1, 10);

    // Kết quả
    const findManyCall = prismaMock.bangDeXuat.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toEqual({ don_vi_truc_thuoc_id: dvtt.id });
    expect(findManyCall.where.co_quan_don_vi_id).toBeUndefined();
  });

  it('MANAGER thuộc DVTT — getProposals KHÔNG include CQDV cha (filter chỉ DVTT trực tiếp)', async () => {
    // Cho trước: Manager DVTT — core service không mở rộng filter sang CQDV cha
    const dvtt = makeUnit({ kind: 'DVTT', id: 'dvtt-mgr-2' });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      QuanNhan: {
        id: 'qn-mgr',
        co_quan_don_vi_id: null,
        don_vi_truc_thuoc_id: dvtt.id,
        CoQuanDonVi: null,
        DonViTrucThuoc: dvtt.DonViTrucThuoc,
      },
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(0);

    // Khi
    await getProposals('acc-1', ROLES.MANAGER, 1, 10);

    // Kết quả
    const findManyCall = prismaMock.bangDeXuat.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).not.toHaveProperty('OR');
    expect(findManyCall.where).not.toHaveProperty('co_quan_don_vi_id');
  });

  it('ADMIN → where rỗng (xem tất cả)', async () => {
    // Cho trước
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(0);

    // Khi
    await getProposals('acc-admin', ROLES.ADMIN, 1, 10);

    // Kết quả
    const findManyCall = prismaMock.bangDeXuat.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toEqual({});
    expect(prismaMock.taiKhoan.findUnique).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN → where rỗng (xem tất cả)', async () => {
    // Cho trước
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([]);
    prismaMock.bangDeXuat.count.mockResolvedValueOnce(0);

    // Khi
    await getProposals('acc-super', ROLES.SUPER_ADMIN, 1, 10);

    // Kết quả
    const findManyCall = prismaMock.bangDeXuat.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(findManyCall.where).toEqual({});
  });
});

describe('authz/manager-scope - getProposalById visibility', () => {
  it('MANAGER xem proposal đơn vị khác → ForbiddenError "Bạn không có quyền xem đề xuất này"', async () => {
    // Cho trước: proposal thuộc CQDV-A, manager thuộc CQDV-B
    const cqdvA = 'cqdv-A';
    const cqdvB = 'cqdv-B';
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce({
      id: 'p-1',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: 'PENDING',
      nam: 2024,
      thang: null,
      data_danh_hieu: [],
      data_thanh_tich: [],
      data_nien_han: [],
      data_cong_hien: [],
      files_attached: [],
      ghi_chu: null,
      rejection_reason: null,
      ngay_duyet: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      co_quan_don_vi_id: cqdvA,
      don_vi_truc_thuoc_id: null,
      CoQuanDonVi: { id: cqdvA, ten_don_vi: 'A', ma_don_vi: 'A' },
      DonViTrucThuoc: null,
      NguoiDeXuat: { id: 'acc-other', username: 'other', QuanNhan: null },
      NguoiDuyet: null,
    });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-mgr',
      QuanNhan: {
        id: 'qn-mgr',
        co_quan_don_vi_id: cqdvB,
        don_vi_truc_thuoc_id: null,
        CoQuanDonVi: { id: cqdvB, ten_don_vi: 'B', ma_don_vi: 'B' },
        DonViTrucThuoc: null,
      },
    });

    // Khi / Kết quả
    await expect(getProposalById('p-1', 'acc-mgr', ROLES.MANAGER)).rejects.toThrow(
      'Bạn không có quyền xem đề xuất này'
    );
  });

  it('MANAGER xem proposal cùng đơn vị → trả về detail', async () => {
    // Cho trước
    const cqdv = 'cqdv-shared';
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce({
      id: 'p-2',
      loai_de_xuat: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
      status: 'PENDING',
      nam: 2024,
      thang: null,
      data_danh_hieu: [],
      data_thanh_tich: [],
      data_nien_han: [],
      data_cong_hien: [],
      files_attached: [],
      ghi_chu: null,
      rejection_reason: null,
      ngay_duyet: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      co_quan_don_vi_id: cqdv,
      don_vi_truc_thuoc_id: null,
      CoQuanDonVi: { id: cqdv, ten_don_vi: 'Shared', ma_don_vi: 'SH' },
      DonViTrucThuoc: null,
      NguoiDeXuat: { id: 'acc-mgr', username: 'mgr', QuanNhan: { ho_ten: 'MGR' } },
      NguoiDuyet: null,
    });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-mgr',
      QuanNhan: {
        id: 'qn-mgr',
        co_quan_don_vi_id: cqdv,
        don_vi_truc_thuoc_id: null,
        CoQuanDonVi: { id: cqdv, ten_don_vi: 'Shared', ma_don_vi: 'SH' },
        DonViTrucThuoc: null,
      },
    });

    // Khi
    const result = await getProposalById('p-2', 'acc-mgr', ROLES.MANAGER);

    // Kết quả
    expect(result.id).toBe('p-2');
    expect(result.don_vi.id).toBe(cqdv);
  });

  it('Proposal không tồn tại → NotFoundError', async () => {
    // Cho trước
    prismaMock.bangDeXuat.findUnique.mockResolvedValueOnce(null);

    // Khi / Kết quả
    await expect(getProposalById('p-x', 'acc-mgr', ROLES.MANAGER)).rejects.toThrow(
      PROPOSAL_NOT_FOUND_ERROR
    );
  });
});

describe('authz/manager-scope - buildManagerQuanNhanFilter', () => {
  it('Manager CQDV với DVTT con → trả filter OR (CQDV + danh sách DVTT)', async () => {
    // Cho trước
    const cqdvId = 'cqdv-A';
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      co_quan_don_vi_id: cqdvId,
      don_vi_truc_thuoc_id: null,
    });
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([
      { id: 'dvtt-1' },
      { id: 'dvtt-2' },
    ]);

    // Khi
    const filter = await buildManagerQuanNhanFilter(AUTHZ_makeRequest(ROLES.MANAGER));

    // Kết quả
    expect(filter).toEqual({
      OR: [
        { co_quan_don_vi_id: cqdvId },
        { don_vi_truc_thuoc_id: { in: ['dvtt-1', 'dvtt-2'] } },
      ],
    });
  });

  it('Non-manager (ADMIN) → null (không áp filter)', async () => {
    // Khi
    const filter = await buildManagerQuanNhanFilter(AUTHZ_makeRequest(ROLES.ADMIN, null));

    // Kết quả
    expect(filter).toBeNull();
    expect(prismaMock.quanNhan.findUnique).not.toHaveBeenCalled();
  });

  it('Manager nhưng QuanNhan không có cả CQDV lẫn DVTT → null (no scope)', async () => {
    // Cho trước
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      co_quan_don_vi_id: null,
      don_vi_truc_thuoc_id: null,
    });

    // Khi
    const filter = await buildManagerQuanNhanFilter(AUTHZ_makeRequest(ROLES.MANAGER));

    // Kết quả
    expect(filter).toBeNull();
  });
});

describe('authz/manager-scope - touchpoint sanity', () => {
  it('AUTHZ_makeManagerAccount builder default values', () => {
    // Cho trước / Khi
    const acc = AUTHZ_makeManagerAccount({ coQuanDonViId: 'cqdv-x' });
    // Kết quả
    expect(acc.accountId).toBe('acc-mgr-1');
    expect(acc.coQuanDonViId).toBe('cqdv-x');
  });

  it('getManagerUnitContext (CQDV) trả về include_sub_units=true + sub_unit_ids', async () => {
    // Cho trước
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce({
      co_quan_don_vi_id: 'cqdv-9',
      don_vi_truc_thuoc_id: null,
    });
    prismaMock.donViTrucThuoc.findMany.mockResolvedValueOnce([{ id: 'dvtt-99' }]);

    // Khi
    const ctx = await getManagerUnitContext(AUTHZ_makeRequest(ROLES.MANAGER));

    // Kết quả
    expect(ctx).toEqual({
      don_vi_id: 'cqdv-9',
      include_sub_units: true,
      sub_unit_ids: ['dvtt-99'],
    });
  });
});
