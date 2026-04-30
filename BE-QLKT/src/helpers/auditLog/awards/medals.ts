import { AWARD_SLUGS } from '../../../constants/awardSlugs.constants';
import { buildAwardTypeHelpers } from './shared';

export const tenureMedals = buildAwardTypeHelpers(AWARD_SLUGS.TENURE_MEDALS);
export const commemorativeMedals = buildAwardTypeHelpers(AWARD_SLUGS.COMMEMORATIVE_MEDALS);
export const militaryFlag = buildAwardTypeHelpers(AWARD_SLUGS.MILITARY_FLAG);
export const contributionMedals = buildAwardTypeHelpers(AWARD_SLUGS.CONTRIBUTION_MEDALS);
