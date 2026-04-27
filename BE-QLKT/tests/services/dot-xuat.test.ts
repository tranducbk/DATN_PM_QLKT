import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { ROLES } from '../../src/constants/roles.constants';
import { ADHOC_TYPE } from '../../src/constants/adhocType.constants';

jest.mock('../../src/utils/socketService', () => ({
  emitNotificationToUser: jest.fn(),
  emitToUser: jest.fn(),
  initSocket: jest.fn(),
}));

import adhocAwardService from '../../src/services/adhocAward.service';
import { emitNotificationToUser } from '../../src/utils/socketService';

beforeEach(() => {
  resetPrismaMock();
  (emitNotificationToUser as jest.Mock).mockReset();
});

interface DotXuatPersonnelInput {
  personnelId?: string;
  hoTen?: string;
  coQuanDonViId?: string | null;
  donViTrucThuocId?: string | null;
}

function DOT_XUAT_makePersonnelRecord(input: DotXuatPersonnelInput = {}) {
  return {
    id: input.personnelId ?? 'qn-dx-1',
    ho_ten: input.hoTen ?? 'Nguyễn Văn DX',
    co_quan_don_vi_id: input.coQuanDonViId ?? 'cqdv-dx-1',
    don_vi_truc_thuoc_id: input.donViTrucThuocId ?? null,
  };
}

function DOT_XUAT_makeAdminAccount(id: string = 'acc-admin-dx') {
  return {
    id,
    username: 'admin_dx',
    role: ROLES.ADMIN,
  };
}

function DOT_XUAT_makeAdhocRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'adh-1',
    loai: 'KHEN_THUONG_DOT_XUAT',
    doi_tuong: ADHOC_TYPE.CA_NHAN,
    quan_nhan_id: 'qn-dx-1',
    co_quan_don_vi_id: null,
    don_vi_truc_thuoc_id: null,
    hinh_thuc_khen_thuong: 'Khen thưởng đột xuất A',
    nam: 2024,
    cap_bac: null,
    chuc_vu: null,
    ghi_chu: null,
    so_quyet_dinh: 'QD-DX-2024',
    files_dinh_kem: null,
    QuanNhan: {
      id: 'qn-dx-1',
      ho_ten: 'Nguyễn Văn DX',
      co_quan_don_vi_id: 'cqdv-dx-1',
      don_vi_truc_thuoc_id: null,
      CoQuanDonVi: { id: 'cqdv-dx-1', ten_don_vi: 'CQDV-DX' },
      DonViTrucThuoc: null,
      ChucVu: null,
    },
    CoQuanDonVi: null,
    DonViTrucThuoc: null,
    ...overrides,
  };
}

describe('adhocAward.service - createAdhocAward', () => {
  it('Tạo thành công cho cá nhân với đầy đủ thông tin', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(DOT_XUAT_makePersonnelRecord());
    prismaMock.khenThuongDotXuat.create.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // When
    const result = await adhocAwardService.createAdhocAward({
      adminId: 'acc-admin-dx',
      type: ADHOC_TYPE.CA_NHAN,
      year: 2024,
      awardForm: 'Khen thưởng đột xuất A',
      personnelId: 'qn-dx-1',
      decisionNumber: 'QD-DX-2024',
    });

    // Then
    expect(result.id).toBe('adh-1');
    const createCall = prismaMock.khenThuongDotXuat.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.so_quyet_dinh).toBe('QD-DX-2024');
    expect(createCall.data.quan_nhan_id).toBe('qn-dx-1');
    expect(createCall.data.doi_tuong).toBe(ADHOC_TYPE.CA_NHAN);
  });

  it('Non-admin role gọi create → ForbiddenError', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-mgr',
      username: 'mgr',
      role: ROLES.MANAGER,
    });

    // When / Then
    await expect(
      adhocAwardService.createAdhocAward({
        adminId: 'acc-mgr',
        type: ADHOC_TYPE.CA_NHAN,
        year: 2024,
        awardForm: 'Khen thưởng đột xuất A',
        personnelId: 'qn-dx-1',
      })
    ).rejects.toThrow('Chỉ Admin mới có quyền tạo khen thưởng đột xuất');
  });

  it('Quân nhân không tồn tại → NotFoundError', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    // When / Then
    await expect(
      adhocAwardService.createAdhocAward({
        adminId: 'acc-admin-dx',
        type: ADHOC_TYPE.CA_NHAN,
        year: 2024,
        awardForm: 'Khen thưởng A',
        personnelId: 'qn-not-exist',
      })
    ).rejects.toThrow('Quân nhân không tồn tại');
  });

  it('Đơn vị (CQDV) không tồn tại → NotFoundError', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);

    // When / Then
    await expect(
      adhocAwardService.createAdhocAward({
        adminId: 'acc-admin-dx',
        type: ADHOC_TYPE.TAP_THE,
        year: 2024,
        awardForm: 'Khen thưởng đơn vị',
        unitId: 'cqdv-not-exist',
        unitType: 'CO_QUAN_DON_VI',
      })
    ).rejects.toThrow('Cơ quan đơn vị không tồn tại');
  });
});

describe('adhocAward.service - getAdhocAwards (pagination)', () => {
  it('Trả pagination + data', async () => {
    // Given
    const records = [DOT_XUAT_makeAdhocRecord()];
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(1);
    prismaMock.khenThuongDotXuat.findMany.mockResolvedValueOnce(records);

    // When
    const result = await adhocAwardService.getAdhocAwards({ page: 1, limit: 20 });

    // Then
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });
});

describe('adhocAward.service - updateAdhocAward', () => {
  it('Cập nhật thành công khi admin hợp lệ', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.khenThuongDotXuat.update.mockResolvedValueOnce(
      DOT_XUAT_makeAdhocRecord({ hinh_thuc_khen_thuong: 'Khen thưởng đột xuất B' })
    );
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // When
    const result = await adhocAwardService.updateAdhocAward({
      id: 'adh-1',
      adminId: 'acc-admin-dx',
      awardForm: 'Khen thưởng đột xuất B',
    });

    // Then
    expect(result.hinh_thuc_khen_thuong).toBe('Khen thưởng đột xuất B');
    const updateCall = prismaMock.khenThuongDotXuat.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.hinh_thuc_khen_thuong).toBe('Khen thưởng đột xuất B');
  });

  it('Update record không tồn tại → NotFoundError', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(null);

    // When / Then
    await expect(
      adhocAwardService.updateAdhocAward({
        id: 'adh-not-exist',
        adminId: 'acc-admin-dx',
      })
    ).rejects.toThrow('Khen thưởng đột xuất không tồn tại');
  });
});

describe('adhocAward.service - deleteAdhocAward', () => {
  it('Xóa thành công và trả { success: true }', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.khenThuongDotXuat.delete.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // When
    const result = await adhocAwardService.deleteAdhocAward('adh-1', 'acc-admin-dx');

    // Then
    expect(result).toEqual({ success: true });
    expect(prismaMock.khenThuongDotXuat.delete).toHaveBeenCalledWith({ where: { id: 'adh-1' } });
  });

  it('Delete record không tồn tại → NotFoundError', async () => {
    // Given
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(null);

    // When / Then
    await expect(
      adhocAwardService.deleteAdhocAward('adh-not-exist', 'acc-admin-dx')
    ).rejects.toThrow('Khen thưởng đột xuất không tồn tại');
  });
});
