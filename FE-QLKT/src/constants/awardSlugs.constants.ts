/**
 * Award resource slugs — used as REST path segments and Next.js route
 * fragments. Mirror of `BE-QLKT/src/constants/awardSlugs.constants.ts`;
 * keep both files in sync until the shared package is in place.
 */
export const AWARD_SLUGS = {
  ANNUAL_REWARDS: 'annual-rewards',
  UNIT_ANNUAL_AWARDS: 'unit-annual-awards',
  TENURE_MEDALS: 'tenure-medals',
  CONTRIBUTION_MEDALS: 'contribution-medals',
  COMMEMORATIVE_MEDALS: 'commemorative-medals',
  MILITARY_FLAG: 'military-flag',
  SCIENTIFIC_ACHIEVEMENTS: 'scientific-achievements',
  ADHOC_AWARDS: 'adhoc-awards',
} as const;

export type AwardSlug = (typeof AWARD_SLUGS)[keyof typeof AWARD_SLUGS];
