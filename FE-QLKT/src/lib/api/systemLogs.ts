import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

/**
 * getSystemLogs API wrapper.
 * @returns API response payload
 */
export async function getSystemLogs(params?: Record<string, unknown>): Promise<any> {
  try {
    const res = await axiosInstance.get('/api/system-logs', { params });
    return { success: true, data: res.data?.data, pagination: res.data?.pagination, stats: res.data?.stats };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getSystemLogActions API wrapper.
 * @returns API response payload
 */
export async function getSystemLogActions(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/system-logs/actions');
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getSystemLogResources API wrapper.
 * @returns API response payload
 */
export async function getSystemLogResources(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/system-logs/resources');
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteSystemLogs API wrapper.
 * @returns API response payload
 */
export async function deleteSystemLogs(ids: string[]): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/system-logs', { data: { ids } });
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteAllSystemLogs API wrapper.
 * @returns API response payload
 */
export async function deleteAllSystemLogs(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/system-logs/all');
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
