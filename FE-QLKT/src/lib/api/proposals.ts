import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getProposalTemplate(
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
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function submitProposal(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/proposals', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getProposals(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/proposals', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getProposalById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/proposals/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function approveProposal(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/proposals/${id}/approve`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function rejectProposal(id: string, ghi_chu: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/proposals/${id}/reject`, { ghi_chu });
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function downloadProposalExcel(id: string): Promise<Blob> {
  try {
    const res = await axiosInstance.get(`/api/proposals/${id}/download-excel`, {
      responseType: 'blob',
    });
    return res.data;
  } catch (e: unknown) {
    throw new Error(getApiErrorMessage(e));
  }
}

export async function deleteProposal(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/proposals/${id}`);
    return { success: true, data: res.data?.data || res.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
