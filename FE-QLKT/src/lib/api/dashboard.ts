import axiosInstance from '@/lib/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types/common';

export async function getDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAdminDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/admin');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getManagerDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/manager');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
