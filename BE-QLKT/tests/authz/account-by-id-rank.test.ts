import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import accountService from '../../src/services/account.service';
import { expectError } from '../helpers/errorAssert';
import { ForbiddenError } from '../../src/middlewares/errorHandler';
import { ROLES } from '../../src/constants/roles.constants';

beforeEach(() => {
  resetPrismaMock();
});

const FORBIDDEN_MSG = 'Không có quyền xem tài khoản này';

function mockAccount(role: string): void {
  prismaMock.taiKhoan.findUnique.mockResolvedValue({
    id: 'acc-x',
    username: 'x',
    role,
    quan_nhan_id: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    QuanNhan: null,
  });
}

describe('accountService.getAccountById — không cho đọc tài khoản SUPER_ADMIN', () => {
  it('ADMIN đọc SUPER_ADMIN qua :id → ForbiddenError', async () => {
    mockAccount(ROLES.SUPER_ADMIN);
    await expectError(
      accountService.getAccountById('acc-x', ROLES.ADMIN),
      ForbiddenError,
      FORBIDDEN_MSG
    );
  });

  it('SUPER_ADMIN đọc SUPER_ADMIN → cho phép', async () => {
    mockAccount(ROLES.SUPER_ADMIN);
    const result = await accountService.getAccountById('acc-x', ROLES.SUPER_ADMIN);
    expect(result.role).toBe(ROLES.SUPER_ADMIN);
  });

  it('ADMIN đọc tài khoản cấp thấp hơn (MANAGER) → cho phép', async () => {
    mockAccount(ROLES.MANAGER);
    const result = await accountService.getAccountById('acc-x', ROLES.ADMIN);
    expect(result.role).toBe(ROLES.MANAGER);
  });

  it('gọi nội bộ (không truyền callerRole) → không chặn, giữ luồng cập nhật', async () => {
    mockAccount(ROLES.SUPER_ADMIN);
    const result = await accountService.getAccountById('acc-x');
    expect(result.id).toBe('acc-x');
  });
});
