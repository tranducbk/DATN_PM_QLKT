import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getPersonnel(params?: {
  page?: number;
  limit?: number;
  search?: string;
  unit_id?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/personnel', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getPersonnelById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createPersonnel(body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/personnel', body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updatePersonnel(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/personnel/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deletePersonnel(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/personnel/${id}`);
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Position History
export async function getPositionHistory(personnelId: string): Promise<ApiResponse> {
  try {
    let url = `/api/personnel/${personnelId}/position-history`;
    const res = await axiosInstance.get(url);
    return { success: true, data: res.data?.data?.history || res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createPositionHistory(personnelId: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/personnel/${personnelId}/position-history`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updatePositionHistory(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/position-history/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deletePositionHistory(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/position-history/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Personnel Export/Import
export async function exportPersonnel(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/personnel/export', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function exportPersonnelSample(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/personnel/export-sample', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function importPersonnel(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/personnel/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
