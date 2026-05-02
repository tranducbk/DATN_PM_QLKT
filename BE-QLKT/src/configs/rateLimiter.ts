import rateLimit from 'express-rate-limit';

/** For login/auth endpoints — only count failed requests so legit users không bị chặn */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu, thử lại sau ít phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/** For sensitive write operations */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
