import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getSystemLogs(params?: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/system-logs', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getSystemLogActions(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/system-logs/actions');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getSystemLogResources(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/system-logs/resources');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteSystemLogs(ids: string[]): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/system-logs', { data: { ids } });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteAllSystemLogs(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete('/api/system-logs/all');
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
