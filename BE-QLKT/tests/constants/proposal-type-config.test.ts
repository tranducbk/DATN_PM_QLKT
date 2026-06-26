import {
  getProposalDataField,
  getProposalTypeConfig,
  isOneTimeProposalType,
} from '../../src/services/proposal/proposalTypeConfig';
import { PROPOSAL_TYPES } from '../../src/constants/proposalTypes.constants';

describe('Xác định cột dữ liệu danh hiệu tương ứng với từng loại đề xuất', () => {
  it('Đề xuất hằng năm (cá nhân, đơn vị, đột xuất) lưu vào cột danh hiệu (data_danh_hieu)', () => {
    expect(getProposalDataField(PROPOSAL_TYPES.CA_NHAN_HANG_NAM)).toBe('data_danh_hieu');
    expect(getProposalDataField(PROPOSAL_TYPES.DON_VI_HANG_NAM)).toBe('data_danh_hieu');
    expect(getProposalDataField(PROPOSAL_TYPES.DOT_XUAT)).toBe('data_danh_hieu');
  });

  it('Đề xuất cống hiến lưu vào cột cống hiến (data_cong_hien); niên hạn, HC QKQT, KNC lưu vào cột niên hạn (data_nien_han)', () => {
    expect(getProposalDataField(PROPOSAL_TYPES.CONG_HIEN)).toBe('data_cong_hien');
    expect(getProposalDataField(PROPOSAL_TYPES.NIEN_HAN)).toBe('data_nien_han');
    expect(getProposalDataField(PROPOSAL_TYPES.HC_QKQT)).toBe('data_nien_han');
    expect(getProposalDataField(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN)).toBe('data_nien_han');
  });

  it('Đề xuất NCKH lưu vào cột thành tích (data_thanh_tich)', () => {
    expect(getProposalDataField(PROPOSAL_TYPES.NCKH)).toBe('data_thanh_tich');
  });
});

describe('Nhận biết loại đề xuất chỉ trao một lần', () => {
  it('Chỉ HC QKQT, KNC và cống hiến là khen thưởng trao một lần; cá nhân hằng năm và niên hạn thì không', () => {
    expect(isOneTimeProposalType(PROPOSAL_TYPES.HC_QKQT)).toBe(true);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.KNC_VSNXD_QDNDVN)).toBe(true);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.CONG_HIEN)).toBe(true);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.CA_NHAN_HANG_NAM)).toBe(false);
    expect(isOneTimeProposalType(PROPOSAL_TYPES.NIEN_HAN)).toBe(false);
  });
});

describe('Lấy cấu hình của loại đề xuất', () => {
  it('Loại đề xuất không xác định → không có cấu hình', () => {
    expect(getProposalTypeConfig('UNKNOWN')).toBeNull();
  });

  it('Đề xuất niên hạn, HC QKQT và cống hiến bắt buộc nhập tháng; cá nhân hằng năm thì không', () => {
    expect(getProposalTypeConfig(PROPOSAL_TYPES.NIEN_HAN)?.requiresMonth).toBe(true);
    expect(getProposalTypeConfig(PROPOSAL_TYPES.HC_QKQT)?.requiresMonth).toBe(true);
    expect(getProposalTypeConfig(PROPOSAL_TYPES.CONG_HIEN)?.requiresMonth).toBe(true);
    expect(getProposalTypeConfig(PROPOSAL_TYPES.CA_NHAN_HANG_NAM)?.requiresMonth).toBe(false);
  });
});
