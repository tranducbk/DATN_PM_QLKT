import { DANH_HIEU_HCBVTQ, getDanhHieuName } from '../../constants/danhHieu.constants';

/*
 * ════════════════════════════════════════════════════════════════════════════
 *  HCBVTQ RANK UPGRADE VALIDATION — chỉ cho phép upgrade (newRank > old)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  KHÁC HCCSVV (rank order tuần tự):
 *  - HCCSVV: 3 hạng RIÊNG BIỆT — nhận TUẦN TỰ (3 record).
 *  - HCBVTQ: 1 record DUY NHẤT per personnel — chỉ UPGRADE rank.
 *
 *  RULE:
 *  - Đã có Hạng Ba → đề xuất Hạng Nhì → OK (upgrade).
 *  - Đã có Hạng Nhì → đề xuất Hạng Ba → REJECT (không downgrade).
 *  - Đã có Hạng Nhất → đề xuất bất kỳ → REJECT (đã max).
 *
 *  RANK_ORDER: index 0 (Hạng Ba) < 1 (Hạng Nhì) < 2 (Hạng Nhất).
 * ════════════════════════════════════════════════════════════════════════════
 */

const RANK_ORDER = [
  DANH_HIEU_HCBVTQ.HANG_BA,
  DANH_HIEU_HCBVTQ.HANG_NHI,
  DANH_HIEU_HCBVTQ.HANG_NHAT,
] as const;

/**
 * HCBVTQ is a one-time-per-personnel award; bulk/import paths must never downgrade
 * or duplicate an existing rank. Returns null when the upgrade is strictly higher.
 * @param existingRank - Current HCBVTQ rank on file (null if none)
 * @param newRank - Rank being proposed
 * @returns Error message or null when the upgrade is valid
 */
export function validateHCBVTQRankUpgrade(
  existingRank: string | null | undefined,
  newRank: string
): string | null {
  if (!existingRank) return null;
  const oldIdx = RANK_ORDER.indexOf(existingRank as (typeof RANK_ORDER)[number]);
  const newIdx = RANK_ORDER.indexOf(newRank as (typeof RANK_ORDER)[number]);
  if (oldIdx < 0 || newIdx < 0) return null;
  if (newIdx > oldIdx) return null;
  const action = newIdx === oldIdx ? 'thêm trùng' : 'downgrade xuống';
  return `đã có ${getDanhHieuName(existingRank)}, không thể ${action} ${getDanhHieuName(newRank)}`;
}
