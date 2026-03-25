import axiosInstance from '@/utils/axiosInstance';
import { getApiErrorMessage } from '@/lib/apiError';

type ApiResponse<T = any> = { success: boolean; data?: T; message?: string };

export async function getAnnualProfile(personnelId: string, year?: number): Promise<ApiResponse> {
  try {
    // If year is provided, API will auto-recalculate before returning
    let url = year
      ? `/api/profiles/annual/${personnelId}?year=${year}`
      : `/api/profiles/annual/${personnelId}`;

    const res = await axiosInstance.get(url);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getTenureProfile(personnelId: string): Promise<ApiResponse> {
  try {
    // Auto-recalculates on every call
    const url = `/api/profiles/tenure/${personnelId}`;
    const res = await axiosInstance.get(url);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getContributionProfile(personnelId: string): Promise<ApiResponse> {
  try {
    // Auto-recalculates on every call
    const url = `/api/profiles/contribution/${personnelId}`;
    const res = await axiosInstance.get(url);
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

// Deprecated: kept for backward compatibility
export async function getServiceProfile(personnelId: string): Promise<ApiResponse> {
  return getTenureProfile(personnelId);
}

export async function recalculateProfile(personnelId: string, year?: number): Promise<ApiResponse> {
  try {
    const url = year
      ? `/api/profiles/recalculate/${personnelId}?year=${year}`
      : `/api/profiles/recalculate/${personnelId}`;
    const res = await axiosInstance.post(url);
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function recalculateAllProfiles(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.post('/api/profiles/recalculate-all');
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getAllServiceProfiles(): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/profiles/service');
    return { success: true, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function updateServiceProfile(
  personnelId: string,
  updates: Record<string, unknown>
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.put(`/api/profiles/service/${personnelId}`, updates);
    return { success: true, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
