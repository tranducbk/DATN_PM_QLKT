import axiosInstance from '@/utils/axiosInstance';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

// Units
export async function getUnits(params?: { hierarchy?: boolean }): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/units', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getMyUnits(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/units/my-units');
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getUnitById(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get(`/api/units/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createUnit(body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/units', body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updateUnit(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/units/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deleteUnit(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/units/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function getSubUnits(params?: { co_quan_don_vi_id?: string }): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/sub-units', { params });
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
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
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function createPosition(body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/positions', body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function updatePosition(id: string, body: any): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/positions/${id}`, body);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}

export async function deletePosition(id: string): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.delete(`/api/positions/${id}`);
    return { success: true, data: res.data?.data || res.data };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message };
  }
}
