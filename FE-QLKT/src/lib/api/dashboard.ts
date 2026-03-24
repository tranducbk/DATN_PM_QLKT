import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAdminDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/admin');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getManagerDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/manager');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
