import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function login(username: string, password: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/auth/login', {
      username,
      password,
    });
    return {
      success: true,
      data: res.data?.data || res.data,
      message: res.data?.message,
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.response?.data?.message || e?.response?.data?.error || e.message,
    };
  }
}

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/auth/change-password', {
      oldPassword,
      newPassword,
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
