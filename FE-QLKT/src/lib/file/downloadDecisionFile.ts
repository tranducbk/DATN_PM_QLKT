import { message } from 'antd';
import { getDecisionFilePath } from '@/lib/api/decisions';
import { BASE_URL } from '@/configs';

/**
 * Opens a decision file in a new tab via its public static URL, resolved by decision
 * number. The browser shows it in its native PDF viewer with the real path and real
 * filename, so downloading from there keeps the correct name.
 * @param soQuyetDinh - Decision number
 * @returns Promise resolved when the file opens or an error is shown
 */
export async function downloadDecisionFile(soQuyetDinh: string): Promise<void> {
  const res = await getDecisionFilePath(soQuyetDinh);
  const filePath = (res.data as { file_path?: string } | undefined)?.file_path;
  if (!res.success || !filePath) {
    message.error(res.message || 'Không tìm thấy file quyết định');
    return;
  }
  // Encode each path segment (spaces, Vietnamese chars) but keep the slashes.
  const url = `${BASE_URL}/${filePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`;
  window.open(url, '_blank');
}
