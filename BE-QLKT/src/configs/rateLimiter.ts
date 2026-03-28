import rateLimit from 'express-rate-limit';

/** For login/auth endpoints */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút',
  },
  standardHeaders: true,
  legacyHeaders: false,
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
