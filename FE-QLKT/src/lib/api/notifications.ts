/*
 * ════════════════════════════════════════════════════════════════════════════
 *  API NOTIFICATIONS — lớp wrapper gọi API thông báo của FE
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  Mỗi hàm bọc 1 endpoint REST của BE (/api/notifications/*), trả về kiểu
 *  thống nhất ApiResponse<T>. Các hàm:
 *    - getNotifications:            lấy danh sách (có phân trang + lọc đã đọc/loại)
 *    - getUnreadNotificationCount:  đếm số thông báo chưa đọc (badge ở chuông)
 *    - markNotificationAsRead:      đánh dấu 1 thông báo đã đọc
 *    - markAllNotificationsAsRead:  đánh dấu tất cả đã đọc
 *    - deleteNotification:          xóa 1 thông báo
 *    - deleteAllNotifications:      xóa tất cả thông báo
 *
 *  Mọi hàm theo cùng pattern try/catch: thành công trả {success, data, ...};
 *  lỗi thì nuốt exception và trả {success:false, message} với message tiếng
 *  Việt đã chuẩn hóa qua getApiErrorMessage — caller không cần tự try/catch,
 *  chỉ cần kiểm tra res.success. Vì sao thống nhất shape thay vì throw? Để
 *  component gọi xử lý lỗi đồng nhất (hiện message.error) mà không vỡ UI.
 * ════════════════════════════════════════════════════════════════════════════
 */

import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import type { ApiResponse } from '@/lib/types/common';

export type NotificationItem = {
  id?: string;
  title?: string;
  message?: string;
  is_read?: boolean;
  createdAt?: string;
  link?: string | null;
  type?: string;
};

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

export async function getUnreadNotificationCount(): Promise<ApiResponse<{ count: number }>> {
  try {
    const res = await axiosInstance.get('/api/notifications/unread-count');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function markNotificationAsRead(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch(`/api/notifications/${id}/read`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function markAllNotificationsAsRead(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch('/api/notifications/read-all');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteAllNotifications(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/notifications/all');
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
