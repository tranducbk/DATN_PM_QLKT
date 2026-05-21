/*
 * ════════════════════════════════════════════════════════════════════════════
 *  CCCD HELPER — chuẩn hoá Căn cước công dân (DỮ LIỆU NHẠY CẢM)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  CCCD = Căn cước công dân = 12 chữ số (chuẩn ban hành 2021).
 *  Cũ là CMND 9 hoặc 12 chữ số → quân nhân cũ có thể nhập thiếu số 0 ở
 *  đầu. Helper này pad zero để chuẩn hoá về 12.
 *
 *  VÍ DỤ:
 *      "12345678" → "000012345678" (pad 4 số 0)
 *      "001234567890" → "001234567890" (giữ nguyên)
 *      "ABC123" → "ABC123" (không phải số → không pad)
 *
 *  ATTT — CCCD LÀ THÔNG TIN NHẠY CẢM:
 *  CCCD thuộc nhóm PII (Personally Identifiable Information) theo Luật
 *  An toàn thông tin (2015) và Nghị định 13/2023/NĐ-CP về bảo vệ dữ
 *  liệu cá nhân. Khi xử lý:
 *  ① KHÔNG LOG raw CCCD ra console/system_log:
 *     - Audit middleware đã add 'cccd' vào SENSITIVE_FIELDS → redact.
 *     - console.error chỉ log error context, KHÔNG dump payload.
 *  ② KHÔNG TRẢ CCCD về client trừ khi user là chính chủ hoặc role cao.
 *  ③ KHÔNG LƯU CCCD vào backup unencrypted (TODO: redact trong backup).
 *  ④ Unique constraint OK (chỉ check tồn tại, không search prefix —
 *     tránh timing attack).
 *
 *  TẠI SAO PAD STRING (không INT):
 *  - "000012345678" nếu lưu Int → mất số 0 đầu khi load lại.
 *  - String bảo toàn dạng chính xác như giấy tờ.
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Normalizes a CCCD value to 12 digits by left-padding zeros when needed.
 * @param value - Raw CCCD input
 * @returns Normalized CCCD string
 */
export function parseCCCD(value: string): string {
  const cccd = value.trim();
  if (/^\d+$/.test(cccd) && cccd.length < 12) {
    return cccd.padStart(12, '0');
  }
  return cccd;
}
