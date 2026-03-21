import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/notifications', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getUnreadNotificationCount(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/notifications/unread-count');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function markNotificationAsRead(id: number): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch(`/api/notifications/${id}/read`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function markAllNotificationsAsRead(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.patch('/api/notifications/read-all');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteNotification(id: number): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/notifications/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteAllNotifications(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/notifications/all');
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
