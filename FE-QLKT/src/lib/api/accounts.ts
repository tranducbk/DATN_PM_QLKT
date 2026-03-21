import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getAccounts(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/accounts', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAccountById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/accounts/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updateAccount(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/accounts/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createAccount(body: {
  username: string;
  password: string;
  role: string;
  co_quan_don_vi_id?: string;
  don_vi_truc_thuoc_id?: string;
  chuc_vu_id?: string;
  personnel_id?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/accounts', body);
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    const errorMessage =
      e?.response?.data?.message || e?.message || 'Có lỗi xảy ra khi tạo tài khoản';
    return { success: false, message: errorMessage };
  }
}

export async function deleteAccount(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/accounts/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function resetAccountPassword(accountId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/accounts/reset-password', {
      account_id: accountId,
    });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
