/**
 * SA must see ALL accounts (including other SAs) — pin the full controller flow:
 * route → middleware → controller → service → repository. Verifies the controller passes
 * `excludeSuperAdmin=false` to the service so the where clause carries no role exclusion.
 */

import type { Request, Response } from 'express';
import { prismaMock, resetPrismaMock } from '../helpers/prismaMock';
import accountController from '../../src/controllers/account.controller';
import { ROLES } from '../../src/constants/roles.constants';

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeReq(role: string, query: Record<string, unknown> = {}): Request {
  return {
    user: { id: 'caller-1', username: 'sa', role },
    query: { page: 1, limit: 20, ...query },
  } as unknown as Request;
}

interface CapturedRes {
  status: jest.Mock;
  json: jest.Mock;
  payload?: unknown;
  statusCode?: number;
}

function makeRes(): CapturedRes {
  const res: CapturedRes = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.payload = body;
    return res;
  });
  return res;
}

describe('Phân quyền: danh sách tài khoản — SUPER_ADMIN thấy mọi vai trò, kể cả SUPER_ADMIN khác', () => {
  it('Phân quyền: SUPER_ADMIN không lọc vai trò → danh sách gồm đủ 4 cấp, không loại trừ SUPER_ADMIN', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([
      { id: 'a1', username: 'sa1', role: ROLES.SUPER_ADMIN, quan_nhan_id: null, createdAt: new Date(), QuanNhan: null },
      { id: 'a2', username: 'admin1', role: ROLES.ADMIN, quan_nhan_id: null, createdAt: new Date(), QuanNhan: null },
      { id: 'a3', username: 'mgr1', role: ROLES.MANAGER, quan_nhan_id: null, createdAt: new Date(), QuanNhan: null },
      { id: 'a4', username: 'user1', role: ROLES.USER, quan_nhan_id: null, createdAt: new Date(), QuanNhan: null },
    ]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(4);

    const req = makeReq(ROLES.SUPER_ADMIN);
    const res = makeRes();
    await accountController.getAccounts(req, res as unknown as Response, jest.fn());

    const findManyArgs = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = findManyArgs.where.AND;
    // No clause should exclude SUPER_ADMIN
    const exclude = andClauses.find(
      (c: Record<string, unknown>) =>
        c.role && typeof c.role === 'object' && 'not' in (c.role as object)
    );
    expect(exclude).toBeUndefined();

    // Response carries all 4 accounts + total=4
    const payload = res.payload as { data: unknown[]; pagination: { total: number } };
    expect(payload.data).toHaveLength(4);
    expect(payload.pagination.total).toBe(4);
  });

  it('Phân quyền: SUPER_ADMIN lọc vai trò = SUPER_ADMIN → chỉ trả về các tài khoản SUPER_ADMIN', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([
      { id: 'a1', username: 'sa1', role: ROLES.SUPER_ADMIN, quan_nhan_id: null, createdAt: new Date(), QuanNhan: null },
    ]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(1);

    const req = makeReq(ROLES.SUPER_ADMIN, { role: ROLES.SUPER_ADMIN });
    const res = makeRes();
    await accountController.getAccounts(req, res as unknown as Response, jest.fn());

    const findManyArgs = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = findManyArgs.where.AND;
    const roleClause = andClauses.find(
      (c: Record<string, unknown>) => c.role && typeof c.role === 'string'
    );
    expect(roleClause).toEqual({ role: ROLES.SUPER_ADMIN });
  });

  it('Phân quyền: ADMIN không lọc vai trò → chỉ thấy MANAGER và USER, bị chặn thấy SUPER_ADMIN và ADMIN', async () => {
    prismaMock.taiKhoan.findMany.mockResolvedValueOnce([]);
    prismaMock.taiKhoan.count.mockResolvedValueOnce(0);

    const req = makeReq(ROLES.ADMIN);
    const res = makeRes();
    await accountController.getAccounts(req, res as unknown as Response, jest.fn());

    const findManyArgs = prismaMock.taiKhoan.findMany.mock.calls[0][0];
    const andClauses = findManyArgs.where.AND;
    // ADMIN gets role IN [MANAGER, USER] from controller default
    const roleClause = andClauses.find(
      (c: Record<string, unknown>) => c.role && typeof c.role === 'object' && 'in' in (c.role as object)
    );
    expect(roleClause.role).toEqual({ in: [ROLES.MANAGER, ROLES.USER] });
    // ADMIN also gets excludeSuperAdmin=true (defense-in-depth)
    const exclude = andClauses.find(
      (c: Record<string, unknown>) =>
        c.role && typeof c.role === 'object' && 'not' in (c.role as object)
    );
    expect(exclude.role).toEqual({ not: ROLES.SUPER_ADMIN });
  });
});
