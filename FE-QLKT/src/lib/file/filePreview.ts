import { message } from 'antd';
import axiosInstance from '@/lib/http/axiosInstance';

// File extensions that can be previewed directly in browser.
const PREVIEWABLE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

/**
 * Checks whether a file extension supports in-browser preview.
 * @param filename - File name
 * @returns `true` when file is previewable
 */
function isPreviewable(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return PREVIEWABLE_EXTENSIONS.includes(ext);
}

/**
 * Resolves MIME type from file extension.
 * @param filename - File name
 * @returns MIME type string
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Downloads blob data using the provided file name.
 * @param blob - File content
 * @param filename - Downloaded file name
 * @returns Nothing
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Previews or downloads file content from a custom API endpoint.
 * @param apiPath - API endpoint path
 * @param filename - Expected file name
 * @returns Promise resolved when action finishes
 */
export async function previewFileWithApi(apiPath: string, filename: string): Promise<void> {
  try {
    const response = await axiosInstance.get(apiPath, {
      responseType: 'blob',
    });

    const mimeType = getMimeType(filename);
    const blob = new Blob([response.data], { type: mimeType });

    if (isPreviewable(filename)) {
      // Open in the browser's native viewer (real blob: URL, native toolbar).
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      downloadBlob(blob, filename);
      message.success(`Đã tải file: ${filename}`);
    }
  } catch (error) {
    message.error('Lỗi khi mở file');
  }
}
