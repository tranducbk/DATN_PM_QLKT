import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL } from '@/configs';
import { clearAuthStorage } from '@/lib/http/authStorage';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  AXIOS INSTANCE — interceptor đa năng (auth, refresh, rate limit)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  3 LAYER INTERCEPTOR:
 *
 *  ① REQUEST: attach Bearer token nếu KHÔNG có cookie (fallback localStorage).
 *     Cookie httpOnly an toàn hơn nhưng FE không đọc được → cần fallback
 *     để dev/test ở môi trường không có cookie.
 *
 *  ② RESPONSE 429 (rate limit): parse Retry-After header, format message
 *     thân thiện ("thử lại sau 30 giây / 2 phút"), KHÔNG auto-retry (window
 *     rate limit là phút → retry loop = burn quota).
 *
 *  ③ RESPONSE 401 (token expired): tự động refresh + retry request gốc.
 *     Đây là phần PHỨC TẠP NHẤT — xem chi tiết bên dưới.
 *
 *  ─── REFRESH TOKEN FLOW (race-safe) ─────────────────────────────────────
 *
 *  VẤN ĐỀ: nhiều request song song cùng nhận 401:
 *      req1 → 401 → trigger refresh
 *      req2 → 401 → trigger refresh (TRÙNG — refresh 2 lần lãng phí)
 *      req3 → 401 → trigger refresh (lại trùng)
 *
 *  GIẢI PHÁP: SINGLE-FLIGHT pattern qua biến module-scope:
 *      let isRefreshing = false;
 *      let failedQueue = [];
 *
 *  Flow:
 *      1. req1 nhận 401 → set isRefreshing=true → gọi /refresh.
 *      2. req2 nhận 401 → isRefreshing=true → enqueue {resolve, reject}.
 *      3. req3 nhận 401 → isRefreshing=true → enqueue.
 *      4. /refresh trả về:
 *         - Success: processQueue(null, newToken) → req2, req3 resume với
 *                    token mới, retry request gốc.
 *         - Fail: processQueue(err, null) → req2, req3 reject → forceLogout.
 *      5. set isRefreshing=false.
 *
 *  `_retry: true` flag chống infinite loop: nếu sau refresh request retry
 *  VẪN nhận 401 → KHÔNG refresh nữa → reject thẳng.
 *
 *  ─── EDGE CASES ─────────────────────────────────────────────────────────
 *
 *  - URL '/api/auth/login' và '/refresh' SKIP refresh logic (đang login
 *    thì refresh làm gì).
 *  - URL '/api/dev-zone' SKIP refresh (dev tool, không cần auto-refresh).
 *  - Refresh request CHÍNH NÓ nhận 401 → forceLogout ngay (refresh token
 *    đã hết hạn / không hợp lệ).
 *
 *  - SSR (typeof window === 'undefined'): không có window/localStorage →
 *    skip token attach + skip forceLogout (Next.js server-side render).
 * ════════════════════════════════════════════════════════════════════════════
 */

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach token from localStorage if no cookie is present
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!document.cookie.includes('accessToken') && localStorage.getItem('accessToken')) {
      config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> =
  [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(prom => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
};

function forceLogout() {
  if (typeof window !== 'undefined') {
    clearAuthStorage();
    window.location.href = '/login';
  }
}

function extractTokens(data: Record<string, any>): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  return {
    accessToken: data?.data?.accessToken ?? null,
    refreshToken: data?.data?.refreshToken ?? null,
  };
}

function formatRateLimitMessage(baseMessage: string | undefined, seconds: number | null): string {
  const fallback = 'Quá nhiều yêu cầu, vui lòng thử lại sau.';
  if (seconds == null || Number.isNaN(seconds)) return baseMessage || fallback;
  if (seconds <= 0) return 'Đã hết thời gian chờ, vui lòng thử lại.';
  if (seconds < 60) return `Quá nhiều yêu cầu, vui lòng thử lại sau ${seconds} giây.`;
  const minutes = Math.ceil(seconds / 60);
  return `Quá nhiều yêu cầu, vui lòng thử lại sau ${minutes} phút.`;
}

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    const isAuthRequest =
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/refresh');
    const isDevZoneRequest = originalRequest?.url?.includes('/api/dev-zone');

    // 429 retry-after windows are minute-scale; auto-retrying every 1s creates an infinite loop.
    if (status === 429) {
      const retryAfterRaw = error.response?.headers?.['retry-after'];
      const retrySeconds =
        typeof retryAfterRaw === 'string' && retryAfterRaw.trim() !== ''
          ? parseInt(retryAfterRaw, 10)
          : null;
      const baseMsg = error.response?.data?.message;
      const formatted = formatRateLimitMessage(baseMsg, retrySeconds);
      if (error.response?.data && typeof error.response.data === 'object') {
        const data = error.response.data as { message?: string; retryAfter?: number | null };
        data.message = formatted;
        data.retryAfter = retrySeconds;
      }
      if (!isAuthRequest && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('apiError', {
            detail: { message: formatted, status, retryAfter: retrySeconds },
          })
        );
      }
      return Promise.reject(error);
    }

    // Refresh request fail → force logout ngay
    if (status === 401 && originalRequest?.url?.includes('/api/auth/refresh')) {
      isRefreshing = false;
      processQueue(error, null);
      forceLogout();
      return Promise.reject(error);
    }

    // 401 on a regular API call — attempt token refresh
    if (status === 401 && !originalRequest._retry && !isAuthRequest && !isDevZoneRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            if (token && !document.cookie.includes('accessToken')) {
              originalRequest.headers = {
                ...originalRequest.headers,
                Authorization: `Bearer ${token}`,
              };
            }
            return axiosInstance(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token lives in an httpOnly cookie sent automatically (withCredentials).
        const refreshResponse = await axiosInstance.post('/api/auth/refresh');

        const { accessToken: newAccessToken } = extractTokens(refreshResponse.data);

        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);

          window.dispatchEvent(
            new CustomEvent('tokenRefreshed', { detail: { accessToken: newAccessToken } })
          );
        }

        processQueue(null, newAccessToken);
        isRefreshing = false;

        if (newAccessToken && !document.cookie.includes('accessToken')) {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newAccessToken}`,
          };
        }

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        forceLogout();
        return Promise.reject(refreshError);
      }
    }

    // Show global error for all statuses except 401 (handled above) and 429
    if (status && status !== 401 && status !== 429) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.errors?.join(', ') ||
        'Đã xảy ra lỗi. Vui lòng thử lại.';

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('apiError', { detail: { message: errorMsg, status } })
        );
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
