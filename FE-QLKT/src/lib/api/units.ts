import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';
import type { ApiResponse } from '@/lib/types';

// Units
/**
 * getUnits API wrapper.
 * @returns API response payload
 */
export async function getUnits(params?: { hierarchy?: boolean; page?: number; limit?: number }): Promise<ApiResponse & { pagination?: { total: number; page: number; limit: number; totalPages: number } }> {
  try {
    const res = await axiosInstance.get('/api/units', { params });
    return { success: res.data?.success, data: res.data?.data, pagination: res.data?.pagination };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getMyUnits API wrapper.
 * @returns API response payload
 */
export async function getMyUnits(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/units/my-units');
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getUnitById API wrapper.
 * @returns API response payload
 */
export async function getUnitById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/units/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * createUnit API wrapper.
 * @returns API response payload
 */
export async function createUnit(body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/units', body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * updateUnit API wrapper.
 * @returns API response payload
 */
export async function updateUnit(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/units/${id}`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deleteUnit API wrapper.
 * @returns API response payload
 */
export async function deleteUnit(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/units/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * getSubUnits API wrapper.
 * @returns API response payload
 */
export async function getSubUnits(params?: { co_quan_don_vi_id?: string }): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/sub-units', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

// Positions
/**
 * getPositions API wrapper.
 * @returns API response payload
 */
export async function getPositions(params?: {
  unit_id?: string;
  include_children?: boolean;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/positions', { params });
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * createPosition API wrapper.
 * @returns API response payload
 */
export async function createPosition(body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/positions', body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * updatePosition API wrapper.
 * @returns API response payload
 */
export async function updatePosition(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/positions/${id}`, body);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

/**
 * deletePosition API wrapper.
 * @returns API response payload
 */
export async function deletePosition(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/positions/${id}`);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
