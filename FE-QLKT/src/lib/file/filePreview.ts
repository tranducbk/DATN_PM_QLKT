/*
 * ════════════════════════════════════════════════════════════════════════════
 *  FILE PREVIEW — mở file đính kèm bằng signed URL ngắn hạn
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  FLOW:
 *  1. Map đường dẫn API cũ (/api/proposals/uploads/<file>) → đường dẫn storage
 *     thật (storage/proposals/<file>) mà BE whitelist.
 *  2. Gọi /api/files/sign (kèm token) → nhận signed URL hạn 5 phút.
 *  3. window.open(signed URL) → browser tự render PDF/ảnh ở tab mới.
 *
 *  WHY không link thẳng tới file:
 *  - BE không serve static; phải qua signed URL có chữ ký + hạn dùng.
 *  - Tab mới không gửi được Bearer token → credential nằm trong URL ký sẵn.
 *  - FE không cần biết file lưu vật lý ở đâu, không lộ đường dẫn thật.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
