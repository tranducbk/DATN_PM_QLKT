import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import type { ApiResponse } from '@/lib/types/common';
import { FETCH_ALL_LIMIT } from '@/constants/pagination.constants';

export async function getUnitAnnualAwards(params?: {
  page?: number;
  limit?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/unit-annual-awards', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnitAnnualAwardsByUnit(
  donViId: string,
  year?: number
): Promise<ApiResponse> {
  try {
    const params: Record<string, string | number> = { don_vi_id: donViId, limit: FETCH_ALL_LIMIT };
    if (year) params.year = year;
    const res = await axiosInstance.get('/api/unit-annual-awards/history', { params });
    return {
      success: res.data?.success,
      data: res.data?.data,
    };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnitAnnualAwardsTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/unit-annual-awards/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function exportUnitAnnualAwards(params?: {
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/unit-annual-awards/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteUnitAnnualAward(id: string, awardType?: string): Promise<ApiResponse> {
  try {
    const url = awardType
      ? `/api/unit-annual-awards/${id}?awardType=${encodeURIComponent(awardType)}`
      : `/api/unit-annual-awards/${id}`;
    const res = await axiosInstance.delete(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnitAnnualProfile(donViId: string, year?: number): Promise<ApiResponse> {
  try {
    const url = year
      ? `/api/unit-annual-awards/profile/${donViId}?year=${year}`
      : `/api/unit-annual-awards/profile/${donViId}`;

    const res = await axiosInstance.get(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/** Create a preview-import function for a given endpoint. */
function createPreviewImport(url: string) {
  return async (file: File): Promise<ApiResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  };
}

/** Create a confirm-import function for a given endpoint. */
function createConfirmImport(url: string) {
  return async (items: unknown[]): Promise<ApiResponse> => {
    const res = await axiosInstance.post(url, { items });
    return res.data;
  };
}

export const previewUnitAnnualAwardsImport = createPreviewImport('/api/unit-annual-awards/import/preview');
export const confirmUnitAnnualAwardsImport = createConfirmImport('/api/unit-annual-awards/import/confirm');
