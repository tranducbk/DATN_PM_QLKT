import { DANH_HIEU_HCCSVV, getDanhHieuName } from '../../constants/danhHieu.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HCCSVV (Huy chương Chiến sĩ Vẻ Vang) — RANK ORDER VALIDATION
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KHÁC BIỆT VỚI HCBVTQ:
 *  - HCBVTQ: 1 record duy nhất, upgrade thay thế record cũ.
 *  - HCCSVV: 3 record riêng biệt (Hạng Ba → Nhì → Nhất), MỖI HẠNG LƯU 1 ROW.
 *    Quân nhân có thể giữ cùng lúc cả 3 hạng (giống quá trình thăng cấp).
 *
 *  THỨ TỰ TUẦN TỰ BẮT BUỘC:
 *      Hạng Ba (15 năm) → Hạng Nhì (25 năm) → Hạng Nhất (30 năm)
 *
 *  RULE chốt:
 *  ① Đề xuất hạng N → BẮT BUỘC đã có TẤT CẢ hạng < N trước đó.
 *     Vd: muốn Hạng Nhất → phải đã có cả Hạng Ba VÀ Hạng Nhì trên hệ thống.
 *
 *  ② Năm nhận hạng N PHẢI > năm nhận tất cả hạng < N.
 *     Vd: đã nhận Hạng Ba năm 2018 → Hạng Nhì phải nhận năm ≥ 2019.
 *     "Cùng năm" KHÔNG cho phép — phải qua ít nhất 1 năm dương lịch.
 *
 *  ③ CHỈ check `nam`, KHÔNG check `thang`. Business rule cho phép nhận
 *     Hạng Nhì tháng 1 cùng năm với Hạng Ba tháng 12 (nếu thầu lý giải).
 *     → Đảm bảo tuân thủ tinh thần "tuần tự năm" nhưng không cứng nhắc
 *     ngày tháng. (Lý do business: chứng từ quân đội cấp theo năm.)
 *
 *  THUẬT TOÁN:
 *  - RANK_ORDER cố định [Ba, Nhì, Nhất] với index 0/1/2.
 *  - Lấy targetIdx của hạng đề xuất; nếu <= 0 (Hạng Ba) → không cần check
 *    (không có hạng nào dưới Ba).
 *  - Loop từ 0..targetIdx-1: với mỗi hạng dưới, verify (a) tồn tại, (b)
 *    năm < targetNam. Fail ở đâu trả message ngay.
 *
 *  COMPLEXITY: O(targetIdx × existingRanks) ≤ O(3 × 3) = O(9), pure
 *  function, không touch DB → cực rẻ, gọi trong loop bulk validate OK.
 * ════════════════════════════════════════════════════════════════════════════
 */

const RANK_ORDER = [
  DANH_HIEU_HCCSVV.HANG_BA,
  DANH_HIEU_HCCSVV.HANG_NHI,
  DANH_HIEU_HCCSVV.HANG_NHAT,
] as const;

interface ExistingRankRecord {
  danh_hieu: string;
  nam: number;
}

/**
 * Validates that an HCCSVV rank can be granted in the target year.
 * Higher ranks require every lower rank to already exist with an earlier year.
 * Only `nam` is checked — `thang` is intentionally ignored per business rule.
 * @param targetRank - HCCSVV rank code being added
 * @param targetNam - Year of the new award
 * @param existingRanks - HCCSVV records already on file for the same personnel
 * @returns Error message or null when the order is valid
 */
export function validateHCCSVVRankOrder(
  targetRank: string,
  targetNam: number,
  existingRanks: ExistingRankRecord[]
): string | null {
  const targetIdx = RANK_ORDER.indexOf(targetRank as (typeof RANK_ORDER)[number]);
  if (targetIdx <= 0) return null;

  const targetName = getDanhHieuName(targetRank);
  for (let i = 0; i < targetIdx; i++) {
    const lowerRank = RANK_ORDER[i];
    const existing = existingRanks.find(r => r.danh_hieu === lowerRank);
    if (!existing) {
      return `Phải nhận ${getDanhHieuName(lowerRank)} trước khi nhận ${targetName}`;
    }
    if (existing.nam >= targetNam) {
      return `Năm nhận ${targetName} (${targetNam}) phải sau năm nhận ${getDanhHieuName(lowerRank)} (${existing.nam})`;
    }
  }
  return null;
}
