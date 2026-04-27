import { PROPOSAL_STATUS } from '@/constants/proposal.constants';

export interface ProposalListFilterRow {
  status: string;
  nam?: number;
  loai_de_xuat?: string;
}

/**
 * Whether a row matches the status tab plus optional year/type filters.
 * @param row - Proposal row
 * @param activeTab - Tab key: all | pending | approved | rejected
 * @param yearFilter - Empty string means any year
 * @param typeFilter - Empty string means any type
 * @returns true if the row should appear in the filtered list
 */
export function proposalMatchesTabAndFilters(
  row: ProposalListFilterRow,
  activeTab: string,
  yearFilter: number | '',
  typeFilter: string
): boolean {
  const statusMatch =
    activeTab === 'all' ||
    (activeTab === 'pending' && row.status === PROPOSAL_STATUS.PENDING) ||
    (activeTab === 'approved' && row.status === PROPOSAL_STATUS.APPROVED) ||
    (activeTab === 'rejected' && row.status === PROPOSAL_STATUS.REJECTED);

  if (!statusMatch) return false;
  if (yearFilter !== '' && row.nam !== yearFilter) return false;
  if (typeFilter !== '' && row.loai_de_xuat !== typeFilter) return false;
  return true;
}

/**
 * Distinct proposal years, newest first.
 * @param rows - Loaded proposals
 * @returns Sorted year list
 */
export function getProposalListAvailableYears(rows: ProposalListFilterRow[]): number[] {
  const years = new Set<number>();
  rows.forEach(r => {
    if (r.nam != null) years.add(r.nam);
  });
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Distinct proposal types from loaded rows.
 * @param rows - Loaded proposals
 * @returns Type keys present in data
 */
export function getProposalListAvailableTypes(rows: ProposalListFilterRow[]): string[] {
  const types = new Set<string>();
  rows.forEach(r => {
    if (r.loai_de_xuat) types.add(r.loai_de_xuat);
  });
  return Array.from(types);
}

/**
 * Count rows by `status` for tab badges.
 * @param rows - Loaded proposals
 * @returns Status -> count map
 */
export function countProposalsByStatus(rows: ProposalListFilterRow[]): Record<string, number> {
  return rows.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}
