'use client';

import { Tag } from 'antd';
import { getProposalStatusLabel } from '@/constants/proposal.constants';
import {
  ADMIN_REVIEW_PROPOSAL_STATUS_UI,
  PROPOSAL_STATUS_UI,
} from '@/constants/proposalUi.constants';

export type ProposalStatusTagVariant = 'manager' | 'adminReview';

interface ProposalStatusTagProps {
  status: string;
  variant: ProposalStatusTagVariant;
  label?: string;
}

export function ProposalStatusTag({ status, variant, label }: ProposalStatusTagProps) {
  const uiMap = variant === 'adminReview' ? ADMIN_REVIEW_PROPOSAL_STATUS_UI : PROPOSAL_STATUS_UI;
  const config = uiMap[status] ?? { color: 'default', icon: null };
  const StatusIcon = config.icon;
  const text = label ?? getProposalStatusLabel(status);

  return (
    <Tag
      color={config.color}
      icon={StatusIcon ? <StatusIcon /> : undefined}
      style={{ marginInlineEnd: 0 }}
    >
      {text}
    </Tag>
  );
}
