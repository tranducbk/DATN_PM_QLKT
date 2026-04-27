import {
  getHighestQualifyingHCBVTQRank,
  validateHCBVTQHighestRank,
  type PositionMonthsByGroup,
} from '../../src/helpers/awardValidation/contributionMedalHighestRank';
import {
  CONG_HIEN_HE_SO_GROUPS,
  DANH_HIEU_HCBVTQ,
  CONG_HIEN_BASE_REQUIRED_MONTHS,
  CONG_HIEN_FEMALE_REQUIRED_MONTHS,
} from '../../src/constants/danhHieu.constants';

function buildMonths(
  m07: number,
  m08: number,
  m0910: number
): PositionMonthsByGroup {
  return {
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_07]: m07,
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_08]: m08,
    [CONG_HIEN_HE_SO_GROUPS.LEVEL_09_10]: m0910,
  };
}

describe('getHighestQualifyingHCBVTQRank', () => {
  it('120 tháng ở 0.7, ngưỡng 120 → HANG_BA', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(120, 0, 0),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_BA);
  });

  it('120 tháng ở 0.8 → HANG_NHI', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 120, 0),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHI);
  });

  it('120 tháng ở 0.9-1.0 → HANG_NHAT', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 0, 120),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHAT);
  });

  it('mix 60/80/0 → HANG_BA (0.8+0.9 = 80 < 120, tổng 140 ≥ 120)', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(60, 80, 0),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_BA);
  });

  it('mix 0/60/60 → HANG_NHI (0.9 = 60 < 120, 0.8+0.9 = 120 ≥ 120)', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 60, 60),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHI);
  });

  it('ngưỡng nữ 80, đủ ở 0.9-1.0 → HANG_NHAT', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 0, 80),
        CONG_HIEN_FEMALE_REQUIRED_MONTHS
      )
    ).toBe(DANH_HIEU_HCBVTQ.HANG_NHAT);
  });

  it('boundary nữ 79 tháng ở 0.9-1.0 → null', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(0, 0, 79),
        CONG_HIEN_FEMALE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });

  it('không đủ tháng → null', () => {
    expect(
      getHighestQualifyingHCBVTQRank(
        buildMonths(30, 30, 30),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });
});

describe('validateHCBVTQHighestRank', () => {
  it('proposed = highest → null (không lỗi)', () => {
    expect(
      validateHCBVTQHighestRank(
        DANH_HIEU_HCBVTQ.HANG_NHAT,
        buildMonths(0, 0, 120),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });

  it('proposed cao hơn highest → null (logic không chặn rank cao)', () => {
    expect(
      validateHCBVTQHighestRank(
        DANH_HIEU_HCBVTQ.HANG_NHAT,
        buildMonths(120, 0, 0),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });

  it('proposed HANG_BA nhưng đủ HANG_NHAT → error', () => {
    const error = validateHCBVTQHighestRank(
      DANH_HIEU_HCBVTQ.HANG_BA,
      buildMonths(0, 0, 120),
      CONG_HIEN_BASE_REQUIRED_MONTHS
    );
    expect(error).not.toBeNull();
    expect(error).toContain('thấp hơn hạng cao nhất đủ điều kiện');
    expect(error).toContain('Huân chương Bảo vệ Tổ quốc hạng Nhất');
  });

  it('proposed HANG_NHI nhưng đủ HANG_NHAT → error', () => {
    const error = validateHCBVTQHighestRank(
      DANH_HIEU_HCBVTQ.HANG_NHI,
      buildMonths(0, 0, 120),
      CONG_HIEN_BASE_REQUIRED_MONTHS
    );
    expect(error).toContain('hạng Nhì');
    expect(error).toContain('hạng Nhất');
  });

  it('chưa đủ rank nào → null (helper chỉ care downgrade)', () => {
    expect(
      validateHCBVTQHighestRank(
        DANH_HIEU_HCBVTQ.HANG_BA,
        buildMonths(10, 10, 10),
        CONG_HIEN_BASE_REQUIRED_MONTHS
      )
    ).toBeNull();
  });
});
