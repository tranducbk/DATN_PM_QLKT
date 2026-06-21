import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import type { ApiResponse } from '@/lib/types/common';

/** Position-history mutation response with optional backend warning metadata. */
type PositionHistoryWarning = {
  message: string;
  suggestedEndDate?: string | null;
};

type PositionHistoryMutationResponse = ApiResponse & {
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
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getPersonnelById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createPersonnel(body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/personnel', body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updatePersonnel(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/personnel/${id}`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deletePersonnel(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/personnel/${id}`);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

// Position History
export async function getPositionHistory(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${personnelId}/position-history`);
    return { success: res.data?.success, data: res.data?.data };
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
      success: res.data?.success,
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
      success: res.data?.success,
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
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}


