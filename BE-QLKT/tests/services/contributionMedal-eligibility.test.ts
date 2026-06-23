import {
  classifyHCBVTQRank,
  cumulativeMonthsForRank,
  evaluateHCBVTQRank,
  requiredContributionMonths,
} from '../../src/services/eligibility/hcbvtqEligibility';
import type { PositionMonthsByGroup } from '../../src/services/eligibility/contributionMonthsAggregator';
import {
  CONTRIBUTION_BASE_REQUIRED_MONTHS,
  CONTRIBUTION_FEMALE_REQUIRED_MONTHS,
  CONTRIBUTION_COEFFICIENT_GROUPS,
  DANH_HIEU_HCBVTQ,
  HCBVTQ_RANK_KEYS,
} from '../../src/constants/danhHieu.constants';
import { GENDER } from '../../src/constants/gender.constants';

const emptyMonthsByGroup = (): PositionMonthsByGroup => ({
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: 0,
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: 0,
  [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 0,
});

describe('HCBVTQ (cống hiến): số tháng phục vụ tối thiểu theo giới tính', () => {
  it('HCBVTQ (cống hiến): quân nhân nữ → ngưỡng tối thiểu 80 tháng', () => {
    expect(requiredContributionMonths(GENDER.FEMALE)).toBe(CONTRIBUTION_FEMALE_REQUIRED_MONTHS);
  });

  it('HCBVTQ (cống hiến): quân nhân nam → ngưỡng tối thiểu 120 tháng', () => {
    expect(requiredContributionMonths(GENDER.MALE)).toBe(CONTRIBUTION_BASE_REQUIRED_MONTHS);
  });

  it('HCBVTQ (cống hiến): không xác định giới tính → áp ngưỡng tối thiểu 120 tháng (mặc định nam)', () => {
    expect(requiredContributionMonths(null)).toBe(CONTRIBUTION_BASE_REQUIRED_MONTHS);
    expect(requiredContributionMonths(undefined)).toBe(CONTRIBUTION_BASE_REQUIRED_MONTHS);
  });
});

describe('HCBVTQ (cống hiến): xác định hạng từ mã danh hiệu', () => {
  it('HCBVTQ (cống hiến): từng mã danh hiệu → đúng hạng và tên hiển thị (hạng Nhất/Nhì/Ba)', () => {
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

  it('HCBVTQ (cống hiến): mã danh hiệu lạ hoặc rỗng → không xác định được hạng', () => {
    expect(classifyHCBVTQRank('UNKNOWN').rank).toBeNull();
    expect(classifyHCBVTQRank(null).rank).toBeNull();
    expect(classifyHCBVTQRank(undefined).rank).toBeNull();
  });
});

describe('HCBVTQ (cống hiến): cộng dồn số tháng phục vụ tính cho mỗi hạng', () => {
  const months = {
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: 30,
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: 40,
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 50,
  };

  it('HCBVTQ (cống hiến): hạng Nhất chỉ cộng số tháng ở hệ số 0.9-1.0 → 50 tháng', () => {
    expect(cumulativeMonthsForRank(months, HCBVTQ_RANK_KEYS.HANG_NHAT)).toBe(50);
  });

  it('HCBVTQ (cống hiến): hạng Nhì cộng số tháng ở hệ số 0.8 và 0.9-1.0 → 90 tháng', () => {
    expect(cumulativeMonthsForRank(months, HCBVTQ_RANK_KEYS.HANG_NHI)).toBe(90);
  });

  it('HCBVTQ (cống hiến): hạng Ba cộng số tháng ở tất cả các nhóm hệ số → 120 tháng', () => {
    expect(cumulativeMonthsForRank(months, HCBVTQ_RANK_KEYS.HANG_BA)).toBe(120);
  });
});

describe('HCBVTQ (cống hiến): xét điều kiện theo hạng', () => {
  it('Xét điều kiện HCBVTQ hạng Nhất: nam có đủ 120 tháng ở hệ số 0.9-1.0 → đủ điều kiện', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 120,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT, months, GENDER.MALE);
    expect(result.eligible).toBe(true);
    expect(result.totalMonths).toBe(120);
    expect(result.requiredMonths).toBe(CONTRIBUTION_BASE_REQUIRED_MONTHS);
    expect(result.rankName).toBe('hạng Nhất');
  });

  it('Xét điều kiện HCBVTQ hạng Nhất: nam chỉ có 119 tháng ở hệ số 0.9-1.0 (mốc biên thiếu 1 tháng) → chưa đủ điều kiện', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 119,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT, months, GENDER.MALE);
    expect(result.eligible).toBe(false);
    expect(result.totalMonths).toBe(119);
  });

  it('Xét điều kiện HCBVTQ hạng Nhất: nữ có đúng 80 tháng ở hệ số 0.9-1.0 (mốc biên tối thiểu) → đủ điều kiện', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 80,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHAT, months, GENDER.FEMALE);
    expect(result.eligible).toBe(true);
    expect(result.requiredMonths).toBe(CONTRIBUTION_FEMALE_REQUIRED_MONTHS);
  });

  it('Xét điều kiện HCBVTQ hạng Nhì: nam có 60 tháng hệ số 0.8 + 60 tháng hệ số 0.9-1.0 (tổng 120) → đủ điều kiện', () => {
    const months = {
      ...emptyMonthsByGroup(),
      [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: 60,
      [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: 60,
    };
    const result = evaluateHCBVTQRank(DANH_HIEU_HCBVTQ.HANG_NHI, months, GENDER.MALE);
    expect(result.eligible).toBe(true);
    expect(result.totalMonths).toBe(120);
  });

  it('Xét điều kiện HCBVTQ: mã danh hiệu lạ → không xác định được hạng và không đủ điều kiện', () => {
    const result = evaluateHCBVTQRank('SOMETHING_ELSE', emptyMonthsByGroup(), GENDER.MALE);
    expect(result.rank).toBeNull();
    expect(result.eligible).toBe(false);
  });
});
