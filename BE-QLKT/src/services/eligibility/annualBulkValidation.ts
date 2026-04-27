import { DANH_HIEU_CA_NHAN_HANG_NAM } from '../../constants/danhHieu.constants';

interface ProposalPayloadItem {
  danh_hieu?: unknown;
  nhan_bkbqp?: unknown;
  nhan_cstdtq?: unknown;
  nhan_bkttcp?: unknown;
  personnel_id?: unknown;
}

function parseProposalItems(value: unknown): ProposalPayloadItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ProposalPayloadItem => {
    return typeof item === 'object' && item !== null;
  });
}

/**
 * Whether selected annual award is one of personal chain awards.
 * @param danhHieu - Award code
 * @returns true for BKBQP/CSTDTQ/BKTTCP
 */
export function isPersonalChainAward(danhHieu: string): boolean {
  return (
    danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP ||
    danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ ||
    danhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP
  );
}

/**
 * Collects personnel IDs already present in pending proposals for target award.
 * @param pendingProposals - Pending annual proposal rows
 * @param targetDanhHieu - Award code being bulk-added
 * @returns Set of conflicting personnel IDs
 */
export function collectPendingProposalPersonnelIdsForAward(
  pendingProposals: Array<{ data_danh_hieu: unknown }>,
  targetDanhHieu: string
): Set<string> {
  const pendingIds = new Set<string>();
  const isBkbqpTarget = targetDanhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKBQP;
  const isCstdtqTarget = targetDanhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.CSTDTQ;
  const isBkttcpTarget = targetDanhHieu === DANH_HIEU_CA_NHAN_HANG_NAM.BKTTCP;
  const isChainTarget = isBkbqpTarget || isCstdtqTarget || isBkttcpTarget;

  for (const proposal of pendingProposals) {
    const items = parseProposalItems(proposal.data_danh_hieu);
    for (const item of items) {
      const isSameDanhHieu = item.danh_hieu === targetDanhHieu;
      const isSameChainFlag =
        (isBkbqpTarget && item.nhan_bkbqp === true) ||
        (isCstdtqTarget && item.nhan_cstdtq === true) ||
        (isBkttcpTarget && item.nhan_bkttcp === true);
      if (
        (isSameDanhHieu || (isChainTarget && isSameChainFlag)) &&
        typeof item.personnel_id === 'string'
      ) {
        pendingIds.add(item.personnel_id);
      }
    }
  }

  return pendingIds;
}
