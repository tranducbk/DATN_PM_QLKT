/**
 * Role middleware authorization — pin which roles each middleware accepts/rejects.
 * Verifies the SA / ADMIN / MANAGER split that distinguishes system-mgmt vs business-ops routes.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  requireSuperAdmin,
  requireAdmin,
  requireAdminOnly,
  requireManager,
} from '../../src/middlewares/auth';
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

function makeReq(role?: string): Request {
  return {
    user: role ? { id: 'u1', username: 'u1', role } : undefined,
  } as unknown as Request;
}

interface MiddlewareResult {
  allowed: boolean;
  status?: number;
  body?: unknown;
}

function invokeMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  role?: string
): MiddlewareResult {
  const req = makeReq(role);
  const res = makeRes();
  let allowed = false;
  const next: NextFunction = () => {
    allowed = true;
  };
  middleware(req, res as unknown as Response, next);
  return { allowed, status: res.statusCode, body: res.body };
}

describe('Phân quyền: cổng chặn route chỉ dành cho SUPER_ADMIN', () => {
  it('Phân quyền: SUPER_ADMIN truy cập route SUPER_ADMIN → cho qua', () => {
    const result = invokeMiddleware(requireSuperAdmin, ROLES.SUPER_ADMIN);
    expect(result.allowed).toBe(true);
  });

  it.each([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER])('%s → 403', role => {
    const result = invokeMiddleware(requireSuperAdmin, role);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('Bảo mật: chưa đăng nhập (không có người dùng) → chặn với lỗi 401', () => {
    const result = invokeMiddleware(requireSuperAdmin);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe('Phân quyền: cổng chặn route quản trị hệ thống (SUPER_ADMIN và ADMIN)', () => {
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])('%s → pass', role => {
    const result = invokeMiddleware(requireAdmin, role);
    expect(result.allowed).toBe(true);
  });

  it.each([ROLES.MANAGER, ROLES.USER])('%s → 403', role => {
    const result = invokeMiddleware(requireAdmin, role);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });
});

describe('Phân quyền: cổng chặn route nghiệp vụ chỉ dành riêng cho ADMIN (loại trừ SUPER_ADMIN)', () => {
  it('Phân quyền: ADMIN truy cập route nghiệp vụ → cho qua', () => {
    const result = invokeMiddleware(requireAdminOnly, ROLES.ADMIN);
    expect(result.allowed).toBe(true);
  });

  it('Phân quyền: SUPER_ADMIN truy cập route nghiệp vụ riêng của ADMIN → bị chặn (403)', () => {
    const result = invokeMiddleware(requireAdminOnly, ROLES.SUPER_ADMIN);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it.each([ROLES.MANAGER, ROLES.USER])('%s → 403', role => {
    const result = invokeMiddleware(requireAdminOnly, role);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });
});

describe('Phân quyền: cổng chặn route cấp quản lý (SUPER_ADMIN, ADMIN và MANAGER)', () => {
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER])('%s → pass', role => {
    const result = invokeMiddleware(requireManager, role);
    expect(result.allowed).toBe(true);
  });

  it('Phân quyền: USER truy cập route cấp quản lý → bị chặn (403)', () => {
    const result = invokeMiddleware(requireManager, ROLES.USER);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });
});
