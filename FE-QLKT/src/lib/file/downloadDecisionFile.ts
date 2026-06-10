import { message } from 'antd';
import { apiClient } from '@/lib/http/apiClient';
import { getApiErrorMessage } from '@/lib/http/apiError';
import { openPdfWithViewer } from '@/lib/file/filePreview';

/**
 * Opens a decision file in the PDF viewer window, resolved by decision number.
 * @param soQuyetDinh - Decision number
 * @returns Promise resolved when the viewer opens or an error is shown
 */
export async function downloadDecisionFile(soQuyetDinh: string): Promise<void> {
  try {
    message.loading({ content: 'Đang tải file...', key: 'preview' });

    const blob = await apiClient.downloadDecisionFile(soQuyetDinh);
    const filename = `${soQuyetDinh}.pdf`;

    const blobUrl = window.URL.createObjectURL(blob);

    message.destroy('preview');

    openPdfWithViewer(blobUrl, filename);
  } catch (error: unknown) {
    const ax = error as { response?: { data?: unknown } };

    // Handle JSON error response embedded in a blob
    if (ax.response?.data instanceof Blob) {
      try {
        const text = await (ax.response.data as Blob).text();
        const errorData = JSON.parse(text);
        message.error({
          content: errorData.message || 'Lỗi khi mở file quyết định',
          key: 'preview',
        });
      } catch {
        message.error({ content: 'Lỗi khi mở file quyết định', key: 'preview' });
      }
    } else {
      const errorMessage = getApiErrorMessage(error, 'Lỗi khi mở file quyết định');
      message.error({ content: errorMessage, key: 'preview' });
    }
  }
}
