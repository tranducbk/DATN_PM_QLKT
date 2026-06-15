/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DOWNLOAD DECISION FILE — tải file PDF quyết định với auth
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  FLOW:
 *  1. Tra cứu so_quyet_dinh → BE lookup FileQuyetDinh, trả về view_url đã ký
 *     sẵn (signed URL hạn 5 phút) nếu quyết định có file đính kèm.
 *  2. window.open(view_url) → browser render PDF ở tab mới.
 *
 *  WHY tra cứu theo số QĐ (không truyền filename):
 *  - User biết số QĐ ("123/QĐ-HV"), không biết tên file lưu trên server.
 *  - Tên file do BE đặt ngẫu nhiên (dedup/timestamp) → FE không đoán được.
 *  - BE tập trung logic lookup + ký URL; FE chỉ cần mở link.
 *
 *  ATTT: view_url là signed URL (HMAC + hạn dùng) tới /api/files/view —
 *  không lộ token, không lộ đường dẫn thật, sửa URL là hỏng chữ ký.
 * ════════════════════════════════════════════════════════════════════════════
 */

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
