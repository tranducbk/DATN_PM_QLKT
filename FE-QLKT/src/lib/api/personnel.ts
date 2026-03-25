import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

/** Phản hồi cập nhật/tạo lịch sử chức vụ — backend có thể kèm cảnh báo ngày kết thúc */
export type PositionHistoryWarning = {
  message: string;
  suggestedEndDate?: string | null;
};

export type PositionHistoryMutationResponse = ApiResponse & {
  warning?: PositionHistoryWarning;
};

export async function getPersonnel(params?: {
  page?: number;
  limit?: number;
  search?: string;
  unit_id?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/personnel', { params });
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getPersonnelById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${id}`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createPersonnel(body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/personnel', body);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updatePersonnel(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/personnel/${id}`, body);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deletePersonnel(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/personnel/${id}`);
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

// Position History
export async function getPositionHistory(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${personnelId}/position-history`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createPositionHistory(
  personnelId: string,
  body: Record<string, unknown>
): Promise<PositionHistoryMutationResponse> {
  try {
    const res = await axiosInstance.post(`/api/personnel/${personnelId}/position-history`, body);
    return {
      success: true,
      data: res.data?.data,
      warning: res.data?.warning,
    };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updatePositionHistory(
  id: string,
  body: Record<string, unknown>
): Promise<PositionHistoryMutationResponse> {
  try {
    const res = await axiosInstance.put(`/api/position-history/${id}`, body);
    return {
      success: true,
      data: res.data?.data,
      warning: res.data?.warning,
    };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deletePositionHistory(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/position-history/${id}`);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

// Personnel Export/Import
export async function exportPersonnel(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/personnel/export', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function exportPersonnelSample(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/personnel/export-sample', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
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
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
