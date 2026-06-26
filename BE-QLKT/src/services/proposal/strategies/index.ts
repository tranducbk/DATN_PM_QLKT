import { PROPOSAL_TYPES, type ProposalType } from '../../../constants/proposalTypes.constants';
import type { ProposalStrategy } from './proposalStrategy';
import { nckhStrategy } from './nckhStrategy';
import { hcqkqtStrategy } from './hcqkqtStrategy';
import { kncStrategy } from './kncStrategy';
import { hccsvvStrategy } from './hccsvvStrategy';
import { donViHangNamStrategy } from './donViHangNamStrategy';
import { caNhanHangNamStrategy } from './caNhanHangNamStrategy';
import { hcbvtqStrategy } from './hcbvtqStrategy';

/**
 * Registry of proposal-type strategies. DOT_XUAT is intentionally null:
 * ad-hoc rewards are created directly by ADMIN through `adhocAward.service`
 * (writes straight to `KhenThuongDotXuat`), never goes through the BangDeXuat
 * approval pipeline.
 */
const REGISTRY: Record<ProposalType, ProposalStrategy | null> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: caNhanHangNamStrategy,
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: donViHangNamStrategy,
  [PROPOSAL_TYPES.NIEN_HAN]: hccsvvStrategy,
  [PROPOSAL_TYPES.HC_QKQT]: hcqkqtStrategy,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: kncStrategy,
  [PROPOSAL_TYPES.CONG_HIEN]: hcbvtqStrategy,
  [PROPOSAL_TYPES.NCKH]: nckhStrategy,
  [PROPOSAL_TYPES.DOT_XUAT]: null,
};

/**
 * Returns the strategy for a proposal type, or null if not yet migrated.
 * @param type - PROPOSAL_TYPES value
 * @returns Strategy instance or null
 */
export function getProposalStrategy(type: ProposalType): ProposalStrategy | null {
  return REGISTRY[type] ?? null;
}

export type { ProposalStrategy } from './proposalStrategy';
