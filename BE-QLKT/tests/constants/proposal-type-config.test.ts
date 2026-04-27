import {
  getProposalDataField,
  getProposalTypeConfig,
  isOneTimeProposalType,
} from '../../src/services/proposal/proposalTypeConfig';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

describe('getProposalDataField', () => {
  it('routes annual personal/unit titles to data_danh_hieu', () => {
    expect(getProposalDataField(PROPOSAL_TYPES.CA_NHAN_HANG_NAM)).toBe('data_danh_hieu');
    expect(getProposalDataField(PROPOSAL_TYPES.DON_VI_HANG_NAM)).toBe('data_danh_hieu');
    expect(getProposalDataField(PROPOSAL_TYPES.DOT_XUAT)).toBe('data_danh_hieu');
  });

  it('routes contribution medals to data_cong_hien and tenure-based to data_nien_han', () => {
    expect(getProposalDataField(PROPOSAL_TYPES.CONG_HIEN)).toBe('data_cong_hien');
    expect(getProposalDataField(PROPOSAL_TYPES.NIEN_HAN)).toBe('data_nien_han');
    expect(getProposalDataField(PROPOSAL_TYPES.HC_QKQT)).toBe('data_nien_han');
    expect(getProposalDataField(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN)).toBe('data_nien_han');
  });

  it('routes scientific achievement to data_thanh_tich', () => {
    expect(getProposalDataField(PROPOSAL_TYPES.NCKH)).toBe('data_thanh_tich');
  });
});

describe('isOneTimeProposalType', () => {
  it('returns true only for lifetime awards', () => {
    expect(isOneTimeProposalType(PROPOSAL_TYPES.HC_QKQT)).toBe(true);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN)).toBe(true);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.CONG_HIEN)).toBe(true);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.CA_NHAN_HANG_NAM)).toBe(false);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.NIEN_HAN)).toBe(false);
  });
});

describe('getProposalTypeConfig', () => {
  it('returns null for unknown proposal types', () => {
    expect(getProposalTypeConfig('UNKNOWN')).toBeNull();
  });

  it('marks tenure-based and contribution proposals as requiring month', () => {
    expect(getProposalTypeConfig(PROPOSAL_TYPES.NIEN_HAN)?.requiresMonth).toBe(true);
    expect(getProposalTypeConfig(PROPOSAL_TYPES.HC_QKQT)?.requiresMonth).toBe(true);
    expect(getProposalTypeConfig(PROPOSAL_TYPES.CONG_HIEN)?.requiresMonth).toBe(true);
    expect(getProposalTypeConfig(PROPOSAL_TYPES.CA_NHAN_HANG_NAM)?.requiresMonth).toBe(false);
  });
});
