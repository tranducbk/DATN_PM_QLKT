import { DANH_HIEU_HCCSVV, getDanhHieuName } from '../../constants/danhHieu.constants';

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
