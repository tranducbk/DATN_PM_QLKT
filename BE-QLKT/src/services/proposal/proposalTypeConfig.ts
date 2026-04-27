import { PROPOSAL_TYPES, type ProposalType } from '../../constants/proposalTypes.constants';

export type ProposalDataField =
  | 'data_danh_hieu'
  | 'data_thanh_tich'
  | 'data_nien_han'
  | 'data_cong_hien';

export interface ProposalTypeConfig {
  type: ProposalType;
  /** JSON column on BangDeXuat that holds items for this proposal type. */
  dataField: ProposalDataField;
  /** Whether `thang` is mandatory at submit/approve. */
  requiresMonth: boolean;
  /** Whether duplicate check matches by personnel only (one-time lifetime award). */
  oneTime: boolean;
}

export const PROPOSAL_TYPE_CONFIGS: Record<ProposalType, ProposalTypeConfig> = {
  [PROPOSAL_TYPES.CA_NHAN_HANG_NAM]: {
    type: PROPOSAL_TYPES.CA_NHAN_HANG_NAM,
    dataField: 'data_danh_hieu',
    requiresMonth: false,
    oneTime: false,
  },
  [PROPOSAL_TYPES.DON_VI_HANG_NAM]: {
    type: PROPOSAL_TYPES.DON_VI_HANG_NAM,
    dataField: 'data_danh_hieu',
    requiresMonth: false,
    oneTime: false,
  },
  [PROPOSAL_TYPES.NIEN_HAN]: {
    type: PROPOSAL_TYPES.NIEN_HAN,
    dataField: 'data_nien_han',
    requiresMonth: true,
    oneTime: false,
  },
  [PROPOSAL_TYPES.HC_QKQT]: {
    type: PROPOSAL_TYPES.HC_QKQT,
    dataField: 'data_nien_han',
    requiresMonth: true,
    oneTime: true,
  },
  [PROPOSAL_TYPES.KNC_VSNXD_QDNDVN]: {
    type: PROPOSAL_TYPES.KNC_VSNXD_QDNDVN,
    dataField: 'data_nien_han',
    requiresMonth: true,
    oneTime: true,
  },
  [PROPOSAL_TYPES.CONG_HIEN]: {
    type: PROPOSAL_TYPES.CONG_HIEN,
    dataField: 'data_cong_hien',
    requiresMonth: true,
    oneTime: true,
  },
  [PROPOSAL_TYPES.NCKH]: {
    type: PROPOSAL_TYPES.NCKH,
    dataField: 'data_thanh_tich',
    requiresMonth: false,
    oneTime: false,
  },
  [PROPOSAL_TYPES.DOT_XUAT]: {
    type: PROPOSAL_TYPES.DOT_XUAT,
    dataField: 'data_danh_hieu',
    requiresMonth: false,
    oneTime: false,
  },
};

/**
 * Returns the static config for a proposal type, or null when unknown.
 * @param type - PROPOSAL_TYPES value
 * @returns Matching config or null
 */
export function getProposalTypeConfig(type: string): ProposalTypeConfig | null {
  return PROPOSAL_TYPE_CONFIGS[type as ProposalType] ?? null;
}

/**
 * Returns the BangDeXuat JSON column for a proposal type. Defaults to `data_nien_han`
 * to preserve legacy `getProposalDataField` behavior for unknown types.
 * @param type - PROPOSAL_TYPES value
 * @returns JSON column name on BangDeXuat
 */
export function getProposalDataField(type: string): ProposalDataField {
  return getProposalTypeConfig(type)?.dataField ?? 'data_nien_han';
}

/**
 * Whether duplicate detection should match by personnel only (one-time lifetime award).
 * @param type - PROPOSAL_TYPES value
 * @returns True for HC_QKQT / KNC_VSNXD_QDNDVN / CONG_HIEN
 */
export function isOneTimeProposalType(type: string): boolean {
  return getProposalTypeConfig(type)?.oneTime ?? false;
}
