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

describe('requireSuperAdmin', () => {
  it('SUPER_ADMIN → pass', () => {
    const result = invokeMiddleware(requireSuperAdmin, ROLES.SUPER_ADMIN);
    expect(result.allowed).toBe(true);
  });

  it.each([ROLES.ADMIN, ROLES.MANAGER, ROLES.USER])('%s → 403', role => {
    const result = invokeMiddleware(requireSuperAdmin, role);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('no user (unauthenticated) → 401', () => {
    const result = invokeMiddleware(requireSuperAdmin);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe('requireAdmin (SA + ADMIN — shared system management)', () => {
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

describe('requireAdminOnly (ADMIN only — business operations, excludes SA)', () => {
  it('ADMIN → pass', () => {
    const result = invokeMiddleware(requireAdminOnly, ROLES.ADMIN);
    expect(result.allowed).toBe(true);
  });

  it('SUPER_ADMIN → 403 (SA does not run business ops)', () => {
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

describe('requireManager (SA + ADMIN + MANAGER)', () => {
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER])('%s → pass', role => {
    const result = invokeMiddleware(requireManager, role);
    expect(result.allowed).toBe(true);
  });

  it('USER → 403', () => {
    const result = invokeMiddleware(requireManager, ROLES.USER);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });
});
