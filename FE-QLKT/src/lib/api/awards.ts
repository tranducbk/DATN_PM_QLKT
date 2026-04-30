import axiosInstance from '@/lib/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types/common';

export * from './annualAwards';
export * from './unitAnnualAwards';
export * from './adhocAwards';

export async function getPersonnelScientificAchievements(
  personnelId: string
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${personnelId}/scientific-achievements`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getScientificAchievements(params?: {
  page?: number;
  limit?: number;
  nam?: number;
  loai?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/scientific-achievements', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createScientificAchievement(
  personnelId: string,
  body: Record<string, unknown>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(
      `/api/personnel/${personnelId}/scientific-achievements`,
      body
    );
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updateScientificAchievement(
  id: string,
  body: Record<string, unknown>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/scientific-achievements/${id}`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteScientificAchievement(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/scientific-achievements/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportScientificAchievements(params?: {
  nam?: number;
  loai?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/scientific-achievements/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getScientificAchievementsTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/scientific-achievements/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importScientificAchievements(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/scientific-achievements/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAwards(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/awards', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportAwards(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/awards/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getTenureMedalsTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/tenure-medals/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importTenureMedals(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/tenure-medals/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getTenureMedals(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/tenure-medals', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportTenureMedals(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/tenure-medals/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getTenureMedalsStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/tenure-medals/statistics', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteTenureMedal(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/tenure-medals/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createTenureMedalDirect(body: {
  quan_nhan_id: string;
  danh_hieu: string;
  nam: number;
  cap_bac?: string;
  chuc_vu?: string;
  so_quyet_dinh?: string;
  ghi_chu?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/tenure-medals', body);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getContributionMedalsTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/contribution-medals/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importContributionMedals(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/contribution-medals/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getContributionMedals(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/contribution-medals', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportContributionMedals(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/contribution-medals/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getContributionMedalsStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/contribution-medals/statistics', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteContributionMedal(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/contribution-medals/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getCommemorationMedalsTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/commemorative-medals/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importCommemorationMedals(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/commemorative-medals/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getCommemorationMedals(params?: {
  don_vi_id?: number;
  nam?: number;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/commemorative-medals', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportCommemorationMedals(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/commemorative-medals/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getCommemorationMedalsStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/commemorative-medals/statistics', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteCommemorationMedal(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/commemorative-medals/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getMilitaryFlagTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/military-flags/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getMilitaryFlag(params?: {
  don_vi_id?: number;
  nam?: number;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/military-flags', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportMilitaryFlag(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/military-flags/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function getMilitaryFlagStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/military-flags/statistics', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteMilitaryFlag(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/military-flags/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getMilitaryFlagByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/military-flags/personnel/${personnelId}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getCommemorationMedalsByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/commemorative-medals/personnel/${personnelId}`);
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

export const previewTenureMedalsImport = createPreviewImport('/api/tenure-medals/import/preview');
export const confirmTenureMedalsImport = createConfirmImport('/api/tenure-medals/import/confirm');

export const previewMilitaryFlagImport = createPreviewImport('/api/military-flags/import/preview');
export const confirmMilitaryFlagImport = createConfirmImport('/api/military-flags/import/confirm');

export const previewContributionMedalsImport = createPreviewImport('/api/contribution-medals/import/preview');
export const confirmContributionMedalsImport = createConfirmImport('/api/contribution-medals/import/confirm');

export const previewCommemorationMedalsImport = createPreviewImport('/api/commemorative-medals/import/preview');
export const confirmCommemorationMedalsImport = createConfirmImport('/api/commemorative-medals/import/confirm');

export const previewScientificAchievementsImport = createPreviewImport('/api/scientific-achievements/import/preview');
export const confirmScientificAchievementsImport = createConfirmImport('/api/scientific-achievements/import/confirm');

export async function bulkCreateAwards(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/awards/bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
