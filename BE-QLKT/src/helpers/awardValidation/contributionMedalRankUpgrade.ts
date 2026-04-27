import { DANH_HIEU_HCBVTQ, getDanhHieuName } from '../../constants/danhHieu.constants';

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
