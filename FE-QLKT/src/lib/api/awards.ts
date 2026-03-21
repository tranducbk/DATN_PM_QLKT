import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

// Annual Rewards
export async function getAnnualRewards(params?: {
  page?: number;
  limit?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/annual-rewards', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAnnualRewardsByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${personnelId}/annual-rewards`);
    return { success: true, data: res.data?.data?.rewards || res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAnnualRewardsTemplate(personnelIds?: number[]): Promise<Blob> {
  try {
    const params: any = {};
    if (personnelIds && personnelIds.length > 0) {
      params.personnel_ids = personnelIds.join(',');
    }
    const res = await axiosInstance.get('/api/annual-rewards/template', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
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
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function createAnnualReward(personnelId: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/personnel/${personnelId}/annual-rewards`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updateAnnualReward(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/annual-rewards/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteAnnualReward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/annual-rewards/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function checkAnnualRewards(body: {
  personnel_ids: string[] | number[];
  nam: number;
  danh_hieu: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/annual-rewards/check', body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    // Nếu có file, gửi dưới dạng FormData
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
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    }

    // Nếu không có file, gửi dưới dạng JSON
    const jsonBody: any = {
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
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Scientific Achievements
export async function getPersonnelScientificAchievements(
  personnelId: string
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/personnel/${personnelId}/scientific-achievements`);
    return { success: true, data: res.data?.data?.achievements || res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createScientificAchievement(
  personnelId: string,
  body: any
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(
      `/api/personnel/${personnelId}/scientific-achievements`,
      body
    );
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updateScientificAchievement(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/scientific-achievements/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteScientificAchievement(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/scientific-achievements/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function getScientificAchievementsTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/scientific-achievements/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
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
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Awards Management (general)
export async function getAwards(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/awards', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAwardsTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/awards/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
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
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

// HCCSVV (Huy chuong Chien si Ve vang)
export async function getHCCSVVTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/hccsvv/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function importHCCSVV(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/hccsvv/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    const res = await axiosInstance.get('/api/hccsvv', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function exportHCCSVV(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/hccsvv/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function getHCCSVVStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/hccsvv/statistics', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteHCCSVV(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/hccsvv/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    const res = await axiosInstance.post('/api/hccsvv', body);
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Contribution Awards (Huan chuong Bao ve To quoc)
export async function getContributionAwardsTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/contribution-awards/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function importContributionAwards(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/contribution-awards/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    const res = await axiosInstance.get('/api/contribution-awards', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function exportContributionAwards(params?: {
  don_vi_id?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/contribution-awards/export', {
      params,
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function getContributionAwardsStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/contribution-awards/statistics', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteContributionAward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/contribution-awards/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Commemorative Medals (Ky niem chuong Vi su nghiep xay dung QDNDVN)
export async function getCommemorationMedalsTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/commemorative-medals/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
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
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function getCommemorationMedalsStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/commemorative-medals/statistics', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteCommemorationMedal(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/commemorative-medals/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Military Flag (Huy chuong quan ky Quyet thang)
export async function getMilitaryFlagTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/military-flag/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function importMilitaryFlag(file: File): Promise<ApiResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post('/api/military-flag/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function getMilitaryFlagStatistics(params?: {
  don_vi_id?: number;
  nam?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/military-flag/statistics', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteMilitaryFlag(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/military-flag/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getMilitaryFlagByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/military-flag/personnel/${personnelId}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getCommemorationMedalsByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/commemorative-medals/personnel/${personnelId}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Unit Annual Awards
export async function getUnitAnnualAwards(params?: {
  page?: number;
  limit?: number;
  nam?: number;
  danh_hieu?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/awards/units/annual', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getUnitAnnualAwardsByUnit(
  donViId: string,
  year?: number
): Promise<ApiResponse> {
  try {
    const params: any = { don_vi_id: donViId, limit: 1000 };
    if (year) params.year = year;
    const res = await axiosInstance.get('/api/awards/units/annual/history', { params });
    return {
      success: true,
      data: res.data?.data || res.data || [],
    };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getUnitAnnualAwardsTemplate(): Promise<Blob> {
  try {
    const res = await axiosInstance.get('/api/awards/units/annual/template', {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
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
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || e.message);
  }
}

export async function deleteUnitAnnualAward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/awards/units/annual/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getUnitAnnualProfile(donViId: string, year?: number): Promise<ApiResponse> {
  try {
    let url = year
      ? `/api/awards/units/annual/profile/${donViId}?year=${year}`
      : `/api/awards/units/annual/profile/${donViId}`;

    const res = await axiosInstance.get(url);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Ad-hoc Awards (Khen thuong dot xuat)
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
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAdhocAwardById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/adhoc-awards/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createAdhocAward(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/adhoc-awards', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updateAdhocAward(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/adhoc-awards/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteAdhocAward(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/adhoc-awards/${id}`);
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getAdhocAwardsByPersonnel(personnelId: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/adhoc-awards/personnel/${personnelId}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

// Annual Rewards Import Preview & Confirm
export async function previewAnnualRewardsImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/annual-rewards/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function confirmAnnualRewardsImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/annual-rewards/import/confirm', { items });
  return res.data;
}

// Unit Annual Awards Import Preview & Confirm
export async function previewUnitAnnualAwardsImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/awards/units/annual/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function confirmUnitAnnualAwardsImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/awards/units/annual/import/confirm', { items });
  return res.data;
}

// HCCSVV Import Preview & Confirm
export async function previewHCCSVVImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/hccsvv/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
export async function confirmHCCSVVImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/hccsvv/import/confirm', { items });
  return res.data;
}

// HC QKQT (Military Flag) Import Preview & Confirm
export async function previewMilitaryFlagImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/military-flag/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
export async function confirmMilitaryFlagImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/military-flag/import/confirm', { items });
  return res.data;
}

// HCBVTQ (Contribution Awards) Import Preview & Confirm
export async function previewContributionAwardsImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/contribution-awards/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
export async function confirmContributionAwardsImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/contribution-awards/import/confirm', { items });
  return res.data;
}

// KNC VSNXD (Commemorative Medals) Import Preview & Confirm
export async function previewCommemorationMedalsImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/commemorative-medals/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
export async function confirmCommemorationMedalsImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/commemorative-medals/import/confirm', { items });
  return res.data;
}

// Scientific Achievements (NCKH) Import Preview & Confirm
export async function previewScientificAchievementsImport(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await axiosInstance.post('/api/scientific-achievements/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
export async function confirmScientificAchievementsImport(items: any[]): Promise<any> {
  const res = await axiosInstance.post('/api/scientific-achievements/import/confirm', { items });
  return res.data;
}

// Bulk Create Awards (with full validation)
export async function bulkCreateAwards(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/awards/bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
