/**
 * Award resource slugs — used as REST path segments, audit log `resource`
 * fields, notification keys, and frontend URL paths.
 *
 * Single source of truth: rename a slug here and TypeScript will catch every
 * call site that needs updating. See `awardResource.constants.ts` for the
 * Vietnamese display labels and proposal-type bindings.
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
