import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';
import { FETCH_ALL_LIMIT } from '@/lib/constants/pagination.constants';

export async function getUnitAnnualAwards(params?: {
  page?: number;
  limit?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/awards/units/annual', { params });
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
    const res = await axiosInstance.get('/api/awards/units/annual/history', { params });
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
    const res = await axiosInstance.get('/api/awards/units/annual/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importUnitAnnualAwards(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/awards/units/annual/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportUnitAnnualAwards(params?: {
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/awards/units/annual/export', {
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
      ? `/api/awards/units/annual/${id}?awardType=${encodeURIComponent(awardType)}`
      : `/api/awards/units/annual/${id}`;
    const res = await axiosInstance.delete(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnitAnnualProfile(donViId: string, year?: number): Promise<ApiResponse> {
  try {
    const url = year
      ? `/api/awards/units/annual/profile/${donViId}?year=${year}`
      : `/api/awards/units/annual/profile/${donViId}`;

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

export const previewUnitAnnualAwardsImport = createPreviewImport('/api/awards/units/annual/import/preview');
export const confirmUnitAnnualAwardsImport = createConfirmImport('/api/awards/units/annual/import/confirm');
