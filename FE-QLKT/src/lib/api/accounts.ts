import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getAccounts(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/accounts', { params });
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAccountById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/accounts/${id}`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updateAccount(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/accounts/${id}`, body);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/** Payload tạo tài khoản — trùng field backend `/api/accounts` */
export type CreateAccountBody = {
  username: string;
  password: string;
  role: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
  personnel_id?: string;
};

export async function createAccount(body: CreateAccountBody): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/accounts', body);
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e, 'Có lỗi xảy ra khi tạo tài khoản') };
  }
}

export async function deleteAccount(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/accounts/${id}`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function resetAccountPassword(accountId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/accounts/reset-password', {
      account_id: accountId,
    });
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
