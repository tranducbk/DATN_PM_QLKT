import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

export async function getAdhocAwards(params?: {
  type?: 'CA_NHAN' | 'TAP_THE';
  year?: number;
  personnelId?: string;
  unitId?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/adhoc-awards', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAdhocAwardById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/adhoc-awards/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createAdhocAward(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/adhoc-awards', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updateAdhocAward(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/adhoc-awards/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteAdhocAward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/adhoc-awards/${id}`);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAdhocAwardsByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/adhoc-awards/personnel/${personnelId}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAdhocAwardsByUnit(
  unitId: string,
  unitType: 'CO_QUAN_DON_VI' | 'DON_VI_TRUC_THUOC'
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/adhoc-awards/unit/${unitId}`, {
      params: { unitType },
    });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
