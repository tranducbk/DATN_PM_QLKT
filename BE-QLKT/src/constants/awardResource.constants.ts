import { AWARD_SLUGS, type AwardSlug } from './awardSlugs.constants';
import { AWARD_LABELS } from './awardLabels.constants';
import { PROPOSAL_TYPES, type ProposalType } from './proposalTypes.constants';

/**
 * Bundled metadata for each award resource — keyed by REST slug.
 * Use this in audit log builders, notification dispatch, and any place that
 * needs to translate a slug into either a Vietnamese label or its matching
 * proposal type. `proposalType` is `null` when the award has no proposal flow
 * (e.g. ad-hoc rewards which are entered directly).
 */
export interface AwardResourceMeta {
  vi: string;
  proposalType: ProposalType | null;
}

export const AWARD_RESOURCE: Record<AwardSlug, AwardResourceMeta> = {
  [AWARD_SLUGS.ANNUAL_REWARDS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.ANNUAL_REWARDS],
    proposalType: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
  },
  [AWARD_SLUGS.UNIT_ANNUAL_AWARDS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.UNIT_ANNUAL_AWARDS],
    proposalType: PROPOSAL_TYPES.DON_VI_HANG_NAM,
  },
  [AWARD_SLUGS.TENURE_MEDALS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.TENURE_MEDALS],
    proposalType: PROPOSAL_TYPES.NIEN_HAN,
  },
  [AWARD_SLUGS.CONTRIBUTION_MEDALS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.CONTRIBUTION_MEDALS],
    proposalType: PROPOSAL_TYPES.CONG_HIEN,
  },
  [AWARD_SLUGS.COMMEMORATIVE_MEDALS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.COMMEMORATIVE_MEDALS],
    proposalType: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
  },
  [AWARD_SLUGS.MILITARY_FLAG]: {
    vi: AWARD_LABELS[AWARD_SLUGS.MILITARY_FLAG],
    proposalType: PROPOSAL_TYPES.HC_QKQT,
  },
  [AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.SCIENTIFIC_ACHIEVEMENTS],
    proposalType: PROPOSAL_TYPES.NCKH,
  },
  [AWARD_SLUGS.ADHOC_AWARDS]: {
    vi: AWARD_LABELS[AWARD_SLUGS.ADHOC_AWARDS],
    proposalType: null,
  },
};
