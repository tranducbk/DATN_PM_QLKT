import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

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
    const res = await axiosInstance.get(`/api/annual-rewards/check-hcqkqt/${personnelId}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function checkKNCVSNXDQDNDVN(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/annual-rewards/check-knc-vsnxd/${personnelId}`);
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

export async function createAnnualReward(
  personnelId: string,
  body: Record<string, unknown>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/personnel/${personnelId}/annual-rewards`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updateAnnualReward(
  id: string,
  body: Record<string, unknown>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/annual-rewards/${id}`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteAnnualReward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/annual-rewards/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function checkAnnualRewards(body: {
  personnel_ids: string[] | number[];
  nam: number;
  danh_hieu: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/annual-rewards/check', body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function bulkCreateAnnualRewards(body: {
  personnel_ids: string[] | number[];
  personnel_rewards_data?: Array<{
    personnel_id: string;
    so_quyet_dinh?: string;
    cap_bac?: string;
    chuc_vu?: string;
  }>;
  nam: number;
  danh_hieu: string;
  so_quyet_dinh?: string;
  cap_bac?: string;
  chuc_vu?: string;
  ghi_chu?: string;
  file_dinh_kem?: File;
}): Promise<ApiResponse> {
  try {
    if (body.file_dinh_kem) {
      const formData = new FormData();
      formData.append('personnel_ids', JSON.stringify(body.personnel_ids));
      if (body.personnel_rewards_data) {
        formData.append('personnel_rewards_data', JSON.stringify(body.personnel_rewards_data));
      }
      formData.append('nam', body.nam.toString());
      formData.append('danh_hieu', body.danh_hieu);
      if (body.so_quyet_dinh) {
        formData.append('so_quyet_dinh', body.so_quyet_dinh);
      }
      if (body.cap_bac) {
        formData.append('cap_bac', body.cap_bac);
      }
      if (body.chuc_vu) {
        formData.append('chuc_vu', body.chuc_vu);
      }
      if (body.ghi_chu) {
        formData.append('ghi_chu', body.ghi_chu);
      }
      formData.append('file_dinh_kem', body.file_dinh_kem);

      const res = await axiosInstance.post('/api/annual-rewards/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
    }

    const jsonBody: Record<string, unknown> = {
      personnel_ids: body.personnel_ids,
      nam: body.nam,
      danh_hieu: body.danh_hieu,
    };
    if (body.personnel_rewards_data) {
      jsonBody.personnel_rewards_data = body.personnel_rewards_data;
    }
    if (body.so_quyet_dinh) jsonBody.so_quyet_dinh = body.so_quyet_dinh;
    if (body.cap_bac) jsonBody.cap_bac = body.cap_bac;
    if (body.chuc_vu) jsonBody.chuc_vu = body.chuc_vu;
    if (body.ghi_chu) jsonBody.ghi_chu = body.ghi_chu;

    const res = await axiosInstance.post('/api/annual-rewards/bulk', jsonBody);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
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

export const previewAnnualRewardsImport = createPreviewImport('/api/annual-rewards/import/preview');
export const confirmAnnualRewardsImport = createConfirmImport('/api/annual-rewards/import/confirm');
