import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import type { ApiResponse } from '@/lib/types/common';
import { createPreviewImport, createConfirmImport } from './importFactory';

export async function getAnnualRewards(params?: {
  page?: number;
  limit?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/annual-rewards', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAnnualRewardsByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${personnelId}/annual-rewards`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAnnualRewardsTemplate(params?: Record<string, string>): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/annual-rewards/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importAnnualRewards(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/annual-rewards/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function checkHCQKQT(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/military-flags/check-received/${personnelId}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function checkKNCVSNXDQDNDVN(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/commemorative-medals/check-received/${personnelId}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function checkContributionEligibility(personnelIds: string[]): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/personnel/check-contribution-eligibility', {
      personnel_ids: personnelIds,
    });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function exportAnnualRewards(params?: {
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/annual-rewards/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteAnnualReward(id: string, awardType?: string): Promise<ApiResponse> {
  try {
    const url = awardType
      ? `/api/annual-rewards/${id}?awardType=${encodeURIComponent(awardType)}`
      : `/api/annual-rewards/${id}`;
    const res = await axiosInstance.delete(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export const previewAnnualRewardsImport = createPreviewImport('/api/annual-rewards/import/preview');
export const confirmAnnualRewardsImport = createConfirmImport('/api/annual-rewards/import/confirm');
