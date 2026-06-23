import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prismaMock } from '../helpers/prismaMock';
import { verifyToken } from '../../src/middlewares/auth';
import { JWT_SECRET } from '../../src/configs';
import { ROLES } from '../../src/constants/roles.constants';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  statusCode?: number;
  body?: unknown;
}

function makeRes(): MockResponse {
  const res: MockResponse = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

function makeReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

function signToken(payload: Record<string, unknown>, options: jwt.SignOptions = {}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h', ...options });
}

describe('Middleware xác thực access token (verifyToken)', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('Từ chối yêu cầu khi thiếu header Authorization (trả 401)', async () => {
    const req = makeReq();
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('token'),
    });
  });

  it('Từ chối yêu cầu khi header Authorization thiếu tiền tố Bearer (trả 401)', async () => {
    const req = makeReq('Token abc.def.ghi');
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('Với token hợp lệ, gắn thông tin người dùng đã giải mã và cho qua', async () => {
    const payload = {
      id: 'acc-1',
      username: 'admin_user',
      role: ROLES.ADMIN,
      quan_nhan_id: 'qn-1',
    };
    const token = signToken(payload);
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      refreshToken: 'rt-existing',
      role: ROLES.ADMIN,
      quan_nhan_id: 'qn-1',
    });

    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(payload);
    expect(res.statusCode).toBeUndefined();
  });

  it('Lấy vai trò từ cơ sở dữ liệu ngay cả khi token mang vai trò cũ (cao hơn)', async () => {
    const token = signToken({ id: 'acc-1', username: 'u', role: ROLES.ADMIN });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({
      refreshToken: 'rt-existing',
      role: ROLES.USER,
      quan_nhan_id: 'qn-1',
    });

    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.role).toBe(ROLES.USER);
  });

  it('Từ chối yêu cầu khi token đã hết hạn (trả 401 kèm thông báo hết hạn)', async () => {
    const expiredToken = signToken({ id: 'acc-1', role: ROLES.USER }, { expiresIn: -10 });

    const req = makeReq(`Bearer ${expiredToken}`);
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('hết hạn'),
    });
  });

  it('Từ chối yêu cầu khi chữ ký token không hợp lệ (trả 401)', async () => {
    const tamperedToken = jwt.sign({ id: 'acc-1', role: ROLES.USER }, 'wrong-secret', {
      expiresIn: '1h',
    });

    const req = makeReq(`Bearer ${tamperedToken}`);
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ message: expect.stringContaining('không hợp lệ') });
  });

  it('Từ chối yêu cầu khi token sai định dạng (trả 401)', async () => {
    const req = makeReq('Bearer not-a-real-token');
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('Từ chối yêu cầu khi tài khoản không còn tồn tại (trả 401 kèm thông báo phiên đăng nhập)', async () => {
    const token = signToken({ id: 'acc-deleted', role: ROLES.USER });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce(null);

    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ message: expect.stringContaining('Phiên đăng nhập') });
  });

  it('Từ chối yêu cầu khi tài khoản đã đăng xuất (refresh token đã bị xóa) (trả 401 kèm thông báo phiên đăng nhập)', async () => {
    const token = signToken({ id: 'acc-1', role: ROLES.USER });
    prismaMock.taiKhoan.findUnique.mockResolvedValueOnce({ refreshToken: null });

    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await verifyToken(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ message: expect.stringContaining('Phiên đăng nhập') });
  });
});
