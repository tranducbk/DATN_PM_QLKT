import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

/**
 * login API wrapper.
 * @returns API response payload
 */
export async function login(username: string, password: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/auth/login', {
      username,
      password,
    });
    return {
      success: true,
      data: res.data?.data,
      message: res.data?.message,
    };
  } catch (e: unknown) {
    return {
      success: false,
      message: getApiErrorMessage(e),
    };
  }
}

/**
 * changePassword API wrapper.
 * @returns API response payload
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/auth/change-password', {
      oldPassword,
      newPassword,
    });
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
