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

describe('Giới hạn tần suất cho endpoint đăng nhập/xác thực (30 yêu cầu mỗi 5 phút)', () => {
  it('Cho phép 30 yêu cầu đầu tiên từ một địa chỉ IP', async () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 30; i++) {
      const result = await hitLimiter(authLimiter, ip);
      expect(result.allowed).toBe(true);
    }
  });

  it('Chặn yêu cầu thứ 31 từ cùng một IP trong cửa sổ thời gian → trả mã 429 kèm thông báo quá nhiều yêu cầu', async () => {
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

  it('Đếm riêng theo từng IP: IP A chạm giới hạn không ảnh hưởng IP B', async () => {
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

describe('Giới hạn tần suất cho endpoint ghi dữ liệu nhạy cảm (30 yêu cầu mỗi 15 phút)', () => {
  it('Cho phép 30 yêu cầu đầu tiên từ một địa chỉ IP', async () => {
    const ip = '10.0.1.1';
    for (let i = 0; i < 30; i++) {
      const result = await hitLimiter(writeLimiter, ip);
      expect(result.allowed).toBe(true);
    }
  });

  it('Chặn yêu cầu thứ 31 từ cùng một IP → trả mã 429', async () => {
    const ip = '10.0.1.2';
    for (let i = 0; i < 30; i++) {
      await hitLimiter(writeLimiter, ip);
    }
    const blocked = await hitLimiter(writeLimiter, ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(429);
  });

  it('Khi bị chặn trả về thông báo tiếng Việt thân thiện với người dùng', async () => {
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
