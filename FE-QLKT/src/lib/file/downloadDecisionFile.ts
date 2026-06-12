import { message } from 'antd';
import { getDecisionFilePath } from '@/lib/api/decisions';
import { BASE_URL } from '@/configs';

/**
 * Opens a decision file in a new tab via a short-lived signed URL, resolved by
 * decision number. The browser shows it in its native PDF viewer with the real
 * filename; the link expires after a few minutes and rejects tampered URLs.
 * @param soQuyetDinh - Decision number
 * @returns Promise resolved when the file opens or an error is shown
 */
export async function downloadDecisionFile(soQuyetDinh: string): Promise<void> {
  const res = await getDecisionFilePath(soQuyetDinh);
  const viewUrl = (res.data as { view_url?: string } | undefined)?.view_url;
  if (!res.success || !viewUrl) {
    message.error(res.message || 'Không tìm thấy file quyết định');
    return;
  }
  window.open(`${BASE_URL}${viewUrl}`, '_blank');
}
