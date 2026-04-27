import type { ReactNode } from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  HomeOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  PROPOSAL_STATUS,
  PROPOSAL_STATUS_LABELS,
} from '@/constants/proposal.constants';
import type { ProposalListFilterRow } from '@/lib/proposal/proposalListFilters';
import { countProposalsByStatus } from '@/lib/proposal/proposalListFilters';

export type ProposalListTabsVariant = 'manager' | 'adminReview';

export interface ProposalListTabItem {
  key: string;
  label: ReactNode;
}

/**
 * Tab labels + counts for proposal list UIs (manager vs admin review differ slightly).
 * @param proposals - Loaded proposals
 * @param variant - Manager list or admin review list
 * @returns Items for Ant Design Tabs
 */
export function buildProposalListTabItems(
  proposals: ProposalListFilterRow[],
  variant: ProposalListTabsVariant
): ProposalListTabItem[] {
  const statusCounts = countProposalsByStatus(proposals);
  const total = proposals.length;

  if (variant === 'manager') {
    return [
      {
        key: 'all',
        label: (
          <span>
            <HomeOutlined /> Tất cả ({total})
          </span>
        ),
      },
      {
        key: 'pending',
        label: (
          <span>
            <ClockCircleOutlined /> {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.PENDING]} (
            {statusCounts[PROPOSAL_STATUS.PENDING] || 0})
          </span>
        ),
      },
      {
        key: 'approved',
        label: (
          <span>
            <CheckCircleOutlined /> {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.APPROVED]} (
            {statusCounts[PROPOSAL_STATUS.APPROVED] || 0})
          </span>
        ),
      },
      {
        key: 'rejected',
        label: (
          <span>
            <CloseCircleOutlined /> {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.REJECTED]} (
            {statusCounts[PROPOSAL_STATUS.REJECTED] || 0})
          </span>
        ),
      },
    ];
  }

  return [
    {
      key: 'all',
      label: (
        <span>
          <UnorderedListOutlined style={{ marginRight: 8 }} />
          Tất cả ({total})
        </span>
      ),
    },
    {
      key: 'pending',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.PENDING]} (
          {statusCounts[PROPOSAL_STATUS.PENDING] || 0})
        </span>
      ),
    },
    {
      key: 'approved',
      label: (
        <span>
          <CheckCircleOutlined style={{ marginRight: 8 }} />
          {PROPOSAL_STATUS_LABELS[PROPOSAL_STATUS.APPROVED]} (
          {statusCounts[PROPOSAL_STATUS.APPROVED] || 0})
        </span>
      ),
    },
    {
      key: 'rejected',
      label: (
        <span>
          <WarningOutlined style={{ marginRight: 8 }} />
          Đã từ chối ({statusCounts[PROPOSAL_STATUS.REJECTED] || 0})
        </span>
      ),
    },
  ];
}
