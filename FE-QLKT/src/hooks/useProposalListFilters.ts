import { useCallback, useMemo, useState } from 'react';
import type { ProposalListFilterRow } from '@/lib/proposal/proposalListFilters';
import {
  getProposalListAvailableTypes,
  getProposalListAvailableYears,
  proposalMatchesTabAndFilters,
} from '@/lib/proposal/proposalListFilters';

/**
 * Shared tab + year/type filter state for proposal list pages (manager + admin review).
 * @param proposals - Current list from API
 * @returns Filter state, derived option lists, and filtered rows
 */
export function useProposalListFilters<T extends ProposalListFilterRow>(proposals: T[]) {
  const [activeTab, setActiveTab] = useState('all');
  const [yearFilter, setYearFilter] = useState<number | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const resetFilters = useCallback(() => {
    setYearFilter('');
    setTypeFilter('');
  }, []);

  const availableYears = useMemo(() => getProposalListAvailableYears(proposals), [proposals]);
  const availableTypes = useMemo(() => getProposalListAvailableTypes(proposals), [proposals]);

  const filteredProposals = useMemo(
    () =>
      proposals.filter(p => proposalMatchesTabAndFilters(p, activeTab, yearFilter, typeFilter)),
    [proposals, activeTab, yearFilter, typeFilter]
  );

  return {
    activeTab,
    setActiveTab,
    yearFilter,
    setYearFilter,
    typeFilter,
    setTypeFilter,
    resetFilters,
    availableYears,
    availableTypes,
    filteredProposals,
  };
}
