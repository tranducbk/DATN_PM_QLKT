import axiosInstance from '@/lib/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

export type DecisionsPagination = {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

/**
 * getDecisions API wrapper.
 * @returns API response payload
 */
export async function getDecisions(params?: {
  nam?: number;
  loai_khen_thuong?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse & { pagination?: DecisionsPagination }> {
  try {
    const res = await axiosInstance.get('/api/decisions', { params });
    return {
      success: res.data?.success,
      data: res.data?.data,
      pagination: res.data?.pagination,
    };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * autocompleteDecisions API wrapper.
 * @returns API response payload
 */
export async function autocompleteDecisions(
  query: string,
  limit = 10,
  loaiKhenThuong?: string
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/decisions/autocomplete', {
      params: { q: query, limit, loai_khen_thuong: loaiKhenThuong },
    });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getDecisionBySoQuyetDinh API wrapper.
 * @returns API response payload
 */
export async function getDecisionBySoQuyetDinh(soQuyetDinh: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/decisions/by-number/${soQuyetDinh}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getDecisionById API wrapper.
 * @returns API response payload
 */
export async function getDecisionById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/decisions/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * createDecision API wrapper.
 * @returns API response payload
 */
export async function createDecision(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/decisions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * updateDecision API wrapper.
 * @returns API response payload
 */
export async function updateDecision(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/decisions/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteDecision API wrapper.
 * @returns API response payload
 */
export async function deleteDecision(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/decisions/${id}`);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * Gets a decision file path by decision number.
 * @param soQuyetDinh - Decision number
 * @returns API response containing file path and decision metadata
 */
export async function getDecisionFilePath(soQuyetDinh: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(
      `/api/decisions/file-path/${encodeURIComponent(soQuyetDinh)}`
    );
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * Downloads decision file by decision number.
 * Backend resolves the file path and returns binary content.
 * @param soQuyetDinh - Decision number
 * @returns File blob from API response
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
 * Gets decision file paths for multiple decision numbers.
 * @param soQuyetDinhs - Decision number list
 * @returns API response keyed by decision number
 */
export async function getDecisionFilePaths(soQuyetDinhs: string[]): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/decisions/file-paths', { soQuyetDinhs });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
