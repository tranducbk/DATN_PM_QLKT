import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';
import { FETCH_ALL_LIMIT } from '@/lib/constants/pagination.constants';

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

export async function getAwardsTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/awards/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function importAwards(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/awards/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
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

export async function getHCCSVVTemplate(params?: Record<string, string>): Promise<Blob> {
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

export async function importHCCSVV(file: File): Promise<ApiResponse> {
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

export async function getHCCSVV(params?: {
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

export async function exportHCCSVV(params?: {
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

export async function getHCCSVVStatistics(params?: {
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

export async function deleteHCCSVV(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/tenure-medals/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createHCCSVVDirect(body: {
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

export async function getContributionAwardsTemplate(params?: Record<string, string>): Promise<Blob> {
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

export async function importContributionAwards(file: File): Promise<ApiResponse> {
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

export async function getContributionAwards(params?: {
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

export async function exportContributionAwards(params?: {
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

export async function getContributionAwardsStatistics(params?: {
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

export async function deleteContributionAward(id: string): Promise<ApiResponse> {
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
    const res = await axiosInstance.get('/api/military-flag/template', {
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
    const res = await axiosInstance.get('/api/military-flag', { params });
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
    const res = await axiosInstance.get('/api/military-flag/export', {
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
    const res = await axiosInstance.get('/api/military-flag/statistics', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteMilitaryFlag(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/military-flag/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getMilitaryFlagByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/military-flag/personnel/${personnelId}`);
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

export async function deleteUnitAnnualAward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/awards/units/annual/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnitAnnualProfile(donViId: string, year?: number): Promise<ApiResponse> {
  try {
    let url = year
      ? `/api/awards/units/annual/profile/${donViId}?year=${year}`
      : `/api/awards/units/annual/profile/${donViId}`;

    const res = await axiosInstance.get(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

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

/** Create a preview-import function for a given endpoint. */
function createPreviewImport(url: string) {
  return async (file: File): Promise<unknown> => {
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
  return async (items: unknown[]): Promise<unknown> => {
    const res = await axiosInstance.post(url, { items });
    return res.data;
  };
}

export const previewAnnualRewardsImport = createPreviewImport('/api/annual-rewards/import/preview');
export const confirmAnnualRewardsImport = createConfirmImport('/api/annual-rewards/import/confirm');

export const previewUnitAnnualAwardsImport = createPreviewImport('/api/awards/units/annual/import/preview');
export const confirmUnitAnnualAwardsImport = createConfirmImport('/api/awards/units/annual/import/confirm');

export const previewHCCSVVImport = createPreviewImport('/api/tenure-medals/import/preview');
export const confirmHCCSVVImport = createConfirmImport('/api/tenure-medals/import/confirm');

export const previewMilitaryFlagImport = createPreviewImport('/api/military-flag/import/preview');
export const confirmMilitaryFlagImport = createConfirmImport('/api/military-flag/import/confirm');

export const previewContributionAwardsImport = createPreviewImport('/api/contribution-medals/import/preview');
export const confirmContributionAwardsImport = createConfirmImport('/api/contribution-medals/import/confirm');

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
