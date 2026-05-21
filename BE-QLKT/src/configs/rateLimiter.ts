import rateLimit from 'express-rate-limit';

/*
 * RATE LIMITER — chống brute force + abuse, dựa trên IP.
 *
 * Cơ chế: express-rate-limit lưu counter trong memory (default) hoặc
 * Redis (production). Mỗi IP có 1 bucket counter, hết window thì reset.
 * Vượt limit → 429 Too Many Requests.
 *
 * 2 PROFILE:
 *
 * ① authLimiter — 30 fail/5 phút cho login/refresh:
 *    - skipSuccessfulRequests: TRUE → chỉ đếm request LỖI (401/400).
 *      Lý do: user gõ password đúng nhiều lần (vd: kiểm tra tab khác)
 *      KHÔNG được tính → không khoá oan.
 *    - 30 fail × 5 phút ≈ 1 attempt/10s → chậm hơn brute force script
 *      (10000/s) tới 10⁵ lần → không thể crack qua API.
 *
 * ② writeLimiter — 30 request/15 phút cho ghi DB:
 *    - Đếm cả success + fail (mặc định).
 *    - Áp dụng cho POST/PUT/DELETE tạo đề xuất, approve, import Excel.
 *    - Lý do: chặn user/bot spam tạo hàng loạt record → DB bloat + log
 *      ngập + admin không kịp duyệt.
 *
 * KHÔNG dùng cho GET endpoint vì:
 *    - Đọc không gây side-effect nguy hiểm.
 *    - User legit có thể refresh trang liên tục.
 *    - Nếu cần chống scrape → dùng CDN/WAF rate limit ở layer ngoài.
 */

/** For login/auth endpoints — only count failed requests so legit users không bị chặn */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu, thử lại sau ít phút.',
  },
  standardHeaders: true,  // gửi RateLimit-* header (RFC draft) → FE biết còn bao nhiêu
  legacyHeaders: false,   // tắt X-RateLimit-* cũ
  skipSuccessfulRequests: true, // KEY: chỉ đếm fail request
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
