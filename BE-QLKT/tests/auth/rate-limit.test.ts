import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { authLimiter, writeLimiter } from '../../src/configs/rateLimiter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  end: jest.Mock;
  setHeader: jest.Mock;
  getHeader: jest.Mock;
  removeHeader: jest.Mock;
  set: jest.Mock;
  on: jest.Mock;
  statusCode?: number;
  body?: unknown;
}

function makeRes(): MockResponse {
  const res: MockResponse = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
    setHeader: jest.fn(),
    getHeader: jest.fn(),
    removeHeader: jest.fn(),
    set: jest.fn(),
    on: jest.fn(),
  };
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send.mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  res.set.mockImplementation(() => res);
  return res;
}

function makeReq(ip: string): Request {
  return {
    ip,
    ips: [],
    method: 'POST',
    originalUrl: '/api/auth/login',
    url: '/api/auth/login',
    path: '/api/auth/login',
    headers: {},
    app: {
      get: (key: string) => (key === 'trust proxy' ? false : undefined),
    },
  } as unknown as Request;
}

/**
 * Chạy 1 lần middleware rate-limit và trả về kết quả: gọi next() (allowed)
 * hay gọi res.status/json (blocked).
 */
async function hitLimiter(
  limiter: RequestHandler,
  ip: string
): Promise<{ allowed: boolean; status?: number; body?: unknown }> {
  return new Promise(resolve => {
    const req = makeReq(ip);
    const res = makeRes();
    const next: NextFunction = () => {
      resolve({ allowed: true });
    };
    res.send.mockImplementation((body: unknown) => {
      res.body = body;
      resolve({ allowed: false, status: res.statusCode, body });
      return res;
    });
    res.json.mockImplementation((body: unknown) => {
      res.body = body;
      resolve({ allowed: false, status: res.statusCode, body });
      return res;
    });
    Promise.resolve(limiter(req, res as unknown as Response, next)).catch(() => {
      // express-rate-limit không throw; defensive catch để giữ promise alive.
    });
  });
}

describe('authLimiter (login/auth endpoints — 30 req / 5min)', () => {
  it('allows the first 30 requests from an IP', async () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 30; i++) {
      const result = await hitLimiter(authLimiter, ip);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the 31st request from the same IP within the window', async () => {
    const ip = '10.0.0.2';
    for (let i = 0; i < 30; i++) {
      await hitLimiter(authLimiter, ip);
    }
    const blocked = await hitLimiter(authLimiter, ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Quá nhiều yêu cầu'),
    });
  });

  it('counts each IP independently (IP A reaching limit does not affect IP B)', async () => {
    const ipA = '10.0.0.3';
    const ipB = '10.0.0.4';
    for (let i = 0; i < 30; i++) {
      await hitLimiter(authLimiter, ipA);
    }
    const aBlocked = await hitLimiter(authLimiter, ipA);
    const bAllowed = await hitLimiter(authLimiter, ipB);
    expect(aBlocked.allowed).toBe(false);
    expect(bAllowed.allowed).toBe(true);
  });
});

describe('writeLimiter (sensitive write endpoints — 30 req / 15min)', () => {
  it('allows the first 30 requests from an IP', async () => {
    const ip = '10.0.1.1';
    for (let i = 0; i < 30; i++) {
      const result = await hitLimiter(writeLimiter, ip);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the 31st request from the same IP', async () => {
    const ip = '10.0.1.2';
    for (let i = 0; i < 30; i++) {
      await hitLimiter(writeLimiter, ip);
    }
    const blocked = await hitLimiter(writeLimiter, ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it('returns Vietnamese user-friendly message when blocked', async () => {
    const ip = '10.0.1.3';
    for (let i = 0; i < 30; i++) {
      await hitLimiter(writeLimiter, ip);
    }
    const blocked = await hitLimiter(writeLimiter, ip);
    expect(blocked.body).toMatchObject({
      success: false,
      message: expect.stringMatching(/Quá nhiều yêu cầu/i),
    });
  });
});
