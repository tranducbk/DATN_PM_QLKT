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

describe('Phân quyền: xem chi tiết tài khoản theo cấp vai trò', () => {
  it('Phân quyền: ADMIN mở chi tiết tài khoản SUPER_ADMIN → bị chặn (không có quyền xem)', async () => {
    mockAccount(ROLES.SUPER_ADMIN);
    await expectError(
      accountService.getAccountById('acc-x', ROLES.ADMIN),
      ForbiddenError,
      FORBIDDEN_MSG
    );
  });

  it('Phân quyền: SUPER_ADMIN mở chi tiết tài khoản SUPER_ADMIN → cho phép xem', async () => {
    mockAccount(ROLES.SUPER_ADMIN);
    const result = await accountService.getAccountById('acc-x', ROLES.SUPER_ADMIN);
    expect(result.role).toBe(ROLES.SUPER_ADMIN);
  });

  it('Phân quyền: ADMIN mở chi tiết tài khoản cấp thấp hơn (MANAGER) → cho phép xem', async () => {
    mockAccount(ROLES.MANAGER);
    const result = await accountService.getAccountById('acc-x', ROLES.ADMIN);
    expect(result.role).toBe(ROLES.MANAGER);
  });

  it('Phân quyền: gọi nội bộ không kèm vai trò người gọi → không áp ràng buộc, vẫn lấy được tài khoản', async () => {
    mockAccount(ROLES.SUPER_ADMIN);
    const result = await accountService.getAccountById('acc-x');
    expect(result.id).toBe('acc-x');
  });
});
