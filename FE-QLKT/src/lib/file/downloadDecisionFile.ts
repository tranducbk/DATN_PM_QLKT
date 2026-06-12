/*
 * ════════════════════════════════════════════════════════════════════════════
 *  DOWNLOAD DECISION FILE — tải file PDF quyết định với auth
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  FLOW:
 *  1. Tra cứu so_quyet_dinh → lấy filename từ FileQuyetDinh.
 *  2. previewFileWithApi → axios fetch blob (auth Bearer) → open viewer.
 *
 *  WHY 2-step lookup:
 *  - User biết số QĐ ("123/QĐ-HV"), không biết filename lưu.
 *  - Backend filename random (timestamp+uuid) chống collision.
 *  - Helper hide complexity.
 *
 *  ATTT: filename qua /api/proposals/uploads/:filename, server có path
 *  traversal guard (xem proposal.controller.ts:getPdfFile).
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
