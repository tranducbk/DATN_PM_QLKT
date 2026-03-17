import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export const apiClient = {
  // Auth
  async login(username: string, password: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/auth/login', {
        username,
        password,
      });
      return {
        success: true,
        data: res.data?.data || res.data,
        message: res.data?.message,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.response?.data?.message || e?.response?.data?.error || e.message,
      };
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/auth/change-password', {
        oldPassword,
        newPassword,
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Accounts
  async getAccounts(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/accounts', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getAccountById(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/accounts/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateAccount(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/accounts/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createAccount(body: {
    username: string;
    password: string;
    role: string;
    co_quan_don_vi_id?: string;
    don_vi_truc_thuoc_id?: string;
    chuc_vu_id?: string;
    personnel_id?: string;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/accounts', body);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      console.error('API createAccount error:', e);
      const errorMessage =
        e?.response?.data?.message || e?.message || 'Có lỗi xảy ra khi tạo tài khoản';
      return { success: false, message: errorMessage };
    }
  },

  async deleteAccount(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/accounts/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async resetAccountPassword(accountId: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/accounts/reset-password', {
        account_id: accountId,
      });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Personnel
  async getPersonnel(params?: {
    page?: number;
    limit?: number;
    search?: string;
    unit_id?: number;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/personnel', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getPersonnelById(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/personnel/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createPersonnel(body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/personnel', body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updatePersonnel(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/personnel/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deletePersonnel(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/personnel/${id}`);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // System logs
  async getSystemLogs(params?: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/system-logs', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getSystemLogActions(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/system-logs/actions');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getSystemLogResources(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/system-logs/resources');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Units
  async getUnits(params?: { hierarchy?: boolean }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/units', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getMyUnits(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/units/my-units');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getUnitById(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/units/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createUnit(body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/units', body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateUnit(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/units/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteUnit(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/units/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getSubUnits(params?: { co_quan_don_vi_id?: string }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/sub-units', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Positions
  async getPositions(params?: {
    unit_id?: number;
    include_children?: boolean;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/positions', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createPosition(body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/positions', body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updatePosition(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/positions/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deletePosition(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/positions/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Annual Rewards
  async getAnnualRewards(params?: {
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
  },

  async getAnnualRewardsByPersonnel(personnelId: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/personnel/${personnelId}/annual-rewards`);
      return { success: true, data: res.data?.data?.rewards || res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getAnnualRewardsTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/annual-rewards/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importAnnualRewards(file: File): Promise<ApiResponse> {
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
  },

  async exportAnnualRewards(params?: { nam?: number; danh_hieu?: string }): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/annual-rewards/export', {
        params,
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async createAnnualReward(personnelId: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post(`/api/personnel/${personnelId}/annual-rewards`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateAnnualReward(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/annual-rewards/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteAnnualReward(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/annual-rewards/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async checkAnnualRewards(body: {
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
  },

  async bulkCreateAnnualRewards(body: {
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
  },

  // Position History
  async getPositionHistory(personnelId: string): Promise<ApiResponse> {
    try {
      let url = `/api/personnel/${personnelId}/position-history`;
      const res = await axiosInstance.get(url);
      return { success: true, data: res.data?.data?.history || res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createPositionHistory(personnelId: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post(`/api/personnel/${personnelId}/position-history`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updatePositionHistory(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/position-history/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deletePositionHistory(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/position-history/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Scientific Achievements
  async getPersonnelScientificAchievements(personnelId: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/personnel/${personnelId}/scientific-achievements`);
      return { success: true, data: res.data?.data?.achievements || res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getScientificAchievements(params?: {
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
  },

  async createScientificAchievement(personnelId: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post(
        `/api/personnel/${personnelId}/scientific-achievements`,
        body
      );
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateScientificAchievement(id: string, body: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/scientific-achievements/${id}`, body);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteScientificAchievement(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/scientific-achievements/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async exportScientificAchievements(params?: { nam?: number; loai?: string }): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/scientific-achievements/export', {
        params,
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async getScientificAchievementsTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/scientific-achievements/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importScientificAchievements(file: File): Promise<ApiResponse> {
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
  },

  // Personnel Export/Import
  async exportPersonnel(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/personnel/export', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async exportPersonnelSample(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/personnel/export-sample', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importPersonnel(file: File): Promise<ApiResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axiosInstance.post('/api/personnel/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Proposals
  async getProposalTemplate(
    type:
      | 'CA_NHAN_HANG_NAM'
      | 'DON_VI_HANG_NAM'
      | 'NIEN_HAN'
      | 'CONG_HIEN'
      | 'DOT_XUAT'
      | 'NCKH' = 'CA_NHAN_HANG_NAM'
  ): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/proposals/template', {
        params: { type },
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async submitProposal(formData: FormData): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/proposals', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getProposals(params?: { page?: number; limit?: number }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/proposals', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getProposalById(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/proposals/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async approveProposal(id: string, formData: FormData): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post(`/api/proposals/${id}/approve`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async rejectProposal(id: string, ghi_chu: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post(`/api/proposals/${id}/reject`, { ghi_chu });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async downloadProposalExcel(id: string): Promise<Blob> {
    try {
      const res = await axiosInstance.get(`/api/proposals/${id}/download-excel`, {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async deleteProposal(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/proposals/${id}`);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Awards Management
  async getAwards(params?: {
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
  },

  async getAwardsTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/awards/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importAwards(file: File): Promise<ApiResponse> {
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
  },

  async exportAwards(params?: {
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
  },

  // HCCSVV (Huy chương Chiến sĩ Vẻ vang)
  async getHCCSVVTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/hccsvv/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importHCCSVV(file: File): Promise<ApiResponse> {
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
  },

  async getHCCSVV(params?: {
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
  },

  async exportHCCSVV(params?: {
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
  },

  async getHCCSVVStatistics(params?: { don_vi_id?: number; nam?: number }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/hccsvv/statistics', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteHCCSVV(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/hccsvv/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Create HCCSVV directly (Super Admin only - for past awards)
  async createHCCSVVDirect(body: {
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
  },

  // Contribution Awards (Huân chương Bảo vệ Tổ quốc)
  async getContributionAwardsTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/contribution-awards/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importContributionAwards(file: File): Promise<ApiResponse> {
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
  },

  async getContributionAwards(params?: {
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
  },

  async exportContributionAwards(params?: {
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
  },

  async getContributionAwardsStatistics(params?: {
    don_vi_id?: number;
    nam?: number;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/contribution-awards/statistics', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteContributionAward(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/contribution-awards/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Commemorative Medals (Kỷ niệm chương Vì sự nghiệp xây dựng QĐNDVN)
  async getCommemorationMedalsTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/commemorative-medals/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importCommemorationMedals(file: File): Promise<ApiResponse> {
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
  },

  async getCommemorationMedals(params?: {
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
  },

  async exportCommemorationMedals(params?: { don_vi_id?: number; nam?: number }): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/commemorative-medals/export', {
        params,
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async getCommemorationMedalsStatistics(params?: {
    don_vi_id?: number;
    nam?: number;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/commemorative-medals/statistics', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteCommemorationMedal(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/commemorative-medals/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Military Flag (Huy chương quân kỳ Quyết thắng)
  async getMilitaryFlagTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/military-flag/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importMilitaryFlag(file: File): Promise<ApiResponse> {
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
  },

  async getMilitaryFlag(params?: {
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
  },

  async exportMilitaryFlag(params?: { don_vi_id?: number; nam?: number }): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/military-flag/export', {
        params,
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async getMilitaryFlagStatistics(params?: {
    don_vi_id?: number;
    nam?: number;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/military-flag/statistics', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteMilitaryFlag(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/military-flag/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getMilitaryFlagByPersonnel(personnelId: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/military-flag/personnel/${personnelId}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getCommemorationMedalsByPersonnel(personnelId: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/commemorative-medals/personnel/${personnelId}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Notifications
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    isRead?: boolean;
    type?: string;
  }): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/notifications', { params });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getUnreadNotificationCount(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/notifications/unread-count');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async markNotificationAsRead(id: number): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.patch(`/api/notifications/${id}/read`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async markAllNotificationsAsRead(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.patch('/api/notifications/read-all');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteNotification(id: number): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/notifications/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Profiles
  async getAnnualProfile(personnelId: string, year?: number): Promise<ApiResponse> {
    try {
      // If year is provided, API will auto-recalculate before returning
      let url = year
        ? `/api/profiles/annual/${personnelId}?year=${year}`
        : `/api/profiles/annual/${personnelId}`;

      const res = await axiosInstance.get(url);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getTenureProfile(personnelId: string): Promise<ApiResponse> {
    try {
      // Auto-recalculates on every call
      const url = `/api/profiles/tenure/${personnelId}`;
      const res = await axiosInstance.get(url);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getContributionProfile(personnelId: string): Promise<ApiResponse> {
    try {
      // Auto-recalculates on every call
      const url = `/api/profiles/contribution/${personnelId}`;
      const res = await axiosInstance.get(url);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Deprecated: kept for backward compatibility
  async getServiceProfile(personnelId: string): Promise<ApiResponse> {
    console.warn(
      'getServiceProfile is deprecated, use getTenureProfile or getContributionProfile instead'
    );
    return this.getTenureProfile(personnelId);
  },

  async recalculateProfile(personnelId: string, year?: number): Promise<ApiResponse> {
    try {
      const url = year
        ? `/api/profiles/recalculate/${personnelId}?year=${year}`
        : `/api/profiles/recalculate/${personnelId}`;
      const res = await axiosInstance.post(url);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async recalculateAllProfiles(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/profiles/recalculate-all');
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Dashboard Statistics
  async getDashboardStatistics(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/dashboard/statistics');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getAdminDashboardStatistics(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/dashboard/statistics/admin');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getManagerDashboardStatistics(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/dashboard/statistics/manager');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getAllServiceProfiles(): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/profiles/service');
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateServiceProfile(personnelId: string, updates: any): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/profiles/service/${personnelId}`, updates);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Decision Management (Quản lý Quyết định)
  async getDecisions(params?: {
    nam?: number;
    loai_khen_thuong?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse & { pagination?: any }> {
    try {
      const res = await axiosInstance.get('/api/decisions', { params });
      // Backend trả về: { success: true, data: [...], pagination: {...} }
      return {
        success: true,
        data: res.data?.data || res.data,
        pagination: res.data?.pagination,
      };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async autocompleteDecisions(query: string, limit = 10): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get('/api/decisions/autocomplete', {
        params: { q: query, limit },
      });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getDecisionBySoQuyetDinh(soQuyetDinh: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/decisions/by-number/${soQuyetDinh}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getDecisionById(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/decisions/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createDecision(formData: FormData): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/decisions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateDecision(id: string, formData: FormData): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/decisions/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteDecision(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/decisions/${id}`);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  /**
   * Lấy file path từ số quyết định
   * @param soQuyetDinh - Số quyết định
   * @returns { success: boolean, data: { file_path: string, decision: object } }
   */
  async getDecisionFilePath(soQuyetDinh: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(
        `/api/decisions/file-path/${encodeURIComponent(soQuyetDinh)}`
      );
      return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  /**
   * Tải file quyết định theo số quyết định
   * Backend tự động query DB để lấy file path và trả về file để download
   * @param soQuyetDinh - Số quyết định
   */
  async downloadDecisionFile(soQuyetDinh: string): Promise<Blob> {
    const res = await axiosInstance.get(
      `/api/decisions/download/${encodeURIComponent(soQuyetDinh)}`,
      {
        responseType: 'blob',
      }
    );
    return res.data;
  },

  /**
   * Lấy file paths từ nhiều số quyết định
   * @param soQuyetDinhs - Mảng các số quyết định
   * @returns { success: boolean, data: { [soQD]: { success, file_path, decision, error } } }
   */
  async getDecisionFilePaths(soQuyetDinhs: string[]): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/decisions/file-paths', { soQuyetDinhs });
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Unit Annual Awards
  async getUnitAnnualAwards(params?: {
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
  },

  async getUnitAnnualAwardsByUnit(donViId: string, year?: number): Promise<ApiResponse> {
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
  },

  async getUnitAnnualAwardsTemplate(): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/awards/units/annual/template', {
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async importUnitAnnualAwards(file: File): Promise<ApiResponse> {
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
  },

  async exportUnitAnnualAwards(params?: { nam?: number; danh_hieu?: string }): Promise<Blob> {
    try {
      const res = await axiosInstance.get('/api/awards/units/annual/export', {
        params,
        responseType: 'blob',
      });
      return res.data;
    } catch (e: any) {
      throw new Error(e?.response?.data?.message || e.message);
    }
  },

  async deleteUnitAnnualAward(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/awards/units/annual/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getUnitAnnualProfile(donViId: string, year?: number): Promise<ApiResponse> {
    try {
      // If year is provided, API will auto-recalculate before returning
      let url = year
        ? `/api/awards/units/annual/profile/${donViId}?year=${year}`
        : `/api/awards/units/annual/profile/${donViId}`;

      const res = await axiosInstance.get(url);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  // Ad-hoc Awards (Khen thưởng đột xuất)
  async getAdhocAwards(params?: {
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
  },

  async getAdhocAwardById(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/adhoc-awards/${id}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async createAdhocAward(formData: FormData): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.post('/api/adhoc-awards', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async updateAdhocAward(id: string, formData: FormData): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.put(`/api/adhoc-awards/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async deleteAdhocAward(id: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.delete(`/api/adhoc-awards/${id}`);
      return { success: true, data: res.data?.data || res.data, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getAdhocAwardsByPersonnel(personnelId: string): Promise<ApiResponse> {
    try {
      const res = await axiosInstance.get(`/api/adhoc-awards/personnel/${personnelId}`);
      return { success: true, data: res.data?.data || res.data };
    } catch (e: any) {
      return { success: false, message: e?.response?.data?.message || e.message };
    }
  },

  async getAdhocAwardsByUnit(
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
  },

  // Bulk Create Awards (với validation đầy đủ)
  async bulkCreateAwards(formData: FormData): Promise<ApiResponse> {
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
  },
};

export default apiClient;
