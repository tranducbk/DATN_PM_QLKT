/**
 * Axios instance với auto-refresh token interceptor
 * Token được lưu trong httpOnly cookie (không cần manual handling)
 */
import axios from 'axios';
import { BASE_URL } from '@/configs';

// Tạo axios instance
const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Quan trọng! Để tự động gửi cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 giây timeout
});

// Request interceptor để fallback localStorage
axiosInstance.interceptors.request.use(
  config => {
    // Fallback: Nếu cookies không có, gửi token từ localStorage
    if (!document.cookie.includes('accessToken') && localStorage.getItem('accessToken')) {
      config.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor: Tự động refresh token khi 401
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Xử lý lỗi 429 (Rate Limited)
    if (error.response?.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return axiosInstance(originalRequest);
    }

    // Nếu lỗi 401 và chưa retry
    // Bỏ qua interceptor cho login request để tránh reload trang
    const isLoginRequest =
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest) {
      if (isRefreshing) {
        // Nếu đang refresh, đợi trong queue
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            // Cập nhật token cho request này nếu cần
            if (token && !document.cookie.includes('accessToken')) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosInstance(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Lấy refreshToken từ localStorage (backend hiện mong nhận trong body)
        const storedRefresh =
          typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

        if (!storedRefresh) {
          // Không có refresh token -> bắt buộc đăng nhập lại
          isRefreshing = false;
          processQueue(new Error('No refresh token available'), null);
          if (typeof window !== 'undefined') {
            localStorage.clear();
            window.location.href = '/login';
          }
          return Promise.reject(new Error('No refresh token available'));
        }

        const refreshResponse = await axiosInstance.post(
          `/api/auth/refresh`,
          { refreshToken: storedRefresh },
          {
            withCredentials: true,
            timeout: 10000,
            _retry: true, // Đánh dấu để không retry request này
          }
        );

        // Lưu token mới vào localStorage
        let newAccessToken = null;

        if (refreshResponse.data?.data?.accessToken) {
          newAccessToken = refreshResponse.data.data.accessToken;
          const newRefresh = refreshResponse.data.data.refreshToken;

          localStorage.setItem('accessToken', newAccessToken);

          // Cập nhật refresh token mới (token rotation)
          if (newRefresh) {
            localStorage.setItem('refreshToken', newRefresh);
          }
        } else if (refreshResponse.data?.accessToken) {
          // Fallback cho format response khác
          newAccessToken = refreshResponse.data.accessToken;
          const newRefresh = refreshResponse.data.refreshToken;

          localStorage.setItem('accessToken', newAccessToken);

          if (newRefresh) {
            localStorage.setItem('refreshToken', newRefresh);
          }
        }

        // Dispatch event để thông báo token đã được refresh thành công
        if (typeof window !== 'undefined' && newAccessToken) {
          window.dispatchEvent(
            new CustomEvent('tokenRefreshed', {
              detail: { accessToken: newAccessToken },
            })
          );
        }

        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Cập nhật token cho request hiện tại
        if (newAccessToken && !document.cookie.includes('accessToken')) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('Refresh token failed:', refreshError);
        processQueue(refreshError, null);
        isRefreshing = false;

        if (typeof window !== 'undefined') {
          localStorage.clear();
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
