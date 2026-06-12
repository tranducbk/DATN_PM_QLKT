import axiosInstance from '@/lib/http/axiosInstance';
import { getApiErrorMessage } from '@/lib/http/apiError';
import type { ApiResponse } from '@/lib/types/common';

/**
 * Requests a short-lived signed view URL for an internal file.
 * @param relativePath - Project-root-relative file path (e.g. "storage/proposals/x.pdf")
 * @param downloadName - Optional display/download name shown in the viewer
 * @returns API response with `data.url` (signed view path) on success
 */
export async function signFileUrl(
  relativePath: string,
  downloadName?: string
): Promise<ApiResponse> {
  try {
    const res = await axiosInstance.get('/api/files/sign', {
      params: { path: relativePath, name: downloadName || undefined },
    });
    return { success: res.data?.success, data: res.data?.data, message: res.data?.message };
  } catch (e: unknown) {
    return { success: false, message: getApiErrorMessage(e) };
  }
}
