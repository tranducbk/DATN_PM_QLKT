import { AWARD_SLUGS, type AwardSlug } from './awardSlugs.constants';

/**
 * Single source of truth for the Vietnamese display name of every award type.
 * Use this anywhere a name is shown to the user — audit log descriptions,
 * notifications, error messages, response messages, Excel headers — so a
 * rename or typo fix happens in exactly one place.
 */
export const AWARD_LABELS: Record<AwardSlug, string> = {
  [AWARD_SLUGS.ANNUAL_REWARDS]: 'Danh hiệu hằng năm',
  [AWARD_SLUGS.UNIT_ANNUAL_AWARDS]: 'Khen thưởng đơn vị hằng năm',
  [AWARD_SLUGS.TENURE_MEDALS]: 'Huy chương Chiến sĩ vẻ vang',
  [AWARD_SLUGS.CONTRIBUTION_MEDALS]: 'Huân chương Bảo vệ Tổ quốc',
  [AWARD_SLUGS.COMMEMORATIVE_MEDALS]: 'Kỷ niệm chương vì sự nghiệp xây dựng QĐNDVN',
  [AWARD_SLUGS.MILITARY_FLAG]: 'Huy chương Quân kỳ quyết thắng',
  [AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS]: 'Thành tích khoa học',
  [AWARD_SLUGS.ADHOC_AWARDS]: 'Khen thưởng đột xuất',
};
