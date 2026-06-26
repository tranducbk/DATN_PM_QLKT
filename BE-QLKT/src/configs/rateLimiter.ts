import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { writeSystemLog } from '../helpers/systemLogHelper';
import { AUDIT_ACTIONS } from '../constants/auditActions.constants';

/*
 * RATE LIMITER — chống brute force + abuse, dựa trên IP.
 *
 * Cơ chế: express-rate-limit lưu counter trong memory (default) hoặc
 * Redis (production). Mỗi IP có 1 bucket counter, hết window thì reset.
 * Vượt limit → 429 Too Many Requests.
 *
 * KHÁC bản trước: thay vì để express-rate-limit tự trả `message` mặc định,
 * giờ dùng custom handler (makeRateLimitHandler) vừa GHI system log lúc bị
 * chặn, vừa trả về cùng body 429. Nhờ vậy admin thấy được IP/tài khoản nào
 * đang spam để xử lý.
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

interface RateLimitMessage {
  success: boolean;
  message: string;
}

// Body 429 trả về cho client khi vượt ngưỡng (tách riêng cho auth vs write).
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
  // Bỏ querystring (?a=b) rồi tách path thành các segment, loại bỏ phần rỗng.
  const parts = (req.originalUrl || '').split('?')[0].split('/').filter(Boolean);
  const apiIdx = parts.indexOf('api'); // tìm vị trí segment 'api' trong path
  // Lấy segment NGAY SAU 'api' làm tên resource (vd /api/proposals → 'proposals');
  // không có 'api' thì lấy segment đầu, bí quá thì fallback 'rate-limit'.
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
    // express-rate-limit gắn sẵn object rateLimit (limit, used) vào req sau khi đếm.
    const info = (req as Request & { rateLimit?: { limit: number; used: number } }).rateLimit;
    // Chỉ log đúng request ĐẦU TIÊN vượt ngưỡng (used === limit + 1) trong mỗi
    // window, tránh đổ hàng loạt log khi bị spam dồn dập trong cùng cửa sổ.
    if (!info || info.used === info.limit + 1) {
      void writeSystemLog({
        userId: req.user?.id, // ai gây ra (nếu đã đăng nhập)
        userRole: req.user?.role,
        action: AUDIT_ACTIONS.RATE_LIMIT, // đánh dấu đây là log loại "vượt giới hạn"
        resource: resourceFromReq(req), // endpoint bị spam, suy ra từ URL
        description: `Quá giới hạn yêu cầu: ${req.method} ${req.originalUrl} từ IP ${req.ip ?? 'không rõ'}`,
      });
    }
    res.status(429).json(message); // trả 429 Too Many Requests kèm body cảnh báo
  };

/** For login/auth endpoints — only count failed requests so legit users are not blocked */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // cửa sổ 5 phút
  max: 30, // tối đa 30 lần FAIL / 5 phút / IP trước khi chặn
  standardHeaders: true, // gửi RateLimit-* header (RFC draft) → FE biết còn bao nhiêu lượt
  legacyHeaders: false, // tắt X-RateLimit-* cũ
  skipSuccessfulRequests: true, // KEY: chỉ đếm fail request → không khoá oan user gõ đúng
  handler: makeRateLimitHandler(AUTH_MESSAGE),
});

/** For sensitive write operations */
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // cửa sổ 15 phút
  max: 30, // tối đa 30 request ghi / 15 phút / IP (đếm cả thành công lẫn thất bại)
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeRateLimitHandler(WRITE_MESSAGE),
});
