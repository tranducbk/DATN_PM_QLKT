import {
  classifyHCBVTQRank,
  cumulativeMonthsForRank,
  emptyMonthsByGroup,
  evaluateHCBVTQRank,
  requiredCongHienMonths,
} from '../../src/services/eligibility/hcbvtqEligibility';
import {
  CONG_HIEN_BASE_REQUIRED_MONTHS,
  CONG_HIEN_FEMALE_REQUIRED_MONTHS,
  CONG_HIEN_HE_SO_GROUPS,
  DANH_HIEU_HCBVTQ,
  HCBVTQ_RANK_KEYS,
} from '../../src/constants/danhHieu.constants';
import { GENDER } from '../../src/constants/gender.constants';

describe('requiredCongHienMonths', () => {
  it('returns female threshold (80) for FEMALE', () => {
    expect(requiredCongHienMonths(GENDER.FEMALE)).toBe(CONG_HIEN_FEMALE_REQUIRED_MONTHS);
  });

  it('returns base threshold (120) for MALE', () => {
    expect(requiredCongHienMonths(GENDER.MALE)).toBe(CONG_HIEN_BASE_REQUIRED_MONTHS);
  });

  it('returns base threshold for null/undefined gender', () => {
    expect(requiredCongHienMonths(null)).toBe(CONG_HIEN_BASE_REQUIRED_MONTHS);
    expect(requiredCongHienMonths(undefined)).toBe(CONG_HIEN_BASE_REQUIRED_MONTHS);
  });
});

describe('classifyHCBVTQRank', () => {
  it('maps each HCBVTQ code to rank key + Vietnamese label', () => {
    expect(classifyHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT)).toEqual({
      rank: HCBVTQ_RANK_KEYS.HANG_NHAT,
      rankName: 'hạng Nhất',
    });
    expect(classifyHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHI)).toEqual({
      rank: HCBVTQ_RANK_KEYS.HANG_NHI,
      rankName: 'hạng Nhì',
    });
    expect(classifyHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_BA)).toEqual({
      rank: HCBVTQ_RANK_KEYS.HANG_BA,
      rankName: 'hạng Ba',
    });
  });

  it('returns null rank for unknown codes', () => {
    expect(classifyHCBVTQRank('UNKNOWN').rank).toBeNull();
    expect(classifyHCBVTQRank(null).rank).toBeNull();
    expect(classifyHCBVTQRank(undefined).rank).toBeNull();
  });
});

describe('cumulativeMonthsForRank', () => {
  const months = {
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: 30,
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: 40,
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: 50,
  };

  it('HANG_NHAT counts only 0.9-1.0', () => {
    expect(cumulativeMonthsForRank(months, HCBVTQ_RANK_KEYS.HANG_NHAT)).toBe(50);
  });

  it('HANG_NHI counts 0.8 + 0.9-1.0', () => {
    expect(cumulativeMonthsForRank(months, HCBVTQ_RANK_KEYS.HANG_NHI)).toBe(90);
  });

  it('HANG_BA counts all groups', () => {
    expect(cumulativeMonthsForRank(months, HCBVTQ_RANK_KEYS.HANG_BA)).toBe(120);
  });
});

describe('evaluateHCBVTQRank', () => {
  it('returns eligible when male has 120 months at 0.9-1.0 for HANG_NHAT', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: 120,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT, months, GENDER.MALE);
    expect(result.eligible).toBe(true);
    expect(result.totalMonths).toBe(120);
    expect(result.requiredMonths).toBe(CONG_HIEN_BASE_REQUIRED_MONTHS);
    expect(result.rankName).toBe('hạng Nhất');
  });

  it('returns ineligible when male has 119 months at 0.9-1.0 for HANG_NHAT (boundary)', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: 119,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT, months, GENDER.MALE);
    expect(result.eligible).toBe(false);
    expect(result.totalMonths).toBe(119);
  });

  it('female threshold is 80 months — eligible at exactly 80 for HANG_NHAT', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: 80,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT, months, GENDER.FEMALE);
    expect(result.eligible).toBe(true);
    expect(result.requiredMonths).toBe(CONG_HIEN_FEMALE_REQUIRED_MONTHS);
  });

  it('HANG_NHI sums 0.8 and 0.9-1.0 groups', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: 60,
      [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: 60,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHI, months, GENDER.MALE);
    expect(result.eligible).toBe(true);
    expect(result.totalMonths).toBe(120);
  });

  it('returns rank=null for unknown danh_hieu', () => {
    const result = evaluateHCBVTQRank('SOMETHING_ELSE', emptyMonthsByGroup(), GENDER.MALE);
    expect(result.rank).toBeNull();
    expect(result.eligible).toBe(false);
  });
});

describe('emptyMonthsByGroup', () => {
  it('returns zeros across all groups', () => {
    const m = emptyMonthsByGroup();
    expect(m[CONG_HIEN_HE_SO_GROUPS.LEVEL_07]).toBe(0);
    expect(m[CONG_HIEN_HE_SO_GROUPS.LEVEL_08]).toBe(0);
    expect(m[CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]).toBe(0);
  });
});
