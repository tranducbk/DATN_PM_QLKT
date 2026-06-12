import { message } from 'antd';
import { signFileUrl } from '@/lib/api/files';
import { BASE_URL } from '@/configs';

// Maps the legacy authed serve endpoints to the real storage directory each file
// lives in, so we can request a signed view URL instead of streaming a blob.
const API_PATH_TO_STORAGE: Array<[string, string]> = [
  ['/api/adhoc-awards/uploads/', 'uploads/adhoc-awards/'],
  ['/api/proposals/uploads/', 'storage/proposals/'],
];

/**
 * Opens an attachment in a new tab via a short-lived signed URL (native viewer,
 * real filename; link expires and rejects tampering).
 * @param apiPath - Legacy serve path (e.g. "/api/proposals/uploads/<file>")
 * @param filename - Display/download name shown in the viewer
 * @returns Promise resolved when the file opens or an error is shown
 */
export async function previewFileWithApi(apiPath: string, filename: string): Promise<void> {
  const mapping = API_PATH_TO_STORAGE.find(([prefix]) => apiPath.startsWith(prefix));
  if (!mapping) {
    message.error('Không xem được loại file này');
    return;
  }
  const relativePath = apiPath.replace(mapping[0], mapping[1]);
  const res = await signFileUrl(relativePath, filename);
  const viewUrl = (res.data as { url?: string } | undefined)?.url;
  if (!res.success || !viewUrl) {
    message.error(res.message || 'Không mở được file');
    return;
  }
  window.open(`${BASE_URL}${viewUrl}`, '_blank');
}
