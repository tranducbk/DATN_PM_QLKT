import { prisma } from '../../models';
import { checkDuplicateAward } from '../proposal/validation';

export interface PersonnelDuplicateCheckItem {
  personnel_id?: string | null;
  danh_hieu?: string | null;
}

export interface CollectPersonnelDuplicateOptions {
  /** When non-null, restricts the pending lookup to that proposal status. */
  status?: string | null;
  /** Excludes a proposal id from the pending lookup (used during edit/approve). */
  excludeProposalId?: string | null;
  /** Pre-resolved name map; when omitted the helper batches a `quanNhan.findMany` itself. */
  hoTenMap?: Map<string, string>;
}

/**
 * Runs duplicate-award checks for a list of personnel items and prefixes each
 * error with the personnel ho_ten so the caller can surface readable messages.
 * @param items - Items with `personnel_id` and `danh_hieu`
 * @param nam - Proposal year
 * @param proposalType - PROPOSAL_TYPES value
 * @param options - Status filter, excludeProposalId, optional pre-resolved name map
 * @returns Aggregated error strings (empty when no duplicates)
 */
export async function collectPersonnelDuplicateErrors(
  items: PersonnelDuplicateCheckItem[],
  nam: number,
  proposalType: string,
  options: CollectPersonnelDuplicateOptions = {}
): Promise<string[]> {
  const validItems = items.filter(
    (item): item is { personnel_id: string; danh_hieu: string } =>
      Boolean(item.personnel_id && item.danh_hieu)
  );
  if (validItems.length === 0) return [];

  const status = options.status ?? null;
  const excludeProposalId = options.excludeProposalId ?? null;

  let hoTenMap = options.hoTenMap;
  if (!hoTenMap) {
    const personnelIds = Array.from(new Set(validItems.map(item => item.personnel_id)));
    const list = await prisma.quanNhan.findMany({
      where: { id: { in: personnelIds } },
      select: { id: true, ho_ten: true },
    });
    hoTenMap = new Map(list.map(p => [p.id, p.ho_ten]));
  }

  const results = await Promise.all(
    validItems.map(item =>
      checkDuplicateAward(
        item.personnel_id,
        nam,
        item.danh_hieu,
        proposalType,
        status,
        excludeProposalId
      ).then(r => {
        if (!r.exists) return null;
        const hoTen = hoTenMap!.get(item.personnel_id) || item.personnel_id;
        return `${hoTen}: ${r.message}`;
      })
    )
  );

  return results.filter((err): err is string => err !== null);
}
