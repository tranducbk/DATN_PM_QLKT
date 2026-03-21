import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAdminDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/admin');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getManagerDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/manager');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
