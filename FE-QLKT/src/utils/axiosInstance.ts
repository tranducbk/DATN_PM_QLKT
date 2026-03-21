import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { BASE_URL } from '@/configs';

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Gắn token từ localStorage nếu không có cookie
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
    localStorage.clear();
    window.location.href = '/login';
  }
}

function extractTokens(data: Record<string, any>): {
  accessToken: string | null;
  refreshToken: string | null;
} {
  const nested = data?.data;
  return {
    accessToken: nested?.accessToken || data?.accessToken || null,
    refreshToken: nested?.refreshToken || data?.refreshToken || null,
  };
}

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    // Rate limit → retry sau 1s
    if (status === 429) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return axiosInstance(originalRequest);
    }

    const isAuthRequest =
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/refresh');
    const isDevZoneRequest = originalRequest?.url?.includes('/api/dev-zone');

    // Refresh request fail → force logout ngay
    if (status === 401 && originalRequest?.url?.includes('/api/auth/refresh')) {
      isRefreshing = false;
      processQueue(error, null);
      forceLogout();
      return Promise.reject(error);
    }

    // 401 từ API thường → cố refresh token
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
        const storedRefresh = localStorage.getItem('refreshToken');
        if (!storedRefresh) {
          isRefreshing = false;
          processQueue(new Error('No refresh token'), null);
          forceLogout();
          return Promise.reject(new Error('No refresh token'));
        }

        const refreshResponse = await axiosInstance.post('/api/auth/refresh', {
          refreshToken: storedRefresh,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = extractTokens(
          refreshResponse.data
        );

        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
          if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);

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

    // Hiển thị lỗi toàn cục (trừ 401 và 429)
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
