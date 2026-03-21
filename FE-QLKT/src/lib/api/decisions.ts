import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getDecisions(params?: {
  nam?: number;
  loai_khen_thuong?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse & { pagination?: any }> {
  try {
    const res = await axiosInstance.get('/api/decisions', { params });
    // Backend trả về: { success: true, data: [...], pagination: {...} }
    return {
      success: true,
      data: res.data?.data || res.data,
      pagination: res.data?.pagination,
    };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function autocompleteDecisions(query: string, limit = 10): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/decisions/autocomplete', {
      params: { q: query, limit },
    });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getDecisionBySoQuyetDinh(soQuyetDinh: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/decisions/by-number/${soQuyetDinh}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getDecisionById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/decisions/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createDecision(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/decisions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updateDecision(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/decisions/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteDecision(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/decisions/${id}`);
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

/**
 * Lấy file path từ số quyết định
 * @param soQuyetDinh - Số quyết định
 * @returns { success: boolean, data: { file_path: string, decision: object } }
 */
export async function getDecisionFilePath(soQuyetDinh: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(
      `/api/decisions/file-path/${encodeURIComponent(soQuyetDinh)}`
    );
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

/**
 * Tải file quyết định theo số quyết định
 * Backend tự động query DB để lấy file path và trả về file để download
 * @param soQuyetDinh - Số quyết định
 */
export async function downloadDecisionFile(soQuyetDinh: string): Promise<Blob> {
  const res = await axiosInstance.get(
    `/api/decisions/download/${encodeURIComponent(soQuyetDinh)}`,
    {
      responseType: 'blob',
    }
  );
  return res.data;
}

/**
 * Lấy file paths từ nhiều số quyết định
 * @param soQuyetDinhs - Mảng các số quyết định
 * @returns { success: boolean, data: { [soQD]: { success, file_path, decision, error } } }
 */
export async function getDecisionFilePaths(soQuyetDinhs: string[]): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/decisions/file-paths', { soQuyetDinhs });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
