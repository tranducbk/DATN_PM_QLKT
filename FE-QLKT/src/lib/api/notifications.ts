import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

/**
 * Một bản ghi thông báo (bảng `notifications` / model ThongBao).
 * Trên BE: `id` là `Int` (autoincrement) → JSON là **number**, không phải string cuid.
 */
export type NotificationItem = {
  /** Prisma `ThongBao.id` là Int → luôn là number khi có (API / socket đầy đủ) */
  id?: number;
  title?: string;
  message?: string;
  is_read?: boolean;
  created_at?: string;
  link?: string | null;
  type?: string;
};

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/notifications', { params });
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnreadNotificationCount(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/notifications/unread-count');
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function markNotificationAsRead(id: number): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch(`/api/notifications/${id}/read`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function markAllNotificationsAsRead(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch('/api/notifications/read-all');
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteNotification(id: number): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/notifications/${id}`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteAllNotifications(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/notifications/all');
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
