import axiosInstance from '@/lib/http/axiosInstance';
import type { ApiResponse } from '@/lib/types/common';

/**
 * Builds a preview-import function for an Excel upload endpoint.
 * @param url - Preview endpoint path
 * @returns Function that uploads a file and returns the preview response
 */
export function createPreviewImport(url: string) {
  return async (file: File): Promise<ApiResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosInstance.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  };
}

/**
 * Builds a confirm-import function for an Excel upload endpoint.
 * @param url - Confirm endpoint path
 * @returns Function that posts the reviewed items and returns the confirm response
 */
export function createConfirmImport(url: string) {
  return async (items: unknown[]): Promise<ApiResponse> => {
    const res = await axiosInstance.post(url, { items });
    return res.data;
  };
}
