import type { ProposalType } from './proposalTypes.constants';
import { isProposalType } from './proposalTypes.constants';
import { AWARD_TYPE_REGISTRY } from './awardTypeRegistry.constants';

export { PROPOSAL_TYPES, type ProposalType, isProposalType } from './proposalTypes.constants';

export const PROPOSAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ProposalStatus = (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  APPROVED: 'green',
  REJECTED: 'red',
};

export function getProposalStatusLabel(status: string | undefined | null): string {
  if (status == null || status === '') return '-';
  return PROPOSAL_STATUS_LABELS[status] || status;
}

export const PROPOSAL_STATUS_BADGE_COLORS: Record<string, string> = {
  [PROPOSAL_STATUS.PENDING]: 'gold',
  [PROPOSAL_STATUS.APPROVED]: 'green',
  [PROPOSAL_STATUS.REJECTED]: 'red',
};

export const PROPOSAL_TYPES_REQUIRING_MONTH = new Set<ProposalType>(
  Object.values(AWARD_TYPE_REGISTRY)
    .filter(meta => meta.requiresMonth)
    .map(meta => meta.code)
);

export function requiresProposalMonth(type: ProposalType): boolean {
  return PROPOSAL_TYPES_REQUIRING_MONTH.has(type);
}

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = Object.fromEntries(
  Object.values(AWARD_TYPE_REGISTRY).map(meta => [meta.code, meta.label])
) as Record<ProposalType, string>;

export function getProposalTypeLabel(type: string | undefined | null): string {
  if (type == null || type === '') return '-';
  return isProposalType(type) ? PROPOSAL_TYPE_LABELS[type] : type;
}

export const PROPOSAL_STATUS_ADMIN: Record<
  string,
  { tabLabel: string; tableTagText: string; tagColor: string }
> = {
  [PROPOSAL_STATUS.PENDING]: {
    tabLabel: 'Đang chờ',
    tableTagText: 'Đang chờ',
    tagColor: 'warning',
  },
  [PROPOSAL_STATUS.APPROVED]: {
    tabLabel: 'Đã duyệt',
    tableTagText: 'Đã duyệt',
    tagColor: 'success',
  },
  [PROPOSAL_STATUS.REJECTED]: {
    tabLabel: 'Từ chối',
    tableTagText: 'Từ chối',
    tagColor: 'error',
  },
};

export const PROPOSAL_TYPE_ADMIN_TAG: Record<ProposalType, { label: string; color: string }> =
  Object.fromEntries(
    Object.values(AWARD_TYPE_REGISTRY).map(meta => [
      meta.code,
      { label: meta.label, color: meta.tagColor },
    ])
  ) as Record<ProposalType, { label: string; color: string }>;

export const PROPOSAL_REVIEW_CARD_TITLES: Record<ProposalType, string> = PROPOSAL_TYPE_LABELS;

export const PROPOSAL_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
