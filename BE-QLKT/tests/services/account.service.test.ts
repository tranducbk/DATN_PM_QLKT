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

describe('account.service - getAccounts', () => {
  it('Cho không có filter, Khi getAccounts, Thì trả về danh sách kèm pagination', async () => {
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

  it('Cho role filter dạng "ADMIN,MANAGER", Khi getAccounts, Thì where dùng role IN list', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(0);

    await accountService.getAccounts(1, 10, '', `${ROLES.ADMIN},${ROLES.MANAGER}`);

    const args = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = args.where.AND;
    const roleClause = andClauses.find((c: Record<string, unknown>) => 'role' in c);
    expect(roleClause.role).toEqual({ in: [ROLES.ADMIN, ROLES.MANAGER] });
  });

  it('Cho excludeSuperAdmin=true, Khi getAccounts, Thì where loại role SUPER_ADMIN', async () => {
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
});

describe('account.service - createAccount', () => {
  it('Cho MANAGER với chức vụ is_manager=true, Khi createAccount, Thì tạo thành công', async () => {
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

  it('Cho MANAGER với chức vụ is_manager=false, Khi createAccount, Thì throw ValidationError yêu cầu Chỉ huy', async () => {
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

  it('Cho username đã tồn tại, Khi createAccount, Thì throw ValidationError', async () => {
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

  it('Cho personnel_id không tồn tại, Khi createAccount, Thì throw NotFoundError', async () => {
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

  it('Cho password trống và DEFAULT_PASSWORD chưa cấu hình, Khi createAccount, Thì throw ValidationError', async () => {
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

  it('Cho password không đủ mạnh (thiếu chữ hoa), Khi createAccount, Thì throw ValidationError', async () => {
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

describe('account.service - updateAccount', () => {
  it('Cho update role, Khi updateAccount, Thì gọi prisma.update với role mới', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ id: 'acc-1' });
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

  it('Cho update password mới, Khi updateAccount, Thì password được hash và lưu', async () => {
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

  it('Cho account không tồn tại, Khi updateAccount, Thì throw NotFoundError', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);

    await expectError(
      accountService.updateAccount('acc-missing', { role: ROLES.USER }),
      NotFoundError,
    );
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });
});

describe('account.service - deleteAccount', () => {
  it('Cho account không gắn quân nhân, Khi deleteAccount, Thì xoá thành công', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.ADMIN,
      QuanNhan: null,
    });
    prismaMock.taiKhoan.delete.mockResolvedValueOnce({ id: 'acc-1' });

    const result = await accountService.deleteAccount('acc-1');

    expect(result.message).toContain('thành công');
    expect(prismaMock.taiKhoan.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
  });

  it('Cho account SUPER_ADMIN, Khi deleteAccount, Thì throw ForbiddenError', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-super',
      role: ROLES.SUPER_ADMIN,
      QuanNhan: null,
    });

    await expectError(
      accountService.deleteAccount('acc-super'),
      ForbiddenError,
      /SUPER_ADMIN/,
    );
  });

  it('Cho personnel còn đề xuất pending và force=false, Khi deleteAccount, Thì throw ValidationError', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      id: 'acc-1',
      role: ROLES.USER,
      QuanNhan: { id: 'qn-1', co_quan_don_vi_id: 'cqdv-1', don_vi_truc_thuoc_id: null },
    });
    prismaMock.bangDeXuat.findMany.mockResolvedValueOnce([
      { id: 'p-1', status: 'PENDING', data_nien_han: [{ personnel_id: 'qn-1' }] },
    ]);

    await expectError(
      accountService.deleteAccount('acc-1', false),
      ValidationError,
      /chờ duyệt/,
    );
  });
});
