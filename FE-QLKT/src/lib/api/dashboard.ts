import axiosInstance from '@/lib/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

/**
 * getDashboardStatistics API wrapper.
 * @returns API response payload
 */
export async function getDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getAdminDashboardStatistics API wrapper.
 * @returns API response payload
 */
export async function getAdminDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/admin');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getManagerDashboardStatistics API wrapper.
 * @returns API response payload
 */
export async function getManagerDashboardStatistics(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/dashboard/statistics/manager');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
