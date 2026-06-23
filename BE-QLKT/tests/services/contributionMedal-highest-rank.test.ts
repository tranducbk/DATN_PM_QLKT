import {
  getHighestQualifyingHCBVTQRank,
  validateHCBVTQHighestRank,
  type PositionMonthsByGroup,
} from '../../src/helpers/awardValidation/contributionMedalHighestRank';
import {
  CONTRIBUTION_COEFFICIENT_GROUPS,
  DANH_HIEU_HCBVTQ,
  CONTRIBUTION_BASE_REQUIRED_MONTHS,
  CONTRIBUTION_FEMALE_REQUIRED_MONTHS,
} from '../../src/constants/danhHieu.constants';

function buildMonths(
  m07: number,
  m08: number,
  m0910: number
): PositionMonthsByGroup {
  return {
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_07]: m07,
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_08]: m08,
    [CONTRIBUTION_COEFFICIENT_GROUPS.LEVEL_09_10]: m0910,
  };
}

describe('HCBVTQ (cống hiến): xác định hạng cao nhất đủ điều kiện', () => {
  it('HCBVTQ (cống hiến): 120 tháng ở hệ số 0.7, ngưỡng 120 → hạng cao nhất là hạng Ba', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(120, 0, 0),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_BA);
  });

  it('HCBVTQ (cống hiến): 120 tháng ở hệ số 0.8 → hạng cao nhất là hạng Nhì', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 120, 0),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHI);
  });

  it('HCBVTQ (cống hiến): 120 tháng ở hệ số 0.9-1.0 → hạng cao nhất là hạng Nhất', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 0, 120),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHAT);
  });

  it('HCBVTQ (cống hiến): 60 tháng hệ số 0.7 + 80 tháng hệ số 0.8 (0.8 trở lên chỉ 80 < 120, tổng 140 ≥ 120) → hạng cao nhất là hạng Ba', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(60, 80, 0),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_BA);
  });

  it('HCBVTQ (cống hiến): 60 tháng hệ số 0.8 + 60 tháng hệ số 0.9-1.0 (riêng 0.9-1.0 chỉ 60 < 120, cộng 0.8 đủ 120) → hạng cao nhất là hạng Nhì', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 60, 60),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHI);
  });

  it('HCBVTQ (cống hiến): nữ ngưỡng 80, đủ 80 tháng ở hệ số 0.9-1.0 → hạng cao nhất là hạng Nhất', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 0, 80),
        CONTRIBUTION_FEMALE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHAT);
  });

  it('HCBVTQ (cống hiến): nữ chỉ 79 tháng ở hệ số 0.9-1.0 (mốc biên thiếu 1 tháng) → chưa đủ hạng nào', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 0, 79),
        CONTRIBUTION_FEMALE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });

  it('HCBVTQ (cống hiến): tổng số tháng phục vụ chưa đủ → chưa đủ hạng nào', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(30, 30, 30),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });
});

describe('HCBVTQ (cống hiến): chặn đề xuất hạng thấp hơn hạng cao nhất đủ điều kiện', () => {
  it('HCBVTQ (cống hiến): đề xuất đúng bằng hạng cao nhất đủ điều kiện → hợp lệ', () => {
    expect(
      validateHCBVTQHighestRank(
        DANH_HIEU_HCBVTQ.HANG_NHAT,
        buildMonths(0, 0, 120),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });

  it('HCBVTQ (cống hiến): đề xuất hạng cao hơn hạng cao nhất đủ điều kiện → hợp lệ (chỉ chặn hạ hạng, không chặn hạng cao)', () => {
    expect(
      validateHCBVTQHighestRank(
        DANH_HIEU_HCBVTQ.HANG_NHAT,
        buildMonths(120, 0, 0),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });

  it('HCBVTQ (cống hiến) chặn hạ hạng: đề xuất hạng Ba nhưng đủ điều kiện hạng Nhất → báo "thấp hơn hạng cao nhất đủ điều kiện" (hạng Nhất)', () => {
    const error = validateHCBVTQHighestRank(
      DANH_HIEU_HCBVTQ.HANG_BA,
      buildMonths(0, 0, 120),
      CONTRIBUTION_BASE_REQUIRED_MONTHS
    );
    expect(error).not.toBeNull();
    expect(error).toContain('thấp hơn hạng cao nhất đủ điều kiện');
    expect(error).toContain('Huân chương Bảo vệ Tổ quốc hạng Nhất');
  });

  it('HCBVTQ (cống hiến) chặn hạ hạng: đề xuất hạng Nhì nhưng đủ điều kiện hạng Nhất → báo hạng Nhì thấp hơn hạng Nhất', () => {
    const error = validateHCBVTQHighestRank(
      DANH_HIEU_HCBVTQ.HANG_NHI,
      buildMonths(0, 0, 120),
      CONTRIBUTION_BASE_REQUIRED_MONTHS
    );
    expect(error).toContain('hạng Nhì');
    expect(error).toContain('hạng Nhất');
  });

  it('HCBVTQ (cống hiến): chưa đủ điều kiện hạng nào → hợp lệ (chỉ chặn hạ hạng khi đã đủ hạng cao hơn)', () => {
    expect(
      validateHCBVTQHighestRank(
        DANH_HIEU_HCBVTQ.HANG_BA,
        buildMonths(10, 10, 10),
        CONTRIBUTION_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });
});
