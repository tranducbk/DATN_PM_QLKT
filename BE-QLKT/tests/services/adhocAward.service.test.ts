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

describe('Khen thưởng đột xuất: tạo khen thưởng', () => {
  it('Khen thưởng đột xuất: tạo cho cá nhân với đầy đủ thông tin và số quyết định đã có sẵn → lưu đúng quân nhân, số quyết định, đối tượng cá nhân', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(DOT_XUAT_makePersonnelRecord());
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce({ so_quyet_dinh: 'QD-DX-2024' });
    prismaMock.khenThuongDotXuat.create.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // Khi
    const result = await adhocAwardService.createAdhocAward({
      adminId: 'acc-admin-dx',
      type: ADHOC_TYPE.CA_NHAN,
      year: 2024,
      awardForm: 'Khen thưởng đột xuất A',
      personnelId: 'qn-dx-1',
      decisionNumber: 'QD-DX-2024',
    });

    // Thì
    expect(result.id).toBe('adh-1');
    const createCall = prismaMock.khenThuongDotXuat.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.so_quyet_dinh).toBe('QD-DX-2024');
    expect(createCall.data.quan_nhan_id).toBe('qn-dx-1');
    expect(createCall.data.doi_tuong).toBe(ADHOC_TYPE.CA_NHAN);
  });

  it('Khen thưởng đột xuất: số quyết định mới kèm đủ năm, ngày ký, người ký → tạo bản ghi quyết định trước rồi mới tạo khen thưởng', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(DOT_XUAT_makePersonnelRecord());
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);
    prismaMock.fileQuyetDinh.create.mockResolvedValueOnce({ id: 'fqd-1', so_quyet_dinh: 'QD-DX-2025' });
    prismaMock.khenThuongDotXuat.create.mockResolvedValueOnce(
      DOT_XUAT_makeAdhocRecord({ so_quyet_dinh: 'QD-DX-2025' })
    );
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // Khi
    await adhocAwardService.createAdhocAward({
      adminId: 'acc-admin-dx',
      type: ADHOC_TYPE.CA_NHAN,
      year: 2025,
      awardForm: 'Khen thưởng đột xuất B',
      personnelId: 'qn-dx-1',
      decisionNumber: 'QD-DX-2025',
      decisionYear: 2025,
      signDate: '2025-03-10',
      signer: 'Trung tướng Nguyễn Văn A',
    });

    // Thì
    const decisionCreateCall = prismaMock.fileQuyetDinh.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(decisionCreateCall.data.so_quyet_dinh).toBe('QD-DX-2025');
    expect(decisionCreateCall.data.nguoi_ky).toBe('Trung tướng Nguyễn Văn A');
    expect(prismaMock.fileQuyetDinh.create).toHaveBeenCalledTimes(1);
  });

  it('Khen thưởng đột xuất bị chặn: số quyết định mới nhưng thiếu năm, ngày ký, người ký → báo "Quyết định mới cần đầy đủ năm, ngày ký và người ký"', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(DOT_XUAT_makePersonnelRecord());
    prismaMock.fileQuyetDinh.findUnique.mockResolvedValueOnce(null);

    // Khi / Thì
    await expect(
      adhocAwardService.createAdhocAward({
        adminId: 'acc-admin-dx',
        type: ADHOC_TYPE.CA_NHAN,
        year: 2025,
        awardForm: 'Khen thưởng đột xuất B',
        personnelId: 'qn-dx-1',
        decisionNumber: 'QD-DX-MOI',
      })
    ).rejects.toThrow('Quyết định mới cần đầy đủ năm, ngày ký và người ký');
  });

  it('Khen thưởng đột xuất bị chặn: tài khoản không phải Admin (MANAGER) tạo khen thưởng → từ chối "Chỉ Admin mới có quyền tạo khen thưởng đột xuất"', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-mgr',
      username: 'mgr',
      role: ROLES.MANAGER,
    });

    // Khi / Thì
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

  it('Khen thưởng đột xuất bị chặn: quân nhân được chọn không tồn tại → báo "Quân nhân không tồn tại"', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    // Khi / Thì
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

  it('Khen thưởng đột xuất bị chặn: khen thưởng tập thể nhưng CQDV được chọn không tồn tại → báo "Cơ quan đơn vị không tồn tại"', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce(null);

    // Khi / Thì
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

describe('Khen thưởng đột xuất: danh sách (phân trang)', () => {
  it('Khen thưởng đột xuất: lấy danh sách trang 1, mỗi trang 20 dòng → trả về dữ liệu kèm tổng số bản ghi', async () => {
    // Cho
    const records = [DOT_XUAT_makeAdhocRecord()];
    prismaMock.khenThuongDotXuat.count.mockResolvedValueOnce(1);
    prismaMock.khenThuongDotXuat.findMany.mockResolvedValueOnce(records);

    // Khi
    const result = await adhocAwardService.getAdhocAwards({ page: 1, limit: 20 });

    // Thì
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });
});

describe('Khen thưởng đột xuất: cập nhật khen thưởng', () => {
  it('Khen thưởng đột xuất: Admin sửa hình thức khen thưởng của bản ghi đang có → cập nhật thành công', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.khenThuongDotXuat.update.mockResolvedValueOnce(
      DOT_XUAT_makeAdhocRecord({ hinh_thuc_khen_thuong: 'Khen thưởng đột xuất B' })
    );
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // Khi
    const result = await adhocAwardService.updateAdhocAward({
      id: 'adh-1',
      adminId: 'acc-admin-dx',
      awardForm: 'Khen thưởng đột xuất B',
    });

    // Thì
    expect(result.hinh_thuc_khen_thuong).toBe('Khen thưởng đột xuất B');
    const updateCall = prismaMock.khenThuongDotXuat.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.hinh_thuc_khen_thuong).toBe('Khen thưởng đột xuất B');
  });

  it('Khen thưởng đột xuất bị chặn: cập nhật bản ghi không tồn tại → báo "Khen thưởng đột xuất không tồn tại"', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(null);

    // Khi / Thì
    await expect(
      adhocAwardService.updateAdhocAward({
        id: 'adh-not-exist',
        adminId: 'acc-admin-dx',
      })
    ).rejects.toThrow('Khen thưởng đột xuất không tồn tại');
  });
});

describe('Khen thưởng đột xuất: xóa khen thưởng', () => {
  it('Khen thưởng đột xuất: Admin xóa bản ghi đang có → xóa thành công và báo thành công', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.khenThuongDotXuat.delete.mockResolvedValueOnce(DOT_XUAT_makeAdhocRecord());
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.findFirst.mockResolvedValueOnce(null);

    // Khi
    const result = await adhocAwardService.deleteAdhocAward('adh-1', 'acc-admin-dx');

    // Thì
    expect(result).toMatchObject({ success: true });
    expect(prismaMock.khenThuongDotXuat.delete).toHaveBeenCalledWith({ where: { id: 'adh-1' } });
  });

  it('Khen thưởng đột xuất bị chặn: xóa bản ghi không tồn tại → báo "Khen thưởng đột xuất không tồn tại"', async () => {
    // Cho
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(DOT_XUAT_makeAdminAccount());
    prismaMock.khenThuongDotXuat.findUnique.mockResolvedValueOnce(null);

    // Khi / Thì
    await expect(
      adhocAwardService.deleteAdhocAward('adh-not-exist', 'acc-admin-dx')
    ).rejects.toThrow('Khen thưởng đột xuất không tồn tại');
  });
});
