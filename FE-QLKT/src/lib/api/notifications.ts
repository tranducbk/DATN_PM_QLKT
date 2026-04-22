import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

export type NotificationItem = {
  id?: string;
  title?: string;
  message?: string;
  is_read?: boolean;
  createdAt?: string;
  link?: string | null;
  type?: string;
};

/**
 * getNotifications API wrapper.
 * @returns API response payload
 */
export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}): Promise<ApiResponse<NotificationItem[]>> {
  try {
    const res = await axiosInstance.get('/api/notifications', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getUnreadNotificationCount API wrapper.
 * @returns API response payload
 */
export async function getUnreadNotificationCount(): Promise<ApiResponse<{ count: number }>> {
  try {
    const res = await axiosInstance.get('/api/notifications/unread-count');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * markNotificationAsRead API wrapper.
 * @returns API response payload
 */
export async function markNotificationAsRead(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch(`/api/notifications/${id}/read`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * markAllNotificationsAsRead API wrapper.
 * @returns API response payload
 */
export async function markAllNotificationsAsRead(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch('/api/notifications/read-all');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteNotification API wrapper.
 * @returns API response payload
 */
export async function deleteNotification(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/notifications/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteAllNotifications API wrapper.
 * @returns API response payload
 */
export async function deleteAllNotifications(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/notifications/all');
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
