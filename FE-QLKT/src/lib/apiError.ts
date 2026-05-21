/*
 * ════════════════════════════════════════════════════════════════════════════
 *  API ERROR EXTRACTION — chuẩn hoá error từ axios/fetch/Error về string
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  3 LOẠI ERROR có thể bắt được:
 *  ① AxiosError với response (server trả 4xx/5xx + body JSON):
 *       error.response.data.message  ← BE chuẩn (xem ResponseHelper.error)
 *       error.response.data.error    ← legacy
 *  ② AxiosError không có response (network fail, timeout):
 *       error.message = 'Network Error' / 'timeout of 30000ms exceeded'
 *  ③ Error thường (throw new Error(...)):
 *       error.message
 *  ④ String (throw 'message'):
 *       error trực tiếp
 *
 *  FALLBACK CHAIN:
 *  response.data.message → response.data.error → error.message → string →
 *  fallback default. Đảm bảo không bao giờ trả undefined/empty.
 *
 *  CONSOLE.ERROR luôn được log (raw error) → dev có thể inspect đầy đủ
 *  (stack, response headers) trong DevTools, nhưng user chỉ thấy message
 *  tiếng Việt friendly.
 *
 *  RETRY-AFTER (429):
 *  Backend gửi `retryAfter` (giây) trong response body của 429 (xem
 *  axiosInstance.ts response interceptor). FE component dùng để hiển thị
 *  countdown "Thử lại sau X giây" thay vì disable button vô thời hạn.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Extract user-facing message from axios/fetch/Error and log raw error to console for debugging.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi'): string {
  console.error('[API Error]', error);
  if (error && typeof error === 'object') {
    const e = error as {
      message?: string;
      response?: { data?: { message?: string; error?: string } };
    };
    const data = e.response?.data;
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    if (typeof data?.error === 'string' && data.error.trim()) return data.error;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

/**
 * Extract retry-after seconds from a 429 axios error. Null nếu không phải 429
 * hoặc không có header `retry-after`.
 */
export function getRetryAfterSeconds(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { response?: { status?: number; data?: { retryAfter?: number | null } } };
  if (e.response?.status !== 429) return null;
  const value = e.response?.data?.retryAfter;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  return null;
}

/**
 * Ghi lỗi API để dễ tra cứu theo ngữ cảnh.
 * @param error - Giá trị từ `catch`
 * @param context - Ngữ cảnh log (vd. `MainLayout.loadNotifications`)
 * @returns void
 */
export function logApiError(error: unknown, context: string): void {
  const message = getApiErrorMessage(error, 'Lỗi không xác định');
  console.error(`Lỗi API khi ${context}: ${message}`, { context, error });
}
