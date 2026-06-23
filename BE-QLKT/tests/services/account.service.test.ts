import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import { expectError } from '../helpers/errorAssert';
import accountService from '../../src/services/account.service';
import { ROLES } from '../../src/constants/roles.constants';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../src/middlewares/errorHandler';

const ORIGINAL_DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;

beforeEach(() => {
  resetPrismaMock();
  process.env.DEFAULT_PASSWORD = ORIGINAL_DEFAULT_PASSWORD;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env.DEFAULT_PASSWORD = ORIGINAL_DEFAULT_PASSWORD;
});

describe('Tài khoản: lấy danh sách tài khoản', () => {
  it('Tài khoản: không có bộ lọc → trả danh sách kèm thông tin phân trang', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([
      {
        id: 'acc-1',
        username: 'user1',
        role: ROLES.USER,
        quan_nhan_id: 'qn-1',
        createdAt: new Date('2024-01-01'),
        QuanNhan: {
          ho_ten: 'Nguyễn Văn A',
          cap_bac: 'Đại uý',
          ChucVu: { ten_chuc_vu: 'Trợ lý' },
          CoQuanDonVi: { ten_don_vi: 'Phòng A' },
          DonViTrucThuoc: null,
        },
      },
    ]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(1);

    const result = await accountService.getAccounts(1, 10);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].don_vi).toBe('Phòng A');
    expect(result.pagination).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
  });

  it('Tài khoản: lọc theo nhiều vai trò "ADMIN,MANAGER" → chỉ lấy tài khoản thuộc danh sách vai trò đó', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(0);

    await accountService.getAccounts(1, 10, '', `${ROLES.ADMIN},${ROLES.MANAGER}`);

    const args = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = args.where.AND;
    const roleClause = andClauses.find((c: Record<string, unknown>) => 'role' in c);
    expect(roleClause.role).toEqual({ in: [ROLES.ADMIN, ROLES.MANAGER] });
  });

  it('Tài khoản: yêu cầu ẩn SUPER_ADMIN → danh sách loại bỏ tài khoản SUPER_ADMIN', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(0);

    await accountService.getAccounts(1, 10, '', undefined, true);

    const args = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = args.where.AND;
    const exclude = andClauses.find(
      (c: Record<string, unknown>) =>
        c.role && typeof c.role === 'object' && 'not' in (c.role as object)
    );
    expect(exclude.role).toEqual({ not: ROLES.SUPER_ADMIN });
  });

  it('Tài khoản: SUPER_ADMIN xem danh sách → không loại bỏ tài khoản SUPER_ADMIN', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(0);

    await accountService.getAccounts(1, 10, '', undefined, false);

    const args = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = args.where.AND;
    const exclude = andClauses.find(
      (c: Record<string, unknown>) =>
        c.role && typeof c.role === 'object' && 'not' in (c.role as object)
    );
    expect(exclude).toBeUndefined();
  });
});

describe('Tài khoản: tạo tài khoản mới', () => {
  it('Tài khoản: tạo MANAGER gắn chức vụ Chỉ huy → tạo thành công và tăng quân số đơn vị', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-1' });
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({ he_so_chuc_vu: 5, is_manager: true });
    prismaMock.quanNhan.create.mockResolvedValueOnce({ id: 'qn-new' });
    prismaMock.lichSuChucVu.create.mockResolvedValueOnce({});
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({});
    prismaMock.taiKhoan.create.mockResolvedValueOnce({
      id: 'acc-new',
      username: 'mgr1',
      role: ROLES.MANAGER,
      quan_nhan_id: 'qn-new',
      QuanNhan: {
        ho_ten: 'mgr1',
        ChucVu: { ten_chuc_vu: 'Trưởng phòng' },
        CoQuanDonVi: { ten_don_vi: 'Phòng A' },
        DonViTrucThuoc: null,
      },
    });

    const result = await accountService.createAccount({
      username: 'mgr1',
      password: 'StrongPass1',
      role: ROLES.MANAGER,
      co_quan_don_vi_id: 'cqdv-1',
      chuc_vu_id: 'cv-1',
    });

    expect(result.id).toBe('acc-new');
    expect(result.role).toBe(ROLES.MANAGER);
    expect(prismaMock.coQuanDonVi.update).toHaveBeenCalledWith({
      where: { id: 'cqdv-1' },
      data: { so_luong: { increment: 1 } },
    });
  });

  it('Tài khoản: tạo MANAGER nhưng chức vụ không phải Chỉ huy → báo lỗi yêu cầu chức vụ Chỉ huy', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-1' });
    prismaMock.chucVu.findUnique.mockResolvedValueOnce({ he_so_chuc_vu: 3, is_manager: false });

    await expectError(
      accountService.createAccount({
        username: 'mgr2',
        password: 'StrongPass1',
        role: ROLES.MANAGER,
        co_quan_don_vi_id: 'cqdv-1',
        chuc_vu_id: 'cv-2',
      }),
      ValidationError,
      /Chỉ huy/,
    );
    expect(prismaMock.taiKhoan.create).not.toHaveBeenCalled();
  });

  it('Tài khoản: tên đăng nhập đã tồn tại → báo lỗi trùng tên đăng nhập', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ id: 'acc-existing' });

    await expectError(
      accountService.createAccount({
        username: 'taken',
        password: 'StrongPass1',
        role: ROLES.ADMIN,
      }),
      ValidationError,
      'Tên đăng nhập đã tồn tại',
    );
  });

  it('Tài khoản: gắn quân nhân không tồn tại → báo không tìm thấy quân nhân', async () => {
    prismaMock.taiKhoan.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.quanNhan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      accountService.createAccount({
        personnel_id: 'qn-missing',
        username: 'newuser',
        password: 'StrongPass1',
        role: ROLES.USER,
      }),
      NotFoundError,
    );
  });

  it('Tài khoản: bỏ trống mật khẩu khi chưa cấu hình mật khẩu mặc định → báo lỗi chưa cấu hình mật khẩu mặc định', async () => {
    delete process.env.DEFAULT_PASSWORD;
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      accountService.createAccount({
        username: 'newuser',
        password: '',
        role: ROLES.ADMIN,
      }),
      ValidationError,
      /Mật khẩu mặc định chưa được cấu hình/,
    );
  });

  it('Tài khoản: mật khẩu không đủ mạnh (thiếu chữ hoa) → báo lỗi yêu cầu chữ hoa', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      accountService.createAccount({
        username: 'admin1',
        password: 'weakpass1',
        role: ROLES.ADMIN,
      }),
      ValidationError,
      /chữ hoa/,
    );
  });

});

describe('Tài khoản: cập nhật tài khoản', () => {
  it('Tài khoản: đổi vai trò → lưu vai trò mới', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      quan_nhan_id: 'qn-1',
      QuanNhan: null,
    });
    prismaMock.taiKhoan.update.mockResolvedValueOnce({
      id: 'acc-1',
      username: 'u1',
      role: ROLES.MANAGER,
      quan_nhan_id: null,
      QuanNhan: null,
    });

    const result = await accountService.updateAccount('acc-1', { role: ROLES.MANAGER });

    expect(result.role).toBe(ROLES.MANAGER);
    const args = prismaMock.taiKhoan.update.mock.calls[0][0];
    expect(args.data.role).toBe(ROLES.MANAGER);
  });

  it('Tài khoản: tài khoản đang gắn quân nhân nâng lên ADMIN → chặn (không cho nhảy bậc vai trò)', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.MANAGER,
      quan_nhan_id: 'qn-1',
      QuanNhan: null,
    });

    await expectError(
      accountService.updateAccount('acc-1', { role: ROLES.ADMIN }),
      ValidationError,
      /Chỉ huy đơn vị và Người dùng/,
    );
  });

  it('Tài khoản: tài khoản ADMIN hạ xuống MANAGER → chặn (không cho nhảy bậc vai trò)', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.ADMIN,
      quan_nhan_id: null,
      QuanNhan: null,
    });

    await expectError(
      accountService.updateAccount('acc-1', { role: ROLES.MANAGER }),
      ValidationError,
      /Quản trị viên và Cán bộ Phòng Chính trị/,
    );
  });

  it('Tài khoản: đổi mật khẩu mới → mật khẩu được mã hóa rồi mới lưu', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ id: 'acc-1' });
    prismaMock.taiKhoan.update.mockResolvedValueOnce({
      id: 'acc-1',
      username: 'u1',
      role: ROLES.ADMIN,
      quan_nhan_id: null,
      QuanNhan: null,
    });

    await accountService.updateAccount('acc-1', { password: 'NewStrong1' });

    const args = prismaMock.taiKhoan.update.mock.calls[0][0];
    expect(args.data.password_hash).toEqual(expect.any(String));
    expect(args.data.password_hash).not.toBe('NewStrong1');
  });

  it('Tài khoản: cập nhật tài khoản không tồn tại → báo không tìm thấy tài khoản', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      accountService.updateAccount('acc-missing', { role: ROLES.USER }),
      NotFoundError,
    );
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Tài khoản: nâng USER lên MANAGER mà không chọn Cơ quan đơn vị → báo thiếu Cơ quan đơn vị', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      quan_nhan_id: 'qn-1',
      QuanNhan: {
        id: 'qn-1',
        chuc_vu_id: 'cv-1',
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: 'dvtt-1',
      },
    });

    await expectError(
      accountService.updateAccount('acc-1', { role: ROLES.MANAGER }),
      ValidationError,
      /Cơ quan đơn vị/,
    );
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Tài khoản: nâng lên MANAGER nhưng lại chọn Đơn vị trực thuộc → báo lỗi không được gắn Đơn vị trực thuộc', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      quan_nhan_id: 'qn-1',
      QuanNhan: {
        id: 'qn-1',
        chuc_vu_id: 'cv-1',
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: 'dvtt-1',
      },
    });

    await expectError(
      accountService.updateAccount('acc-1', {
        role: ROLES.MANAGER,
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: 'dvtt-1',
        chuc_vu_id: 'cv-1',
      }),
      ValidationError,
      /Đơn vị trực thuộc/,
    );
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Tài khoản: hạ MANAGER xuống USER mà không chọn đủ đơn vị → báo lỗi thiếu thông tin đơn vị', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.MANAGER,
      quan_nhan_id: 'qn-1',
      QuanNhan: {
        id: 'qn-1',
        chuc_vu_id: 'cv-1',
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: null,
      },
    });

    await expectError(
      accountService.updateAccount('acc-1', {
        role: ROLES.USER,
        co_quan_don_vi_id: 'cqdv-1',
        chuc_vu_id: 'cv-1',
      }),
      ValidationError,
      /đầy đủ/,
    );
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Tài khoản: đổi đơn vị nhưng không chọn chức vụ → báo lỗi thiếu chức vụ', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      quan_nhan_id: 'qn-1',
      QuanNhan: {
        id: 'qn-1',
        chuc_vu_id: 'cv-1',
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: 'dvtt-1',
      },
    });

    await expectError(
      accountService.updateAccount('acc-1', {
        role: ROLES.USER,
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: 'dvtt-1',
      }),
      ValidationError,
      /chức vụ/,
    );
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Tài khoản: nâng USER lên MANAGER hợp lệ → bỏ Đơn vị trực thuộc, giảm quân số đơn vị cũ và tăng quân số Cơ quan đơn vị mới', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      quan_nhan_id: 'qn-1',
      QuanNhan: {
        id: 'qn-1',
        chuc_vu_id: 'cv-old',
        co_quan_don_vi_id: 'cqdv-1',
        don_vi_truc_thuoc_id: 'dvtt-1',
      },
    });
    prismaMock.coQuanDonVi.findUnique.mockResolvedValueOnce({ id: 'cqdv-1' });
    prismaMock.chucVu.findUnique.mockResolvedValue({ is_manager: true, he_so_chuc_vu: 5 });
    prismaMock.lichSuChucVu.findMany.mockResolvedValueOnce([]);
    prismaMock.lichSuChucVu.create.mockResolvedValueOnce({});
    prismaMock.quanNhan.update.mockResolvedValueOnce({ id: 'qn-1' });
    prismaMock.donViTrucThuoc.update.mockResolvedValueOnce({});
    prismaMock.coQuanDonVi.update.mockResolvedValueOnce({});
    prismaMock.taiKhoan.update.mockResolvedValueOnce({
      id: 'acc-1',
      username: 'u1',
      role: ROLES.MANAGER,
      quan_nhan_id: 'qn-1',
      QuanNhan: {
        ho_ten: 'A',
        ChucVu: { ten_chuc_vu: 'Trưởng phòng' },
        CoQuanDonVi: { ten_don_vi: 'Phòng A' },
        DonViTrucThuoc: null,
      },
    });

    const result = await accountService.updateAccount('acc-1', {
      role: ROLES.MANAGER,
      co_quan_don_vi_id: 'cqdv-1',
      chuc_vu_id: 'cv-mgr',
    });

    expect(result.role).toBe(ROLES.MANAGER);
    const qnArgs = prismaMock.quanNhan.update.mock.calls[0][0];
    expect(qnArgs.data.don_vi_truc_thuoc_id).toBeNull();
    expect(qnArgs.data.co_quan_don_vi_id).toBe('cqdv-1');
    expect(prismaMock.donViTrucThuoc.update).toHaveBeenCalledWith({
      where: { id: 'dvtt-1' },
      data: { so_luong: { decrement: 1 } },
    });
    expect(prismaMock.coQuanDonVi.update).toHaveBeenCalledWith({
      where: { id: 'cqdv-1' },
      data: { so_luong: { increment: 1 } },
    });
  });
});

describe('Tài khoản: xóa tài khoản', () => {
  it('Tài khoản: xóa tài khoản cấp thấp hơn → xóa thành công', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.ADMIN,
      QuanNhan: null,
    });
    prismaMock.taiKhoan.delete.mockResolvedValueOnce({ id: 'acc-1' });

    const result = await accountService.deleteAccount('acc-1', false, ROLES.SUPER_ADMIN);

    expect(result.message).toContain('thành công');
    expect(prismaMock.taiKhoan.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
  });

  it('Tài khoản: ADMIN xóa tài khoản ngang quyền (ADMIN) → từ chối, chỉ được xóa cấp thấp hơn', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-admin',
      role: ROLES.ADMIN,
      QuanNhan: null,
    });

    await expectError(
      accountService.deleteAccount('acc-admin', false, ROLES.ADMIN),
      ForbiddenError,
      /cấp thấp hơn/,
    );
    expect(prismaMock.taiKhoan.delete).not.toHaveBeenCalled();
  });

  it('Tài khoản: xóa tài khoản SUPER_ADMIN (kể cả do SUPER_ADMIN thực hiện) → từ chối', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-super',
      role: ROLES.SUPER_ADMIN,
      QuanNhan: null,
    });

    await expectError(
      accountService.deleteAccount('acc-super', false, ROLES.SUPER_ADMIN),
      ForbiddenError,
      /cấp thấp hơn/,
    );
  });

  it('Tài khoản: quân nhân còn đề xuất chờ duyệt và không ép buộc xóa → chặn xóa', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      QuanNhan: { id: 'qn-1', co_quan_don_vi_id: 'cqdv-1', don_vi_truc_thuoc_id: null },
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      { id: 'p-1', status: 'PENDING', data_nien_han: [{ personnel_id: 'qn-1' }] },
    ]);

    await expectError(
      accountService.deleteAccount('acc-1', false, ROLES.ADMIN),
      ValidationError,
      /chờ duyệt/,
    );
  });
});
