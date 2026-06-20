import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import type { ApiResponse } from '@/lib/types/common';

export async function getAnnualProfile(personnelId: string, year?: number): Promise<ApiResponse> {
  try {
    // If year is provided, API will auto-recalculate before returning
    const url = year
      ? `/api/profiles/annual/${personnelId}?year=${year}`
      : `/api/profiles/annual/${personnelId}`;

    const res = await axiosInstance.get(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getTenureProfile(personnelId: string): Promise<ApiResponse> {
  try {
    // Auto-recalculates on every call
    const url = `/api/profiles/tenure/${personnelId}`;
    const res = await axiosInstance.get(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

export async function getContributionProfile(personnelId: string): Promise<ApiResponse> {
  try {
    // Auto-recalculates on every call
    const url = `/api/profiles/contribution/${personnelId}`;
    const res = await axiosInstance.get(url);
    return { success: res.data?.success, data: res.data?.data };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}

