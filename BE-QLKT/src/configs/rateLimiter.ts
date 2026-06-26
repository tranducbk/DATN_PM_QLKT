import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

interface RateLimitMessage {
  success: boolean;
  message: string;
}

const AUTH_MESSAGE: RateLimitMessage = {
  success: false,
  message: 'Quá nhiều yêu cầu, thử lại sau ít phút.',
};

const WRITE_MESSAGE: RateLimitMessage = {
  success: false,
  message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
};

/** Resolves the affected resource slug from the request path (the segment after /api/). */
const resourceFromReq = (req: Request): string => {
  const parts = (req.originalUrl || '').split('?')[0].split('/').filter(Boolean);
  const apiIdx = parts.indexOf('api');
  return (apiIdx >= 0 ? parts[apiIdx + 1] : parts[0]) || 'rate-limit';
};

/**
 * Builds a rate-limit handler that records a system log on the first breach of each
 * window (subsequent blocked requests in the same window are not re-logged, to avoid
 * flooding the audit trail during a burst) and returns the standard 429 response.
 */
const makeRateLimitHandler =
  (message: RateLimitMessage) =>
  (req: Request, res: Response): void => {
    const info = (req as Request & { rateLimit?: { limit: number; used: number } }).rateLimit;
    if (!info || info.used === info.limit + 1) {
      void writeSystemLog({
        userId: req.user?.id,
        userRole: req.user?.role,
        action: AUDIT_ACTIONS.RATE_LIMIT,
        resource: resourceFromReq(req),
        description: `Quá giới hạn yêu cầu: ${req.method} ${req.originalUrl} từ IP ${req.ip ?? 'không rõ'}`,
      });
    }
    res.status(429).json(message);
  };

/** For login/auth endpoints — only count failed requests so legit users are not blocked */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: makeRateLimitHandler(AUTH_MESSAGE),
});

/** For sensitive write operations */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler(WRITE_MESSAGE),
});
