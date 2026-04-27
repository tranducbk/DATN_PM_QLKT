import axiosInstance from '@/lib/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types/common';

/**
 * submitProposal API wrapper.
 * @returns API response payload
 */
export async function submitProposal(formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/proposals', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getProposals API wrapper.
 * @returns API response payload
 */
export async function getProposals(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/proposals', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getProposalById API wrapper.
 * @returns API response payload
 */
export async function getProposalById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/proposals/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * approveProposal API wrapper.
 * @returns API response payload
 */
export async function approveProposal(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/proposals/${id}/approve`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * rejectProposal API wrapper.
 * @returns API response payload
 */
export async function rejectProposal(id: string, ghi_chu: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/proposals/${id}/reject`, { ghi_chu });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * uploadDecision API wrapper.
 * @returns API response payload
 */
export async function uploadDecision(id: string, formData: FormData): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post(`/api/proposals/${id}/upload-decision`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * checkDuplicate API wrapper.
 * @returns API response payload
 */
export async function checkDuplicate(params: {
  personnel_id: string;
  nam: number;
  danh_hieu: string;
  proposal_type: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/proposals/check-duplicate', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * checkDuplicateUnit API wrapper.
 * @returns API response payload
 */
export async function checkDuplicateUnit(params: {
  don_vi_id: string;
  nam: number;
  danh_hieu: string;
  proposal_type: string;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/proposals/check-duplicate-unit', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * Batch-checks a list of personnel items for duplicate awards/proposals in a single request.
 * @param items - Array of items to check
 * @returns Duplicate-check results in the same order as input
 */
export async function checkDuplicateBatch(
  items: Array<{ personnel_id: string; nam: number; danh_hieu: string; proposal_type: string }>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/proposals/check-duplicate-batch', { items });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * Batch-checks a list of unit items for duplicate awards/proposals in a single request.
 * @param items - Array of items to check
 * @returns Duplicate-check results in the same order as input
 */
export async function checkDuplicateUnitBatch(
  items: Array<{ don_vi_id: string; nam: number; danh_hieu: string; proposal_type: string }>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/proposals/check-duplicate-unit-batch', { items });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteProposal API wrapper.
 * @returns API response payload
 */
export async function deleteProposal(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/proposals/${id}`);
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
