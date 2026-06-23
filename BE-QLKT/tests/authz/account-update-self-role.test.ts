/**
 * A user cannot change their OWN role via updateAccount — self-demotion would revoke the
 * caller's privileges mid-session. Pins the controller guard (req.user.id === params.id).
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

function makeReq(
  callerId: string,
  role: string,
  params: Record<string, string>,
  body: Record<string, unknown>
): Request {
  return {
    user: { id: callerId, username: 'sa', role },
    params,
    query: {},
    body,
  } as unknown as Request;
}

interface CapturedRes {
  status: jest.Mock;
  json: jest.Mock;
  payload?: unknown;
  statusCode?: number;
}

function makeRes(): CapturedRes {
  const res: CapturedRes = { status: jest.fn(), json: jest.fn() };
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

function accountRow(id: string, role: string) {
  return {
    id,
    username: id,
    role,
    quan_nhan_id: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    QuanNhan: null,
  };
}

describe('Bảo mật: không cho tự đổi vai trò của chính mình', () => {
  it('Bảo mật: SUPER_ADMIN tự hạ vai trò mình xuống ADMIN → bị chặn (403), không cập nhật', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(accountRow('sa-1', ROLES.SUPER_ADMIN));

    const req = makeReq('sa-1', ROLES.SUPER_ADMIN, { id: 'sa-1' }, { role: ROLES.ADMIN });
    const res = makeRes();
    await accountController.updateAccount(req, res as unknown as Response, jest.fn());

    expect(res.statusCode).toBe(403);
    expect(prismaMock.taiKhoan.update).not.toHaveBeenCalled();
  });

  it('Phân quyền: SUPER_ADMIN sửa tài khoản mình nhưng giữ nguyên vai trò → cho phép cập nhật', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValue(accountRow('sa-1', ROLES.SUPER_ADMIN));
    prismaMock.taiKhoan.update.mockResolvedValueOnce(accountRow('sa-1', ROLES.SUPER_ADMIN));

    const req = makeReq('sa-1', ROLES.SUPER_ADMIN, { id: 'sa-1' }, { role: ROLES.SUPER_ADMIN });
    const res = makeRes();
    await accountController.updateAccount(req, res as unknown as Response, jest.fn());

    expect(res.statusCode).not.toBe(403);
    expect(prismaMock.taiKhoan.update).toHaveBeenCalled();
  });

  it('Phân quyền: SUPER_ADMIN đổi vai trò của tài khoản KHÁC lên ADMIN → cho phép cập nhật', async () => {
    prismaMock.taiKhoan.findUnique.mockResolvedValue(accountRow('other-1', ROLES.MANAGER));
    prismaMock.taiKhoan.update.mockResolvedValueOnce(accountRow('other-1', ROLES.ADMIN));

    const req = makeReq('sa-1', ROLES.SUPER_ADMIN, { id: 'other-1' }, { role: ROLES.ADMIN });
    const res = makeRes();
    await accountController.updateAccount(req, res as unknown as Response, jest.fn());

    expect(res.statusCode).not.toBe(403);
    expect(prismaMock.taiKhoan.update).toHaveBeenCalled();
  });
});
