import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

/**
 * getAccounts API wrapper.
 * @returns API response payload
 */
export async function getAccounts(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse & { pagination?: { total: number; page: number; limit: number; totalPages: number } }> {
  try {
    const res = await axiosInstance.get('/api/accounts', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getAccountById API wrapper.
 * @returns API response payload
 */
export async function getAccountById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/accounts/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * updateAccount API wrapper.
 * @returns API response payload
 */
export async function updateAccount(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/accounts/${id}`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/** Account creation payload aligned with backend `/api/accounts` fields. */
export type CreateAccountBody = {
  username: string;
  password: string;
  role: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
  personnel_id?: string;
};

/**
 * createAccount API wrapper.
 * @returns API response payload
 */
export async function createAccount(body: CreateAccountBody): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/accounts', body);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e, 'Có lỗi xảy ra khi tạo tài khoản') };
  }
}

/**
 * deleteAccount API wrapper.
 * @returns API response payload
 */
export async function deleteAccount(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/accounts/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * resetAccountPassword API wrapper.
 * @returns API response payload
 */
export async function resetAccountPassword(accountId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/accounts/reset-password', {
      account_id: accountId,
    });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
