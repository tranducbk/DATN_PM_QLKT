import { PROPOSAL_TYPES, type ProposalType } from '../../../constants/proposalTypes.constants';
import type { ProposalStrategy } from './proposalStrategy';
import { nckhStrategy } from './nckhStrategy';
import { hcQkqtStrategy } from './hcQkqtStrategy';
import { kncStrategy } from './kncStrategy';
import { nienHanStrategy } from './nienHanStrategy';
import { donViHangNamStrategy } from './donViHangNamStrategy';
import { caNhanHangNamStrategy } from './caNhanHangNamStrategy';
import { congHienStrategy } from './congHienStrategy';

/**
 * Registry of proposal-type strategies. DOT_XUAT is intentionally null:
 * khen thưởng đột xuất is created directly by ADMIN through `adhocAward.service`
 * (writes straight to `KhenThuongDotXuat`), never goes through the BangDeXuat
 * approval pipeline.
 */
const REGISTRY: Record<ProposalType, ProposalStrategy | null> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: caNhanHangNamStrategy,
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: donViHangNamStrategy,
  [PROPOSAL_TYPES.NIEN_HAN]: nienHanStrategy,
  [PROPOSAL_TYPES.HC_QKQT]: hcQkqtStrategy,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: kncStrategy,
  [PROPOSAL_TYPES.CONG_HIEN]: congHienStrategy,
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

/**
 * Returns the strategy for a proposal type or throws when missing. Use only
 * at sites that have verified registration (post-migration callers).
 * @param type - PROPOSAL_TYPES value
 * @returns Strategy instance
 * @throws Error - When no strategy is registered
 */
export function requireProposalStrategy(type: ProposalType): ProposalStrategy {
  const strategy = REGISTRY[type];
  if (!strategy) {
    throw new Error(`No strategy registered for proposal type: ${type}`);
  }
  return strategy;
}

export type { ProposalStrategy } from './proposalStrategy';
