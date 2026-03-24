import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

// Units
export async function getUnits(params?: { hierarchy?: boolean }): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/units', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getMyUnits(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/units/my-units');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getUnitById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/units/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createUnit(body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/units', body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updateUnit(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/units/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deleteUnit(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/units/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getSubUnits(params?: { co_quan_don_vi_id?: string }): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/sub-units', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

// Positions
export async function getPositions(params?: {
  unit_id?: number;
  include_children?: boolean;
}): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/positions', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function createPosition(body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/positions', body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updatePosition(id: string, body: Record<string, unknown>): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/positions/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function deletePosition(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/positions/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
