/*
 * ════════════════════════════════════════════════════════════════════════════
 *  CORS CONFIG — Cross-Origin Resource Sharing whitelist (ATTT)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  CORS là gì:
 *  Browser BLOCK request từ domain A đến domain B nếu B không khai báo
 *  cho phép A. Server phải set header `Access-Control-Allow-Origin: A`.
 *
 *  WHY WHITELIST (không Allow-Origin: *):
 *  - `*` cho phép MỌI domain → kẻ tấn công host site malicious có thể
 *    trigger user authenticated browser call API của ta.
 *  - Đặc biệt với `credentials: true` (gửi cookie/auth header) — browser
 *    REJECT nếu Allow-Origin là `*`.
 *  - Whitelist explicit: chỉ FE chính thức + dev local được phép.
 *
 *  ENV-DRIVEN:
 *  ALLOWED_ORIGINS=https://qlkt.example.com,https://staging.qlkt.example.com
 *  → comma-separated, parse 1 lần khi server start.
 *  → Dev default: localhost:3000 + 3001 (cho 2 dev cùng máy).
 *
 *  MISSING ORIGIN HEADER:
 *  `origin === undefined` xảy ra với:
 *  - Server-to-server call (Postman, curl, cron).
 *  - Same-origin request (browser không gửi Origin khi cùng domain).
 *  → ALLOW. Đây không phải cross-origin attack vector.
 *
 *  REJECTION:
 *  Callback với Error → cors lib gửi response WITHOUT Allow-Origin header
 *  → browser block phía client, server vẫn nhận request nhưng response
 *  không reach FE → an toàn.
 *
 *  ⚠️ ATTT NOTE:
 *  CORS chỉ chống abuse từ BROWSER. Kẻ tấn công dùng curl/script có thể
 *  bypass CORS hoàn toàn (CORS là policy browser, không phải server). Vì
 *  vậy CORS CHỈ là 1 lớp — auth + rate limit vẫn là defense chính.
 *
 *  SOCKET.IO CORS:
 *  Hàm allowCorsOrigin dùng chung cho cả Express và Socket.IO (xem
 *  utils/socketService.ts). Đảm bảo policy CORS nhất quán REST + WS.
 * ════════════════════════════════════════════════════════════════════════════
 */

const allowedOrigins: string[] = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

/**
 * Allowlist loaded once from `ALLOWED_ORIGINS` (comma-separated) with localhost dev defaults.
 * @returns Parsed origin strings used by `allowCorsOrigin`
 */
function getAllowedOrigins(): string[] {
  return allowedOrigins;
}

/**
 * `cors` / Socket.IO-compatible origin gate: missing `Origin` is allowed (non-browser clients).
 * @param origin - `Origin` request header
 * @param callback - `(err, allow)` as required by `cors`
 * @returns void
 */
export function allowCorsOrigin(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  const allowed = getAllowedOrigins();
  if (!origin) return callback(null, true);
  if (allowed.includes(origin)) callback(null, true);
  else callback(new Error('Not allowed by CORS'));
}
