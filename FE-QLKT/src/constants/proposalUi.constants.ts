import type { ComponentType } from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CrownOutlined,
  ExperimentOutlined,
  FlagOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
  TrophyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { PROPOSAL_STATUS, PROPOSAL_TYPES, type ProposalType } from '@/constants/proposal.constants';

type IconComponent = ComponentType;

export interface ProposalStatusUi {
  color: string;
  icon: IconComponent | null;
}

export const PROPOSAL_TYPE_ICON_COMPONENTS: Partial<Record<ProposalType, IconComponent>> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: TrophyOutlined,
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: TeamOutlined,
  [PROPOSAL_TYPES.NIEN_HAN]: SafetyCertificateOutlined,
  [PROPOSAL_TYPES.HC_QKQT]: FlagOutlined,
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: StarOutlined,
  [PROPOSAL_TYPES.CONG_HIEN]: CrownOutlined,
  [PROPOSAL_TYPES.NCKH]: ExperimentOutlined,
};

export const PROPOSAL_STATUS_UI: Record<string, ProposalStatusUi> = {
  [PROPOSAL_STATUS.PENDING]: { color: 'warning', icon: ClockCircleOutlined },
  [PROPOSAL_STATUS.APPROVED]: { color: 'success', icon: CheckCircleOutlined },
  [PROPOSAL_STATUS.REJECTED]: { color: 'error', icon: CloseCircleOutlined },
};

export const ADMIN_REVIEW_PROPOSAL_STATUS_UI: Record<string, ProposalStatusUi> = {
  [PROPOSAL_STATUS.PENDING]: { color: 'warning', icon: ClockCircleOutlined },
  [PROPOSAL_STATUS.APPROVED]: { color: 'success', icon: CheckCircleOutlined },
  [PROPOSAL_STATUS.REJECTED]: { color: 'error', icon: WarningOutlined },
};

/** Long-form status copy on admin proposal detail header (differs from list labels). */
export const ADMIN_PROPOSAL_DETAIL_STATUS_LABELS: Record<string, string> = {
  [PROPOSAL_STATUS.PENDING]: 'Đang chờ duyệt',
  [PROPOSAL_STATUS.APPROVED]: 'Đã phê duyệt',
  [PROPOSAL_STATUS.REJECTED]: 'Từ chối',
};
